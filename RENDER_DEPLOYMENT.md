# Render Deployment Guide - Background Worker System

## System Architecture

Das Backend verwendet jetzt ein Job Queue System mit Redis für asynchrone Pipeline-Verarbeitung:

- **Web Service**: Erstellt Jobs und liefert Status-Updates (API + SSE)
- **Background Worker**: Verarbeitet Pipeline-Jobs asynchron
- **Redis Queue**: Job-Koordination und Status-Tracking

## Deployment Steps

### 1. Redis Service Setup

Zuerst einen Redis Service bei Render erstellen:

1. Gehe zu Render Dashboard → "New" → "Redis"
2. Name: `aigilexperience-redis`
3. Plan: Starter ($7/month)
4. Region: Wähle die gleiche Region wie dein Backend
5. Memory Policy: allkeys-lru
6. Deploy

**Wichtig**: Notiere dir die **Internal Redis URL** (beginnt mit `redis://` und endet mit `:6379`)

### 2. Backend Service Update

Aktualisiere deinen bestehenden Backend Service:

1. Gehe zu deinem Backend Service → Settings → Environment
2. Füge hinzu:
   - `REDIS_URL` = `<Internal Redis URL vom Redis Service>`

3. Deploy den Service neu (oder warte auf automatisches Deployment)

### 3. Background Worker Service

Erstelle einen **neuen** Background Worker Service:

1. Gehe zu Render Dashboard → "New" → "Background Worker"
2. Repository: Wähle dein GitHub Repository `AigileXperience`
3. Name: `aigilexperience-worker`
4. Region: **Gleiche Region wie Backend und Redis**
5. Root Directory: `apps/backend`
6. Build Command: `npm run build`
7. Start Command: `node dist/worker.js`

**Environment Variables** (alle vom Backend Service kopieren):

```
REDIS_URL=<Internal Redis URL>
OPENAI_API_KEY=<dein key>
ANTHROPIC_API_KEY=<dein key>
MODEL_ANALYZE=gpt-4-turbo-preview
MODEL_REFINE=claude-3-5-sonnet-20241022
USE_ASSUMPTIONS_LLM=gpt-4-turbo-preview
NODE_ENV=production
```

8. Instance Type: Starter ($7/month)
9. Deploy

## Environment Variables Summary

### Backend Web Service

- `REDIS_URL` - Redis connection string
- Alle bestehenden API Keys und Model-Konfigurationen

### Background Worker

- `REDIS_URL` - **Gleiche** Redis connection string
- Alle Model-API-Keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
- Alle Model-Konfigurationen (MODEL_ANALYZE, MODEL_REFINE, etc.)

## API Changes

### Neue Job-basierte API

**Job erstellen:**

```bash
POST /api/jobs
Content-Type: application/json

{
  "project_title": "My Startup",
  "industry": "HealthTech",
  "target_market": "B2B",
  "funding_stage": "Seed",
  "funding_amount": "500000",
  "team_size": "5",
  "revenue_stage": "pre_revenue",
  "business_model": "SaaS",
  "tech_description": "AI-powered patient management system"
}
```

**Response:**

```json
{
  "success": true,
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "queued"
}
```

**Job Status abfragen:**

```bash
GET /api/jobs/123e4567-e89b-12d3-a456-426614174000
```

**Response:**

```json
{
  "success": true,
  "job": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "running",
    "progress": {
      "step": "evidence_harvesting",
      "percentage": 25,
      "currentStep": 2,
      "totalSteps": 7
    },
    "createdAt": 1234567890123,
    "startedAt": 1234567890500
  }
}
```

**Live Updates (SSE):**

```bash
GET /api/jobs/123e4567-e89b-12d3-a456-426614174000/stream
Accept: text/event-stream
```

## System Monitoring

### Health Checks

- **Backend**: `https://your-backend.onrender.com/health`
- **Worker**: Render überwacht automatisch den Prozess

### Logs

- **Backend Logs**: Render Dashboard → dein Backend Service → Logs
- **Worker Logs**: Render Dashboard → dein Worker Service → Logs
- **Redis Logs**: Render Dashboard → dein Redis Service → Logs

### Queue Statistics

```bash
GET /api/jobs/stats
```

```json
{
  "success": true,
  "stats": {
    "pending": 2,
    "processing": 1
  }
}
```

## Troubleshooting

### Worker startet nicht

- Überprüfe `REDIS_URL` Environment Variable
- Schaue in Worker Logs nach Fehlermeldungen
- Stelle sicher, dass alle API Keys gesetzt sind

### Jobs werden nicht verarbeitet

- Überprüfe Redis Service Status
- Schaue in Worker Logs nach Pipeline-Fehlern
- Prüfe ob REDIS_URL in Backend und Worker identisch ist

### Timeout Probleme

- Worker hat 30min Timeout (viel länger als Web Service)
- Pipeline läuft jetzt asynchron, keine 502 Timeouts mehr

### Redis Memory Issues

- Alte Jobs werden nach 24h automatisch gelöscht
- Bei Problemen Redis Service neustarten

## Kosten

- **Redis**: $7/Monat (Starter Plan)
- **Worker**: $7/Monat (Starter Plan)
- **Backend**: Bestehende Kosten (unverändert)

**Total zusätzlich**: $14/Monat für Background Processing

## Deploy Command

Nach dem Setup kannst du über Git normal deployen:

```bash
git add .
git commit -m "Added background worker system"
git push origin main
```

Render deployed automatisch:

1. Backend Service (Web)
2. Background Worker Service
3. Redis läuft kontinuierlich

## Testing

Nach dem Deployment teste das System:

```bash
# Job erstellen
curl -X POST https://your-backend.onrender.com/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "project_title": "Test Startup",
    "industry": "Tech",
    "target_market": "B2C",
    "funding_stage": "Pre-Seed"
  }'

# Status überprüfen (ersetze JOB_ID)
curl https://your-backend.onrender.com/api/jobs/JOB_ID

# Live Updates (im Browser)
https://your-backend.onrender.com/api/jobs/JOB_ID/stream
```

## Migration von alter API

Die alte `/api/v2/auto` Route funktioniert weiterhin, ist aber für Produktion nicht empfohlen wegen Timeout-Problemen. Migriere Frontend zur neuen Job-basierten API.
