# Pipeline Troubleshooting Guide

Diese Dokumentation hilft bei der Diagnose und Behebung von Problemen in der Pipeline.

## 🚀 Quick Start Debugging

### 1. Basis-Gesundheitscheck

```bash
# Server erreichbar?
curl http://localhost:3001/health

# Erwartete Antwort:
# {"status":"ok","uptime":123.45,"timestamp":"2024-01-01T12:00:00.000Z","version":"..."}
```

### 2. Konfiguration prüfen

```bash
# Aktuelle Konfiguration abrufen
curl http://localhost:3001/api/config | jq .

# Wichtige Bereiche:
# - effective_routing: Welche Modelle werden verwendet?
# - rate_gate: Rate Limiting Konfiguration
# - api_config: API Keys (maskiert)
```

### 3. Pipeline Test ausführen

```bash
# Vollständigen Pipeline-Test starten
chmod +x test-pipeline.sh
./test-pipeline.sh http://localhost:3001
```

## 🔍 Häufige Probleme & Lösungen

### Problem 1: "Trace not found" (404 Error)

**Symptome:**

- `/api/jobs/:id/trace` gibt 404 zurück
- Frontend zeigt "Trace nicht verfügbar"

**Ursachen & Lösungen:**

1. **Job-ID existiert nicht:**

   ```bash
   # Prüfe ob Job existiert
   curl http://localhost:3001/api/jobs/YOUR_JOB_ID

   # Wenn 404: Job wurde nie erstellt oder ist abgelaufen
   ```

2. **Trace-System nicht initialisiert:**

   ```bash
   # Prüfe Server-Logs für:
   # "🔍 [TRACE] Started tracing for job: ..."

   # Wenn fehlt: traceSystem.startTrace() wird nicht aufgerufen
   ```

3. **Memory-Trace verloren (Server Restart):**
   ```bash
   # Traces sind in-memory und gehen bei Restart verloren
   # Lösung: Job neu starten
   ```

**Debugging:**

```javascript
// Im Backend Code prüfen:
import { traceSystem } from "./lib/trace-system.js";

// In Job-Creation:
traceSystem.startTrace(jobId);

// Bei jedem LLM Call:
traceSystem.addEntry(jobId, {
  step: "evidence",
  model: "gpt-4o",
  prompt_tokens_est: 1500,
  // ...
});
```

### Problem 2: JSON Parse Errors in GTM Step

**Symptome:**

- GTM Step schlägt fehl mit "Invalid JSON"
- Frontend zeigt Parse-Fehler

**Debugging:**

```bash
# 1. Trace prüfen für GTM Step
curl http://localhost:3001/api/jobs/JOB_ID/trace/entries/gtm | jq .

# 2. Raw Output prüfen (wenn verfügbar)
curl http://localhost:3001/api/jobs/JOB_ID/artifacts/gtm_raw_output

# 3. Modell-Konfiguration prüfen
curl http://localhost:3001/api/config | jq .effective_routing.gtm
```

**Lösungen:**

1. **Robuster JSON Wrapper verwenden:**

   ```javascript
   import { llmJson } from "../lib/llm-json.js";
   import { GTMSchema } from "../schemas/gtm.js";

   const result = await llmJson(prompt, GTMSchema, {
     model: "gpt-4o",
     temperature: 0.1,
     maxRetries: 3,
   });
   ```

2. **Raw Output speichern für Debugging:**

   ```javascript
   // In LLM Call:
   const rawResponse = await llmCall();

   // Raw speichern für Debugging
   traceSystem.addEntry(jobId, {
     raw_text_path: `/tmp/gtm_raw_${Date.now()}.txt`,
   });
   ```

### Problem 3: Rate Limit Errors

**Symptome:**

- "429 Too Many Requests"
- Sehr langsame API Antworten
- Jobs hängen in "running"

**Debugging:**

```bash
# 1. Rate Gate Status prüfen
curl http://localhost:3001/api/config | jq .rate_gate

# 2. Aktuelle Token-Nutzung prüfen
# (Im Code: rateGate.getStats())
```

