# Pipeline Enhancements - Robuste & Transparente Pipeline

Diese Dokumentation beschreibt die neuen robusten Pipeline-Features, die für vollständige Transparenz, Fehlerbehandlung und Performance-Optimierung implementiert wurden.

## 🚀 Neue Features Übersicht

### 1. **Erweiterte Trace-System**

- **Datei:** `src/lib/trace-system.ts`
- **API:** `/api/jobs/:id/trace`
- **Features:**
  - Vollständige Nachverfolgung aller LLM-Calls
  - Token-Effizienz-Messung
  - Fehler-Kategorisierung
  - Modell-Performance-Metriken
  - Hash-basierte Reproduzierbarkeit

### 2. **Preflight-System**

- **Datei:** `src/lib/preflight-system.ts`
- **Features:**
  - Token-basierte Prüfungen vor LLM-Calls
  - Deterministisches Kürzen von Sources und Brief
  - Prioritäts-basierte Source-Filterung
  - Trace-Integration für Transparenz

### 3. **Robustes JSON-Handling**

- **Datei:** `src/lib/llm-json.ts`
- **Features:**
  - Automatische JSON-Reparatur mit `jsonrepair`
  - Zod-Schema-Validierung
  - Retry-Mechanismus für Parse-Fehler
  - Strukturierte Error-Responses

### 4. **Context Guards & Hard Limits**

- **Datei:** `src/lib/context-guards.ts`
- **Features:**
  - Harte Guards gegen kleine Context-Windows
  - Erzwungenes Phase-Splitting für große Steps
  - Modell-Capability-Mapping
  - Environment-Variable-basierte Konfiguration

### 5. **Erweiterte SSE-Events**

- **Datei:** `src/routes/jobs.ts` (Zeile 194-218)
- **Features:**
  - Real-time Trace-Event-Streaming
  - Model, Context und Token-Info in Events
  - Artifact-Written-Benachrichtigungen
  - Error-Events mit detaillierten Codes

### 6. **Enhanced Configuration API**

- **Endpoint:** `/api/config`
- **Features:**
  - Vollständige Modell-Routing-Übersicht
  - Context-Window-Informationen pro Modell
  - Rate-Gate-Konfiguration
  - Environment-Variable-Status

## 📊 API Endpoints

### Trace System

```bash
GET /api/jobs/:id/trace              # Vollständige Trace
GET /api/jobs/:id/trace/summary      # Nur Summary-Daten
GET /api/jobs/:id/trace/entries/:step # Step-spezifische Entries
```

### Configuration

```bash
GET /api/config                      # Vollständige Konfiguration
```

### Job Management (erweitert)

```bash
GET /api/jobs/:id/stream            # SSE mit erweiterten Events
GET /api/jobs/:id                   # Status mit Trace-Info
```

## 🔧 Environment Variables

### Modell-Routing

```bash
# Globale Modelle
MODEL_NAME=gpt-4o
MODEL_ANALYZE=gpt-4o-mini
MODEL_REFINE=gpt-4o

# Step-spezifische Modelle
LLM_MODEL_EVIDENCE=gpt-4o
LLM_MODEL_BRIEF=gpt-4o
LLM_MODEL_MARKET=gpt-4o
LLM_MODEL_GTM=gpt-4o
LLM_MODEL_FINANCIAL_PLAN=gpt-4o

# Phase-spezifische Modelle
LLM_MODEL_MARKET_PHASE1=gpt-4o-mini
LLM_MODEL_MARKET_PHASE2=gpt-4o
LLM_MODEL_GTM_PHASE1=gpt-4o-mini
LLM_MODEL_GTM_PHASE2=gpt-4o
```

### Rate Gate & Retries

```bash
# Rate Limiting
RATEGATE_TOKENS_PER_MINUTE=40000
RATEGATE_TOKENS_PER_HOUR=240000
RATEGATE_RESERVE_PERCENTAGE=0.20

# Retry-Verhalten
LLM_RETRIES=3
LLM_RETRY_BASE_DELAY=2000

# Model-spezifische Limits
OPENAI_TPM_GPT4O=50000
OPENAI_TPM_GPT4O_MINI=200000
ANTHROPIC_TPM_SONNET=80000
```

