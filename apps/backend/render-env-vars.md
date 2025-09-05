# Render Environment Variables - GPT-4 Configuration

Diese Environment Variables müssen in Render gesetzt werden, um sicherzustellen, dass GPT-4 (nicht gpt-4o-mini) verwendet wird:

## 🎯 Wichtige Model-Konfiguration für GPT-4

```bash
# Global Default - Wichtig: GPT-4 als Standard
MODEL_ANALYZE=gpt-4
MODEL_REFINE=gpt-4
LLM_DEFAULT_MODEL=gpt-4

# Step-spezifische Models (V2 Pipeline)
LLM_MODEL_EVIDENCE=gpt-4
LLM_MODEL_BRIEF=gpt-4
LLM_MODEL_PROBLEM=gpt-4
LLM_MODEL_SOLUTION=gpt-4
LLM_MODEL_TEAM=gpt-4
LLM_MODEL_MARKET=gpt-4
LLM_MODEL_BUSINESS_MODEL=gpt-4
LLM_MODEL_COMPETITION=gpt-4
LLM_MODEL_STATUS_QUO=gpt-4
LLM_MODEL_GTM=gpt-4
LLM_MODEL_FINANCIAL_PLAN=gpt-4
LLM_MODEL_INVESTOR_SCORE=gpt-4
```

## 🛡️ RateGate Konfiguration für GPT-4

```bash
# Token Limits für GPT-4 - Konservativ eingestellt
RATEGATE_TOKENS_PER_MINUTE=40000
RATEGATE_TOKENS_PER_DAY=1000000
RATEGATE_TOKENS_PER_HOUR=240000
RATEGATE_RESERVE_PERCENTAGE=0.20
RATEGATE_MIN_TOKENS_FOR_REQUEST=1000
RATEGATE_STATS_INTERVAL_MS=30000
```

## 🔧 Optional: Phase-spezifische Models

Falls du für große Steps Cost-Optimierung willst (Data-Generation mit Mini, Narrative mit GPT-4):

```bash
# Für financial_plan Step
LLM_MODEL_FINANCIAL_PLAN_PHASE1=gpt-4o-mini  # Daten/Zahlen
LLM_MODEL_FINANCIAL_PLAN_PHASE2=gpt-4        # Narrative

# Für market Step
LLM_MODEL_MARKET_PHASE1=gpt-4o-mini
LLM_MODEL_MARKET_PHASE2=gpt-4

# Für gtm Step
LLM_MODEL_GTM_PHASE1=gpt-4o-mini
LLM_MODEL_GTM_PHASE2=gpt-4
```

## 🚨 Was passiert ohne diese Variables?

**Ohne die Variables fällt das System zurück auf:**

1. `MODEL_NAME` (falls gesetzt)
2. Hardcoded Default: `gpt-4o` (nicht GPT-4!)

## 📋 In Render setzen

1. Gehe zu deiner Render Service-Konfiguration
2. Environment → Add Variable
3. Setze jede Variable einzeln (Name = KEY, Value = VALUE)
4. Redeploy der App

## 🔍 Logs zur Verifikation

Nach dem Deployment solltest du in den Logs sehen:

```
🤖 [LLM] ChatComplete called: { model: 'gpt-4', provider: 'openai', ... }
🤖 [STEP] evidence: Using model gpt-4 (from LLM_MODEL_EVIDENCE env var)
🔥 [LLM] Making OpenAI API call: { model: 'gpt-4', ... }
✅ [LLM] OpenAI API call successful: { model: 'gpt-4', duration: '4523ms', ... }
```

**Warnsignal**: Falls du siehst `model: 'gpt-4o-mini'` oder `duration: '1234ms'` (sehr kurz), dann werden die Environment Variables nicht richtig gelesen.

## ⚡ Quick Test

Um zu verifizieren, dass GPT-4 wirklich genutzt wird:

1. Setze `LLM_MODEL_EVIDENCE=gpt-4` in Render
2. Redeploy
3. Starte einen Job
4. Schau in die Logs: S1 (Evidence) sollte **mehrere Sekunden** dauern (nicht 1-2 Sekunden)
5. Du solltest sehen: `🤖 [STEP] evidence: Using model gpt-4 (from LLM_MODEL_EVIDENCE env var)`

---

**💡 Tipp**: Start mit den wichtigsten Steps (evidence, market, financial_plan) auf GPT-4, die anderen kannst du später optimieren.
