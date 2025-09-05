#!/bin/bash
# Warp Shortcut A: "Redeploy + Dry-Run toggle"

set -e

# Service IDs
BACKEND_ID="srv-d2qovbl6ubrc73dnh89g"
WORKER_ID="srv-d2t8v3er433s73d628j0"

echo "🔧 WARP SHORTCUT: Dry-Run ON für beide Services"
echo ""

# Dry-Run ON
render services env set "$BACKEND_ID" LLM_DRY_RUN true
render services env set "$WORKER_ID"  LLM_DRY_RUN true

echo "🚀 Redeploy..."
render services deploy "$BACKEND_ID"
render services deploy "$WORKER_ID"

echo "✅ Beide Services auf DRY-RUN umgestellt und redeployed"
echo ""
echo "Status check in 60s:"
sleep 60
curl -sS "https://aigilexperience-backend.onrender.com/health" | jq '{status, version, timestamp}'