## 📋 Testing & Debugging

### Automatisierte Tests

```bash
# Vollständiger Pipeline-Test
./test-pipeline.sh http://localhost:3001

# Test mit Production URL
./test-pipeline.sh https://your-api.vercel.app
```

### Manual Debugging

```bash
# Health Check
curl http://localhost:3001/health

# Konfiguration prüfen
curl http://localhost:3001/api/config | jq .effective_routing

# Job mit Trace erstellen und verfolgen
JOB_ID=$(curl -s -X POST http://localhost:3001/api/jobs -H "Content-Type: application/json" -d '{"project_title":"Test","elevator_pitch":"Testing robust pipeline"}' | jq -r '.jobId')

# Trace verfolgen
curl http://localhost:3001/api/jobs/$JOB_ID/trace | jq .summary

# SSE Stream testen
curl -N http://localhost:3001/api/jobs/$JOB_ID/stream
```

## 🛠 Implementation Examples

### 1. Preflight Check vor LLM Call

```javascript
import { performPreflight } from "../lib/preflight-system.js";

const sources = preflightSystem.createSources(
  urls,
  [{ content: briefContent }],
  additionalContext,
);

const preflightResult = await performPreflight(
  jobId,
  "gtm",
  "phase1",
  "gpt-4o-mini",
  systemPrompt,
  userPrompt,
  sources,
  brief,
);

if (!preflightResult.ok) {
  throw new Error(`Preflight failed: ${preflightResult.error}`);
}
```

### 2. Robuster JSON LLM Call

```javascript
import { llmJson } from "../lib/llm-json.js";
import { GTMSchema } from "../schemas/gtm.js";

const result = await llmJson(prompt, GTMSchema, {
  model: "gpt-4o",
  temperature: 0.1,
  maxRetries: 3,
  jobId,
  step: "gtm",
  phase: "phase2",
});
```

### 3. Trace Entry hinzufügen

```javascript
import { traceSystem } from "../lib/trace-system.js";

traceSystem.addEntry(jobId, {
  step: "gtm",
  phase: "phase2",
  model: "gpt-4o",
  ctx_max: 128000,
  prompt_tokens_est: 15000,
  truncate_applied: true,
  sources_after_filter: 8,
  rategate_wait_ms: 2500,
  attempts: 1,
  status: "ok",
  raw_text_path: `/tmp/gtm_${Date.now()}.txt`,
  duration_ms: 12500,
  actual_tokens: 14200,
});
```

### 4. Context Guards verwenden

```javascript
import {
  enforceContextRequirements,
  MODEL_CAPABILITIES,
} from "../lib/context-guards.js";

const config = enforceContextRequirements("market", "gpt-4o-mini", 50000);
// Returns: { model: "gpt-4o", forcedUpgrade: true, reason: "context_too_small" }
```

## 📊 Monitoring & Metriken

### Key Metrics verfügbar

- **Token-Effizienz:** Actual vs. Estimated Tokens pro Call
- **Model-Performance:** Durchschnittliche Response-Zeit pro Model
- **Error-Rates:** Fehlerquote pro Step/Phase/Model
- **Context-Utilization:** Token-Nutzung vs. verfügbarem Context
- **Rate-Gate-Impact:** Wartzeiten durch Rate Limiting
- **Truncation-Rate:** Wie oft Sources/Brief gekürzt werden

### Dashboard Queries

```bash
# Token-Effizienz pro Modell
curl http://localhost:3001/api/jobs/JOB_ID/trace | jq '
  [.entries[] | select(.token_efficiency) | {model, efficiency: .token_efficiency}]
  | group_by(.model)
  | map({model: .[0].model, avg_efficiency: (map(.efficiency | rtrimstr("%") | tonumber) | add / length)})'

# Error-Rate pro Step
curl http://localhost:3001/api/jobs/JOB_ID/trace | jq '
  [.entries[] | {step, status}]
  | group_by(.step)
  | map({step: .[0].step, error_rate: (map(select(.status=="error")) | length) / length * 100})'

# Rate-Gate Impact
curl http://localhost:3001/api/jobs/JOB_ID/trace | jq '
  {total_wait_ms: [.entries[].rategate_wait_ms] | add,
   avg_wait_per_call: ([.entries[].rategate_wait_ms] | add / length)}'
```

