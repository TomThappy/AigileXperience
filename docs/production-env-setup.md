# Production Environment Variables Setup

## Render Backend Service Environment Variables

Diese Environment Variables sollten in der Render Console für den Backend Service gesetzt werden:

### Global Model Configuration
```bash
MODEL_ANALYZE=gpt-4-turbo
MODEL_REFINE=gpt-4-turbo
MODEL_ANALYZE_128K=gpt-4-turbo
LLM_DEFAULT_MODEL=gpt-4-turbo
```

### Step-specific Model Configuration
```bash
# Critical steps requiring high-quality models
LLM_MODEL_EVIDENCE=gpt-4-turbo
LLM_MODEL_BRIEF=gpt-4-turbo
LLM_MODEL_MARKET=gpt-4-turbo
LLM_MODEL_BUSINESS_MODEL=gpt-4-turbo
LLM_MODEL_FINANCIAL_PLAN=gpt-4-turbo
LLM_MODEL_INVESTOR_SCORE=gpt-4-turbo

# Simple steps can use gpt-4o-mini
LLM_MODEL_PROBLEM=gpt-4o-mini
LLM_MODEL_SOLUTION=gpt-4o-mini
LLM_MODEL_TEAM=gpt-4o-mini
LLM_MODEL_COMPETITION=gpt-4o-mini
LLM_MODEL_STATUS_QUO=gpt-4o-mini
LLM_MODEL_GTM=gpt-4o-mini
```

### Phase-specific Model Configuration (für Phase-Splitting)
```bash
# Market phases
LLM_MODEL_MARKET_PHASE1=gpt-4o-mini
LLM_MODEL_MARKET_PHASE2=gpt-4-turbo

# GTM phases  
LLM_MODEL_GTM_PHASE1=gpt-4o-mini
LLM_MODEL_GTM_PHASE2=gpt-4-turbo

# Financial Plan phases
LLM_MODEL_FINANCIAL_PLAN_PHASE1=gpt-4o-mini
LLM_MODEL_FINANCIAL_PLAN_PHASE2=gpt-4-turbo
```

### RateGate Configuration
```bash
RATEGATE_TOKENS_PER_MINUTE=30000
RATEGATE_TOKENS_PER_HOUR=180000
RATEGATE_TOKENS_PER_DAY=800000
RATEGATE_RESERVE_PERCENTAGE=0.20
RATEGATE_MIN_TOKENS_FOR_REQUEST=1000
RATEGATE_STATS_INTERVAL_MS=30000
```

### Retry Configuration
```bash
LLM_RETRIES=3
LLM_RETRY_BASE_DELAY=2000
QUEUE_CONCURRENCY=2
RATE_WINDOW_MS=60000
```

### Model-specific Rate Limits (TPM = Tokens Per Minute)
```bash
OPENAI_TPM_GPT4=30000
OPENAI_TPM_GPT4O=50000
OPENAI_TPM_GPT4O_MINI=200000
RATEGATE_TOKENS_PER_MINUTE_GPT4=30000
RATEGATE_TOKENS_PER_MINUTE_GPT4O_MINI=200000
```

## Render Worker Service Environment Variables

Der Worker Service sollte die gleichen Environment Variables haben wie der Backend Service.

**WICHTIG:** Beide Services (Backend + Worker) müssen dieselben Model-Environment-Variables haben, da der Worker die eigentlichen LLM-Calls macht.

## Expected Results nach dem Setup

### 1. `/api/config` sollte zeigen:
```json
{
  "effective_routing": {
    "market_phase1": { "model": "gpt-4o-mini", "ctx_max": 128000 },
    "market_phase2": { "model": "gpt-4-turbo", "ctx_max": 128000 },
    "gtm_phase1": { "model": "gpt-4o-mini", "ctx_max": 128000 },
    "gtm_phase2": { "model": "gpt-4-turbo", "ctx_max": 128000 },
    "financial_plan_phase1": { "model": "gpt-4o-mini", "ctx_max": 128000 },
    "financial_plan_phase2": { "model": "gpt-4-turbo", "ctx_max": 128000 }
  }
}
```

### 2. Context Guards sollten verhindern:
- Keine 8192-Token-Modelle für market/gtm/financial_plan
- Alle ctx_max Werte ≥ 100k für kritische Steps

### 3. Trace Events sollten zeigen:
```json
{
  "step": "market",
  "phase": "phase1", 
  "model": "gpt-4o-mini",
  "ctx_max": 128000,
  "est_tokens": 15000,
  "sources_used": 8,
  "rategate_wait_ms": 0,
  "attempts": 1
}
```

## Validation Commands

```bash
# 1. Check configuration
curl -sS https://aigilexperience-backend.onrender.com/api/config | jq .effective_routing

# 2. Create test job
JOB_JSON='{"project_title":"TestJob","elevator_pitch":"Test pipeline with new model routing","use_assumptions":true}'
JOB_ID=$(curl -sS -X POST https://aigilexperience-backend.onrender.com/api/jobs \
  -H 'Content-Type: application/json' -d "$JOB_JSON" | jq -r .jobId)

# 3. Monitor with SSE
curl -N https://aigilexperience-backend.onrender.com/api/jobs/$JOB_ID/stream

# 4. Get trace
curl -sS https://aigilexperience-backend.onrender.com/api/jobs/$JOB_ID/trace | jq .
```

## Troubleshooting

### Issue: Environment variables not visible in /api/config
**Solution:** 
- Verify variables are set in both Backend AND Worker services in Render
- Restart both services after setting variables
- Check variable names for typos

### Issue: Still getting 8192 token limit errors
**Solution:**
- Check that gpt-4 is NOT being used (use gpt-4-turbo instead)
- Verify context guards are active
- Check trace events for actual models being used

### Issue: S1 badge still shows ~1s completion
**Solution:**
- Verify LLM_MODEL_EVIDENCE is set to gpt-4-turbo
- Check that evidence step is actually calling LLM (not cached)
- Monitor trace events for evidence step

## Context Guard Validation

The system should prevent these scenarios:
- ❌ `gpt-4` (8192 ctx) on market/gtm/financial_plan steps
- ❌ `gpt-3.5-turbo` (4096 ctx) on any large step
- ✅ All models should have ctx_max ≥ 100k for critical steps

## Phase Splitting Validation

Expected behavior:
- market, gtm, financial_plan always split into 2 phases
- Phase 1 = data generation (gpt-4o-mini)  
- Phase 2 = narrative generation (gpt-4-turbo)
- Trace shows phase=1 before phase=2
- Phase 2 gets data_from_phase1: true

## Artifact System Validation

Expected behavior:
- artifact_written events only after successful file writes
- Frontend renders links only after receiving artifact_written
- No 404s on artifact links
- Predictable paths: /artifacts/{jobId}/{step}/phase{n}.json
