# 🚨 SOFORTIGER FIX: Worker Start Command

## Problem:

```
Error: Cannot find module '/opt/render/project/src/apps/backend/dist/worker.js'
```

## Ursache:

Der Worker Service hat noch die **alte Start Command** und versucht eine nicht-existierende `dist/worker.js` zu starten.

## ✅ SOFORTIGE LÖSUNG:

### 1. Render Dashboard öffnen

- Gehe zu deinem **Worker Service** (nicht Backend!)
- Klicke auf **"Settings"**

### 2. Start Command ändern

**Aktuell (falsch):**

```
❌ Start Command: node dist/worker.js
```

**Korrekt (neu):**

```
✅ Start Command: npm run -w apps/backend worker:prod
```

### 3. Service neu starten

- **"Manual Deploy"** klicken
- Oder **"Save"** → automatischer Neustart

## 🔍 Was passiert dann:

### Erwartete Logs nach Fix:

```bash
==> Build completed successfully
==> Starting command 'npm run -w apps/backend worker:prod'

> @aigilexperience/backend@0.0.1 worker:prod
> tsx src/worker.ts

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

## 📋 Komplette Worker Service Konfiguration:

```
Name: aigilexperience-worker
Repository: AigileXperience
Branch: main
Root Directory: /
Runtime: Node

Build Command: npm ci && npm run -w apps/backend build
Start Command: npm run -w apps/backend worker:prod

Environment Variables:
- REDIS_URL=<Internal Redis URL>
- OPENAI_API_KEY=sk-...
- ANTHROPIC_API_KEY=sk-ant-...
- MODEL_ANALYZE=gpt-4-turbo-preview
- MODEL_REFINE=claude-3-5-sonnet-20241022
- USE_ASSUMPTIONS_LLM=gpt-4-turbo-preview
- NODE_ENV=production
- RENDER=true
```

## 🧪 Test nach Fix:

Nach dem Worker-Neustart solltest du das System testen können:

```bash
# Job erstellen via Backend
curl -X POST https://your-backend.onrender.com/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "project_title": "Test Job",
    "industry": "Tech"
  }'

# Worker sollte den Job automatisch verarbeiten
```

## ⏱️ Timing:

- **Fix dauert**: < 2 Minuten
- **Neustart dauert**: ~3-5 Minuten
- **Total**: ~5-7 Minuten bis Worker läuft

Der Worker sollte danach perfekt funktionieren! 🎉