## 🚨 Error Handling

### Error-Kategorien in Traces

- `UNKNOWN_MODEL`: Model nicht in Capabilities definiert
- `CONTEXT_TOO_SMALL`: Context Window zu klein für Step
- `PROMPT_TOO_LARGE`: Base Prompt überschreitet verfügbaren Context
- `JSON_PARSE_ERROR`: JSON nicht parsebar trotz Reparatur-Versuchen
- `RATE_LIMIT_EXCEEDED`: API Rate Limit trotz Rate Gate
- `VALIDATION_ERROR`: Zod Schema Validation fehlgeschlagen

### Automatic Recovery

- **JSON Parse Errors:** Automatische Reparatur mit `jsonrepair`
- **Context Issues:** Hard Guards upgraden Modell automatisch
- **Rate Limits:** Exponential Backoff mit konfigurierbaren Retries
- **Truncation:** Prioritäts-basierte Source-Reduzierung

## 🔄 Deployment & CI/CD

### Health Checks für Deployment

```bash
# Basic Health
curl -f https://api.example.com/health

# Functional Health
curl -f https://api.example.com/api/config

# Trace System Health
JOB_ID=$(curl -s -X POST https://api.example.com/api/jobs -d '{"project_title":"Health","elevator_pitch":"Check"}' | jq -r '.jobId')
curl -f "https://api.example.com/api/jobs/$JOB_ID/trace"
```

### Vercel Deployment mit Rules

```bash
# Mit GitHub Actions CI/CD und auto-deployment
vercel --prod
# Automatische Tests nach Deployment
./test-pipeline.sh https://your-app.vercel.app
```

## 📈 Performance Tuning

### Optimale Konfiguration

```bash
# Für hohen Durchsatz
RATEGATE_TOKENS_PER_MINUTE=100000
QUEUE_CONCURRENCY=3
LLM_RETRIES=2

# Für hohe Genauigkeit
LLM_MODEL_MARKET=gpt-4o
LLM_MODEL_GTM=gpt-4o
LLM_MODEL_FINANCIAL_PLAN=gpt-4o
```

### Load Testing

```bash
# Multiple Jobs parallel erstellen
for i in {1..5}; do
  curl -X POST http://localhost:3001/api/jobs \
    -d "{\"project_title\":\"Load Test $i\",\"elevator_pitch\":\"Testing load\"}" &
done
wait

# Queue Stats prüfen
curl http://localhost:3001/api/jobs/stats | jq .
```

## 📝 Troubleshooting

Siehe `TROUBLESHOOTING.md` für:

- Häufige Probleme & Lösungen
- Debug-Commands
- Performance-Monitoring
- Emergency-Procedures

## ✅ Definition of Done

Pipeline gilt als **robust und production-ready** wenn:

1. ✅ **Trace-System:** Alle LLM-Calls werden getrackt mit vollständigen Metriken
2. ✅ **Error-Handling:** < 2% unhandled errors, alle Errors kategorisiert
3. ✅ **Performance:** < 30s average response time, > 95% success rate
4. ✅ **Monitoring:** Real-time SSE Events, comprehensive /config endpoint
5. ✅ **Testing:** Automated test suite passes, manual smoke tests OK
6. ✅ **Documentation:** Complete troubleshooting guide, API docs, examples

## 🚀 Next Steps

1. **Run the test suite:** `./test-pipeline.sh`
2. **Monitor production:** Setup alerts on error rates and response times
3. **Optimize:** Use trace data to tune model routing and context management
4. **Scale:** Increase rate limits and concurrency as needed
5. **Enhance:** Add more sophisticated retry strategies and error recovery