**Lösungen:**

1. **Environment Variables anpassen:**

   ```bash
   # .env
   RATEGATE_TOKENS_PER_MINUTE=60000
   RATEGATE_TOKENS_PER_HOUR=300000
   LLM_RETRIES=5
   LLM_RETRY_BASE_DELAY=3000
   ```

2. **Model-spezifische Limits:**
   ```bash
   OPENAI_TPM_GPT4O_MINI=200000
   OPENAI_TPM_GPT4O=80000
   ANTHROPIC_TPM_SONNET=100000
   ```

### Problem 4: Context Length Exceeded

**Symptome:**

- "Context length exceeded" Fehler
- Large Steps (market, gtm, financial_plan) schlagen fehl

**Debugging:**

```bash
# 1. Preflight-System Logs prüfen
# Server-Logs für: "🚀 [PREFLIGHT]"

# 2. Token-Schätzung prüfen
curl http://localhost:3001/api/jobs/JOB_ID/trace | jq '.entries[] | select(.step=="market") | {step, ctx_max, prompt_tokens_est, truncate_applied}'
```

**Lösungen:**

1. **Hard Guards aktivieren:**

   ```bash
   # .env - Erzwinge große Modelle für große Steps
   LLM_MODEL_MARKET=gpt-4o
   LLM_MODEL_GTM=gpt-4o
   LLM_MODEL_FINANCIAL_PLAN=gpt-4o
   ```

2. **Phase-Splitting erzwingen:**

   ```javascript
   // Context Guards prüfen
   import { enforceContextRequirements } from "./lib/context-guards.js";

   const config = enforceContextRequirements(step, model, estimatedTokens);
   ```

### Problem 5: SSE Stream Issues

**Symptome:**

- Frontend bekommt keine Live-Updates
- Stream verbindet nicht oder bricht ab

**Debugging:**

```bash
# 1. Manual SSE Test
curl -N http://localhost:3001/api/jobs/JOB_ID/stream

# 2. Browser Network Tab prüfen
# - Stream verbindung ok?
# - Events kommen an?
```

**Lösungen:**

1. **CORS Headers prüfen:**

   ```javascript
   // In SSE Response:
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "Cache-Control",
   ```

2. **Client Disconnect Handling:**
   ```javascript
   req.raw.on("close", () => {
     clearInterval(pollInterval);
   });
   ```

## 🛠 Debugging Tools

### 1. Trace Inspector

```bash
# Vollständige Trace mit Debug Info
curl http://localhost:3001/api/jobs/JOB_ID/trace | jq '{
  job_id,
  status,
  summary,
  debug,
  recent_errors: [.entries[] | select(.status=="error") | {step, phase, error_code, error_message}]
}'
```

### 2. Model Performance Analyzer

```bash
# Modell-Performance pro Step
curl http://localhost:3001/api/jobs/JOB_ID/trace | jq '{
  models: [.entries[] | {step, phase, model, duration_ms, token_efficiency}] | group_by(.model) | map({model: .[0].model, avg_duration: (map(.duration_ms) | add / length)})
}'
```

### 3. Token Usage Monitor

```bash
# Token-Effizienz prüfen
curl http://localhost:3001/api/jobs/JOB_ID/trace | jq '.entries[] | {
  step,
  phase,
  estimated: .prompt_tokens_est,
  actual: .actual_tokens,
  efficiency: .token_efficiency,
  truncated: .truncate_applied
}'
```

### 4. Error Pattern Analysis

```bash
# Häufige Fehler-Muster
curl http://localhost:3001/api/jobs/stats | jq '{
  total_jobs: .completed + .failed + .running,
  success_rate: (.completed / (.completed + .failed) * 100),
  avg_duration: .averageJobDuration
}'
```

## 🚨 Emergency Debugging

### Server komplett debuggen

