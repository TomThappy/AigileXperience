# Debug Scripts for LLM Pipeline Tracing

This directory contains debugging tools to help identify and resolve issues with model routing and pipeline execution.

## Scripts Overview

### 1. `test-config.sh` - Configuration Debug Endpoint
Tests the `/api/config` endpoint which shows the effective runtime configuration including:
- All environment variables for model routing
- Effective model resolution for each step
- RateGate configuration
- Masked API keys
- Current environment status

**Usage:**
```bash
./test-config.sh
```

### 2. `test-job-with-trace.sh` - Job Creation and Trace Test
Creates a test job and checks for trace data. This helps verify:
- Job creation is working
- Trace system is recording data
- Basic job status endpoints

**Usage:**
```bash
./test-job-with-trace.sh
```

### 3. `test-sse-stream.sh` - Server-Sent Events Stream Monitor
Monitors a job's real-time execution via SSE with enhanced trace events. Shows:
- Job status updates
- Live trace events with model info
- Final trace summary
- Error events

**Usage:**
```bash
./test-sse-stream.sh <JOB_ID>
```

## Troubleshooting Workflow

### Step 1: Check Configuration
```bash
./test-config.sh
```

Look for these key indicators:
- **effective_routing** section shows which models are actually being used
- **step_models** shows if your `LLM_MODEL_*` env vars are set
- **api_config** confirms API keys are loaded (shows first 10 chars)
- **rate_gate** shows token limits and settings

### Step 2: Create Test Job and Monitor
```bash
./test-job-with-trace.sh
```

This will:
1. Create a test job with `skip_cache: true` for fresh execution
2. Show the job ID for monitoring
3. Attempt to fetch initial trace data
4. Provide commands for real-time monitoring

### Step 3: Monitor Job Execution in Real-Time
```bash
./test-sse-stream.sh job_<ID>
```

Watch for these patterns:
- **Fast execution (~1s)** on steps like "evidence" suggests wrong model (gpt-4o-mini instead of gpt-4)
- **Token limit errors (8192)** indicate gpt-4o-mini is being used instead of gpt-4
- **Trace events** showing `model: "gpt-4"` confirm correct model usage
- **Context windows** should show 128000+ for gpt-4, 8192 for gpt-4o-mini

## Expected Model Usage

Based on current configuration priorities:

| Step | Expected Model | Phase 1 | Phase 2 |
|------|----------------|---------|---------|
| evidence | gpt-4 | - | - |
| brief | gpt-4 | - | - |
| problem | gpt-4o-mini | - | - |
| solution | gpt-4o-mini | - | - |
| team | gpt-4o-mini | - | - |
| market | gpt-4 | gpt-4o-mini | gpt-4 |
| business_model | gpt-4 | - | - |
| competition | gpt-4o-mini | - | - |
| status_quo | gpt-4o-mini | - | - |
| gtm | gpt-4o-mini | gpt-4o-mini | gpt-4 |
| financial_plan | gpt-4 | gpt-4o-mini | gpt-4 |
| investor_score | gpt-4 | - | - |

## Common Issues and Solutions

### Issue: All steps using gpt-4o-mini despite env vars
**Symptoms:**
- Config shows `LLM_MODEL_*` vars as null
- Fast execution times on evidence step
- Token limit errors on market/gtm/financial_plan

**Solutions:**
1. Verify env vars are set in Render dashboard for both Backend and Worker services
2. Restart both services after setting env vars
3. Check for typos in env var names (should be `LLM_MODEL_EVIDENCE`, not `LLM_MODEL_EXECUTIVE`)

### Issue: Environment variables not loading
**Symptoms:**
- Config endpoint shows all env vars as null
- Effective routing shows default/fallback models

**Solutions:**
1. Check if services are reading from correct environment
2. Verify Render environment variable propagation
3. Test locally with `.env` file to confirm code works

### Issue: Trace data not appearing
**Symptoms:**
- Trace endpoint returns 404
- SSE stream shows no trace events

**Solutions:**
1. Ensure trace system is properly integrated in job processor
2. Check that job IDs match between creation and trace requests
3. Verify trace system singleton is working correctly

### Issue: Context window/token limit errors
**Symptoms:**
- Errors mentioning 8192 token limit
- "Maximum context length exceeded" errors

**Solutions:**
1. Confirm gpt-4 models are being used for large steps
2. Check effective model routing in config
3. Verify phase-specific model overrides are working

## Example Output

### Successful Config Check
```json
{
  "effective_routing": {
    "evidence": "gpt-4",
    "brief": "gpt-4",
    "market": "gpt-4",
    "financial_plan": "gpt-4"
  },
  "step_models": {
    "LLM_MODEL_EVIDENCE": "gpt-4",
    "LLM_MODEL_BRIEF": "gpt-4",
    "LLM_MODEL_MARKET": "gpt-4",
    "LLM_MODEL_FINANCIAL_PLAN": "gpt-4"
  }
}
```

### Successful Trace Event
```json
{
  "step": "evidence",
  "phase": null,
  "model": "gpt-4",
  "context_window": 128000,
  "estimated_tokens": 2500,
  "status": "success",
  "attempts": 1
}
```

## Integration with CI/CD

These scripts can be integrated into your GitHub Actions workflow for automated testing:

```yaml
- name: Test Configuration Debug
  run: ./debug-scripts/test-config.sh

- name: Test Job Processing
  run: ./debug-scripts/test-job-with-trace.sh
```

## Next Steps

If issues persist after using these tools:

1. **Check logs** in Render dashboard for both Backend and Worker services
2. **Verify environment variable propagation** between services
3. **Test model-specific endpoints** directly with cURL
4. **Add additional trace points** in StepProcessor for deeper debugging
5. **Create model guards** to prevent 8k-token models on large steps

The trace system provides comprehensive insight into the pipeline execution, making it easier to identify exactly where model routing goes wrong and fix the underlying configuration issues.
