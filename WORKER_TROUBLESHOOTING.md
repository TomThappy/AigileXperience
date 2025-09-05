# Render Background Worker - Troubleshooting Guide

## Common Worker Deployment Issues

### 1. "Failed Deploy" Error

#### Häufigste Ursachen:

**Environment Variables fehlen**

```bash
❌ Missing required environment variables: REDIS_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY
```

**Lösung:**

- Gehe zu Render Dashboard → dein Worker Service → Settings → Environment
- Kopiere **alle** Environment Variables vom Backend Service:
  - `REDIS_URL` (wichtig: Internal Redis URL verwenden)
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `MODEL_ANALYZE`
  - `MODEL_REFINE`
  - `USE_ASSUMPTIONS_LLM`
  - `NODE_ENV=production`

#### Build Command Problems

**Falsche Konfiguration:**

```
❌ Build Command: npm install && npm run build
❌ Start Command: npm start
❌ Root Directory: / oder leer
```

**Korrekte Konfiguration:**

```
✅ Root Directory: apps/backend
✅ Build Command: npm run build
✅ Start Command: node dist/worker.js
```

#### Redis Connection Issues

**Symptom:** Worker startet, aber kann sich nicht zu Redis verbinden

```bash
❌ Service initialization failed: Redis connection error
```

**Lösung:**

1. Überprüfe, dass Redis Service läuft (Render Dashboard → Redis Service → Status)
2. Verwende **Internal Redis URL**, nicht External URL
3. Redis URL Format: `redis://red-xxxxx:6379` (ohne Username/Password bei Render Redis)

### 2. Worker startet, aber verarbeitet keine Jobs

#### Redis Queue nicht erreichbar

```bash
🔌 Testing Redis connection...
❌ Service initialization failed: connect ECONNREFUSED
```

**Debug Steps:**

1. Teste Redis URL im Backend Service:

   ```bash
   # In Backend Logs schauen nach:
   ✅ Redis connection successful
   ```

2. Vergleiche REDIS_URL zwischen Backend und Worker:
   - Backend: Settings → Environment → REDIS_URL
   - Worker: Settings → Environment → REDIS_URL
   - **Müssen identisch sein!**

#### Missing API Keys

```bash
🚀 Pipeline Worker starting...
❌ Missing required environment variables: OPENAI_API_KEY
```

**Lösung:** Alle API Keys vom Backend Service kopieren.

### 3. Worker läuft, aber Jobs schlagen fehl

#### Pipeline Import Errors

```bash
❌ Job 123 failed with error: Cannot find module '../v2/pipeline/PipelineManager.js'
```

**Ursache:** Build-Probleme oder falsche Root Directory

**Lösung:**

1. Root Directory: `apps/backend` (nicht `/` oder leer)
2. Build Command: `npm run build` (nicht `npm install && npm run build`)
3. Check Build Logs auf TypeScript Errors

#### Memory/Timeout Issues

```bash
❌ Job 123 failed with error: Request timeout
```

**Render Background Worker Limits:**

- **Memory**: 512MB (Starter) - 4GB (Pro)
- **CPU**: Shared
- **Runtime**: Unbegrenzt (kein 30s Limit wie Web Services)

**Upgrade bei Bedarf:**

- Render Dashboard → Worker Service → Settings → Instance Type → Upgrade

### 4. Environment Variables Debug

#### Worker Startup Validation

Der verbesserte Worker zeigt beim Start alle Environment Variables:

```bash
🚀 Pipeline Worker starting...
✅ Environment validation passed
📍 Redis URL: redis://***@redis-service:6379
🔑 OpenAI API Key: ✅ Set
🔑 Anthropic API Key: ✅ Set
🔧 Initializing services...
🔌 Testing Redis connection...
✅ Redis connection successful
🎯 Worker ready, waiting for jobs...
```

#### Wenn Validation fehlschlägt:

```bash
❌ Missing required environment variables: REDIS_URL
💥 Worker startup failed: Error: Missing required environment variables
```

**Sofortiger Fix:**