```bash
# 1. Alle aktuellen Jobs auflisten
curl http://localhost:3001/api/jobs/stats | jq .

# 2. Health Check aller Systeme
curl http://localhost:3001/api/jobs/health | jq .

# 3. Rate Gate Status
curl http://localhost:3001/api/config | jq .rate_gate

# 4. Environment Check
curl http://localhost:3001/api/config | jq .api_config
```

### Performance Monitoring

```bash
# Script für kontinuierliches Monitoring
watch -n 5 'curl -s http://localhost:3001/api/jobs/stats | jq "{running: .running, queued: .queued, errors: .failed}"'
```

## 📊 Metriken & Monitoring

### Key Performance Indicators (KPIs)

```bash
# Job Success Rate
curl http://localhost:3001/api/jobs/stats | jq '(.completed / (.completed + .failed)) * 100'

# Average Response Time
curl http://localhost:3001/api/jobs/JOB_ID/trace | jq '.entries | map(.duration_ms) | add / length'

# Token Efficiency
curl http://localhost:3001/api/jobs/JOB_ID/trace | jq '.entries[] | select(.token_efficiency) | .token_efficiency' | grep -o '[0-9]*' | awk '{sum+=$1} END {print sum/NR "%"}'

# Error Rate per Model
curl http://localhost:3001/api/jobs/JOB_ID/trace | jq '[.entries[] | {model, status}] | group_by(.model) | map({model: .[0].model, error_rate: (map(select(.status=="error")) | length) / length * 100})'
```

### Health Checks für CI/CD

```bash
# Minimal Health Check
if curl -f http://localhost:3001/health >/dev/null 2>&1; then
    echo "✅ Server OK"
else
    echo "❌ Server DOWN"
    exit 1
fi

# Functional Test
JOB_ID=$(curl -s -X POST http://localhost:3001/api/jobs -H "Content-Type: application/json" -d '{"project_title":"Test","elevator_pitch":"Test"}' | jq -r '.jobId')
if [ "$JOB_ID" != "null" ]; then
    echo "✅ Job Creation OK"
    if curl -f "http://localhost:3001/api/jobs/$JOB_ID/trace" >/dev/null 2>&1; then
        echo "✅ Trace System OK"
    else
        echo "❌ Trace System FAILED"
    fi
else
    echo "❌ Job Creation FAILED"
fi
```

## 🔧 Common Fixes

### Fix 1: Trace System Reset

```javascript
// Im Server Code:
import { traceSystem } from "./lib/trace-system.js";

// Cleanup alte Traces
traceSystem.cleanup();

// Job Trace neu starten
traceSystem.startTrace(jobId);
```

### Fix 2: Rate Gate Reset

```javascript
import { rateGate } from "./lib/rate-gate.js";

// Alle Budgets zurücksetzen
rateGate.reset();
```

### Fix 3: Context Guards Bypass (Notfall)

```bash
# Temporär größere Modelle erzwingen
export LLM_DEFAULT_MODEL=claude-3-5-sonnet
export LLM_MODEL_MARKET=claude-3-5-sonnet
export LLM_MODEL_GTM=claude-3-5-sonnet
```

## 📞 Support & Escalation

### Log Files zu prüfen

- Server Console Output
- SSE Connection Logs
- Rate Gate Warnings
- Context Guard Violations
- LLM API Errors

### Eskalations-Kriterien

- Success Rate < 80%
- Average Response Time > 30s
- Multiple Context Length Errors
- Rate Limit Errors trotz korrekter Config

### Debug Information sammeln

```bash
# Kompletten Debug-Report generieren
{
  echo "=== System Health ==="
  curl -s http://localhost:3001/health | jq .

  echo "=== Configuration ==="
  curl -s http://localhost:3001/api/config | jq .effective_routing

  echo "=== Queue Stats ==="
  curl -s http://localhost:3001/api/jobs/stats | jq .

  echo "=== Recent Job Trace ==="
  curl -s http://localhost:3001/api/jobs/YOUR_LATEST_JOB_ID/trace | jq .summary
} > debug_report_$(date +%Y%m%d_%H%M%S).json
```
