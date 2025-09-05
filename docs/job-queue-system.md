# Async Job Queue System

## Overview

Das neue Job Queue System löst das 502 Gateway Timeout Problem durch asynchrone Verarbeitung der LLM-Pipeline außerhalb der HTTP-Request-Grenzen.

## Architektur

```
Frontend  →  Web Service  →  Redis Queue  →  Background Worker  →  LLM APIs
   ↓            ↓              ↓               ↓                    ↓
 polling     job creation   job storage    pipeline exec      AI processing
```

## API Endpoints

### Job erstellen

```bash
POST /api/jobs
Content-Type: application/json

{
  "project_title": "TestApp",
  "elevator_pitch": "Eine innovative App...",
  "language": "de",
  "skip_cache": false,
  "parallel_limit": 2
}

→ Response (202 Accepted):
{
  "jobId": "uuid-string",
  "status": "queued",
  "message": "Job created successfully..."
}
```

### Job Status abfragen

```bash
GET /api/jobs/{jobId}

→ Response:
{
  "jobId": "uuid-string",
  "status": "running|queued|completed|failed",
  "progress": {
    "step": "evidence_harvesting",
    "percentage": 45,
    "currentStep": 3,
    "totalSteps": 15
  },
  "artifacts": {
    "pitch": { "type": "evidence", "hash": "...", "timestamp": ... },
    "sources": { "type": "evidence", "hash": "...", "timestamp": ... }
  },
  "result": { ... } // Nur bei status="completed"
}
```

### Real-time Updates (Server-Sent Events)

```bash
GET /api/jobs/{jobId}/stream

→ SSE Stream:
event: status
data: {"jobId":"...","status":"running","progress":{"step":"brief_extraction","percentage":35}}

event: status
data: {"jobId":"...","status":"running","progress":{"step":"section_problem","percentage":45}}

event: result
data: {"success":true,"data":{...}}

event: done
data: {"status":"completed"}
```

### Artifact-Daten abrufen

```bash
GET /api/jobs/{jobId}/artifacts/{artifactName}

→ Response:
{
  "name": "brief",
  "type": "brief",
  "data": { ... }, // Vollständige Artifact-Daten
  "hash": "sha256...",
  "timestamp": 1704672000000
}
```

## Frontend Integration

### JavaScript/TypeScript Beispiel

```typescript
// Job erstellen
const response = await fetch("/api/jobs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    project_title: "TestApp",
    elevator_pitch: "Eine innovative App...",
  }),
});

const { jobId } = await response.json();

// Option 1: Polling
const checkProgress = async () => {
  const status = await fetch(`/api/jobs/${jobId}`).then((r) => r.json());

  if (status.status === "completed") {
    console.log("Fertig!", status.result);
    return;
  }

  if (status.status === "failed") {
    console.error("Fehler:", status.error);
    return;
  }

  console.log(
    `Progress: ${status.progress.percentage}% - ${status.progress.step}`,
  );
  setTimeout(checkProgress, 2000); // Poll alle 2 Sekunden
};

checkProgress();

// Option 2: Server-Sent Events
const eventSource = new EventSource(`/api/jobs/${jobId}/stream`);

eventSource.addEventListener("status", (event) => {
  const data = JSON.parse(event.data);
  console.log(`Progress: ${data.progress.percentage}% - ${data.progress.step}`);
});

eventSource.addEventListener("result", (event) => {
  const result = JSON.parse(event.data);
  console.log("Pipeline completed:", result);
  eventSource.close();
});

eventSource.addEventListener("error", (event) => {
  console.error("Error:", event.data);
  eventSource.close();
});
```

## Deployment

### Render Configuration

Du brauchst **2 Services** auf Render:

#### 1. Web Service (Existing)

- **Name**: aigilexperience-backend
- **Build Command**: `npm run build`
- **Start Command**: `node dist/server.js`
- **Environment Variables**: Alle existierenden + `REDIS_URL`

#### 2. Background Worker (New)

- **Service Type**: Background Worker
- **Name**: aigilexperience-worker
- **Build Command**: `npm run build`
- **Start Command**: `node dist/worker.js`
- **Environment Variables**: Alle existierenden + `REDIS_URL`

#### 3. Redis Instance

- **Add-on**: Render Redis oder externes Upstash Redis
- **Environment Variable**: `REDIS_URL` in beiden Services

### Environment Variables

Zusätzlich zu den existierenden Keys brauchst du:

```bash
# Redis Connection (wird automatisch von Render Redis gesetzt)
REDIS_URL=redis://...

# Optional: Für externe Redis Services
REDISCLOUD_URL=redis://...
```

## Monitoring & Debugging

### Health Checks

```bash
# Job System Status
GET /api/jobs/health

# Queue Statistiken
GET /api/jobs/stats
```

### Logging

Der Worker loggt detailliert:

```
🚀 Pipeline Worker started, waiting for jobs...
🎯 Processing job abc-123: TestApp
📊 Job abc-123: evidence_harvesting (10%) - Step 1/15
📄 Job abc-123: Saved artifact pitch (evidence)
✅ Job abc-123 completed successfully
```

## Troubleshooting

### Häufige Probleme

1. **Redis Connection Error**
   - Prüfe `REDIS_URL` Environment Variable
   - Stelle sicher, dass Redis Service läuft

2. **Jobs bleiben in 'queued' Status**
   - Background Worker läuft nicht
   - Starte Worker-Service neu

3. **Jobs schlagen fehl**
   - Check Worker-Logs für spezifische Fehler
   - LLM API Keys verfügbar?
   - Rate Limits erreicht?

4. **SSE Connection Problems**
   - Browser/Proxy blockiert EventSource?
   - Fallback auf Polling verwenden

### Performance Tuning

```javascript
// Anpassbare Parameter beim Job erstellen:
{
  "parallel_limit": 2,        // Max gleichzeitige LLM-Calls
  "timeout_ms": 300000,       // 5 Min Worker-Timeout
  "skip_cache": false         // Cache bypassen
}
```

## Migration

### Bestehende API Kompatibilität

Die alten Endpoints (`/api/v2/auto`, `/api/v2/dossier/generate`) funktionieren weiter, haben aber weiterhin Timeout-Probleme. Für neue Implementierungen nutze das Job Queue System:

**Alt (mit Timeout-Risiko):**

```bash
POST /api/v2/auto → 502 Gateway Timeout nach 30s
```

**Neu (ohne Timeout):**

```bash
POST /api/jobs → 202 Accepted sofort
GET /api/jobs/{id} → Progress-Updates
GET /api/jobs/{id}/stream → Real-time Updates
```

Das neue System ist production-ready und löst das Hauptproblem der Gateway-Timeouts dauerhaft.