1. Render Dashboard → Worker Service → Settings → Environment
2. Add Variable: `REDIS_URL` = `<Internal Redis URL from Redis Service>`
3. Restart Service

### 5. Redis Service Setup Issues

#### Redis Service erstellen

```
Render Dashboard → New → Redis
- Name: aigilexperience-redis
- Plan: Starter ($7/month)
- Region: SAME as Backend/Worker
- Memory Policy: allkeys-lru
```

#### Internal vs External URLs

- **Internal URL**: `redis://red-xxxxx:6379` ✅ (für Backend/Worker)
- **External URL**: `redis://user:pass@xxx.render.com:6380` ❌ (nur für externe Clients)

**In Environment Variables verwenden:**

```
REDIS_URL=redis://red-xxxxx:6379
```

(die genaue URL findest du im Redis Service → Connect)

### 6. Monitoring & Debugging

#### Live Worker Logs

```bash
# Render Dashboard → Worker Service → Logs
# Gesunde Worker Logs sollten zeigen:

🚀 Pipeline Worker starting...
✅ Environment validation passed
✅ Redis connection successful
🎯 Worker ready, waiting for jobs...

# Bei Job Processing:
🎯 Processing job abc123: My Startup
📊 Job abc123: evidence_harvesting (20%) - Step 2/7
✅ Job abc123 completed successfully
```

#### Testing the Queue

```bash
# Backend Logs sollten zeigen:
✅ Created job abc123 for project: My Startup

# Worker Logs sollten zeigen:
🎯 Processing job abc123: My Startup
```

### 7. Performance Tuning

#### Worker Instance Sizing

- **Starter ($7/month)**: 512MB RAM - gut für 1-2 parallele Jobs
- **Standard ($25/month)**: 2GB RAM - gut für mehr parallele Jobs
- **Pro ($85/month)**: 4GB RAM - für hohe Last

#### Redis Sizing

- **Starter ($7/month)**: 25MB - gut für Development/Testing
- **Standard ($15/month)**: 100MB - gut für Production
- **Pro ($25/month)**: 500MB - für hohe Job-Volumes

### 8. Manual Restart Commands

#### Service Restarts

1. **Redis Service**: Render Dashboard → Redis Service → Manual Deploy
2. **Backend Service**: Render Dashboard → Backend Service → Manual Deploy
3. **Worker Service**: Render Dashboard → Worker Service → Manual Deploy

#### Order beim Restart:

1. Redis zuerst
2. Dann Backend
3. Dann Worker

### 9. Local Testing

#### Test Worker lokal

```bash
cd apps/backend

# Environment setup
export REDIS_URL="redis://localhost:6379"  # oder deine Redis URL
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-..."

# Start worker
npm run worker

# Should show:
🚀 Pipeline Worker starting...
✅ Environment validation passed
🔌 Testing Redis connection...
✅ Redis connection successful
🎯 Worker ready, waiting for jobs...
```

#### Create Test Job

```bash
# In another terminal:
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "project_title": "Test Startup",
    "industry": "Tech"
  }'

# Worker should process the job
```

### 10. Contact & Escalation

Wenn alle Troubleshooting-Schritte fehlschlagen:

1. **Render Support** kontaktieren mit:
   - Service Name
   - Error Logs (aus Render Dashboard)
   - Environment Variables (ohne Secrets)

2. **Fallback**: Verwende die alte `/api/v2/auto` Route temporär (mit Timeout-Risiko)

## Quick Checklist

✅ Redis Service erstellt und läuft  
✅ Worker Service: Root Directory = `apps/backend`  
✅ Worker Service: Build Command = `npm run build`  
✅ Worker Service: Start Command = `node dist/worker.js`  
✅ Worker Service: Alle ENV vars vom Backend kopiert  
✅ REDIS_URL in Backend und Worker identisch  
✅ Worker Logs zeigen "Worker ready, waiting for jobs..."  
✅ Test Job erstellt und wird verarbeitet

Wenn alle Checkboxen ✅ sind, sollte das System funktionieren!
