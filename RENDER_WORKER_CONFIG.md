# 🎯 Korrekte Render Worker Service Konfiguration

## ❌ Häufigste Fehler bei Worker Configuration:

### Problem 1: Falsche Root Directory
```bash
❌ Root Directory: apps/backend
❌ Build Command: npm run build  
❌ Start Command: node dist/worker.js
```
**Warum das nicht funktioniert:** Render kann keine Dependencies installieren, da die package.json in der Root liegt, nicht in apps/backend.

### Problem 2: Dependencies werden nicht installiert
```bash
❌ Build Command: npm install && npm run build
❌ Missing: Workspace dependencies (packages/common)
```

## ✅ KORREKTE Konfiguration:

### Render Background Worker Settings
```
Name: aigilexperience-worker
Repository: AigileXperience
Branch: main
Root Directory: /  (WICHTIG: Root des Repos!)
Runtime: Node
Region: Same as Backend and Redis
```

### Build & Start Commands
```bash
Build Command: npm install --workspaces && cd apps/backend && npm run build
Start Command: node apps/backend/dist/worker.js
```

### Environment Variables
**Alle diese Variables kopieren vom Backend Service:**
```bash
REDIS_URL=redis://red-xxxxx:6379
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
MODEL_ANALYZE=gpt-4-turbo-preview
MODEL_REFINE=claude-3-5-sonnet-20241022
USE_ASSUMPTIONS_LLM=gpt-4-turbo-preview
NODE_ENV=production
RENDER=true  # Wichtig für husky
```

## 🔍 Build Process Explanation:

1. **`npm install --workspaces`**: Installiert alle Dependencies für alle Workspaces (Root, Backend, Common)
2. **`npm run -w apps/backend build`**: Ausführung des Build-Commands im Backend Workspace
3. **Prebuild Hook**: Automatisch wird `packages/common` gebaut (siehe package.json)
4. **TypeScript Compilation**: Mit allen Dependencies und @types/node verfügbar
5. **Output**: `apps/backend/dist/worker.js` wird erstellt

## 🚀 Expected Successful Build Logs:

```bash
==> Cloning from GitHub repo AigileXperience...
==> Installing dependencies...
npm install --workspaces

> prepare
> [ -n "$CI" ] || [ -n "$VERCEL" ] || [ -n "$RENDER" ] || husky

added 557 packages in 15s
==> Running build command 'npm install --workspaces && npm run -w apps/backend build'...

> @aigilexperience/backend@0.0.1 prebuild
> env RENDER=true sh -c 'cd ../../packages/common && npm ci --include=dev && npm run build'

> @aigilexperience/common@0.0.1 build
> tsc -p tsconfig.json

> @aigilexperience/backend@0.0.1 build  
> tsc -p tsconfig.json

==> Build completed successfully
==> Starting command 'node apps/backend/dist/worker.js'
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

## 🔧 Troubleshooting Steps:

### If Build Fails:
1. Check Root Directory is `/` not `apps/backend`
2. Check Build Command includes `--workspaces`
3. Check that `RENDER=true` environment variable is set
4. Look for `Cannot find module` errors → missing dependencies

### If Worker Starts but Can't Connect:
1. Check `REDIS_URL` matches Backend service exactly
2. Check Redis Service is running
3. Check all API keys are set

### If Jobs Aren't Processing:
1. Check Worker logs for `🎯 Worker ready, waiting for jobs...`
2. Test job creation via Backend API
3. Check Backend logs for `✅ Created job abc123`

## 🎯 Aktueller Status:

- ✅ TypeScript Types behoben (@types/node hinzugefügt)
- ✅ Husky Issue behoben (RENDER=true environment variable)
- ✅ Monorepo Build konfiguriert (--workspaces)
- ✅ Worker Service ready für Deployment

**Nächster Schritt:** Korrekte Konfiguration in Render Dashboard anwenden
