#!/bin/bash
# Warp Shortcut B: "Kick one job & monitor"

set -e

BACKEND_URL="https://aigilexperience-backend.onrender.com"

echo "🚀 WARP SHORTCUT: Job starten & monitoren"
echo ""

# Job starten
JOB_JSON='{"project_title":"HappyNest","elevator_pitch":"Prod smoke","use_assumptions":true,"timeout_ms":900000}'
JOB_ID=$(curl -sS -XPOST "$BACKEND_URL/api/jobs" -H 'Content-Type: application/json' -d "$JOB_JSON" | jq -r .jobId)

echo "✅ JOB_ID=$JOB_ID"
echo ""
echo "📊 Live-Monitoring für 60s..."

# Live-Monitor für 60s
for i in {1..12}; do
  echo "Status $i/12:"
  STATUS=$(curl -sS "$BACKEND_URL/api/jobs/$JOB_ID" | jq '{status, progress: .progress.step, percentage: .progress.percentage}')
  echo "$STATUS" | jq -C
  
  # Break if completed
  if echo "$STATUS" | jq -e '.status == "completed"' > /dev/null; then
    echo ""
    echo "🎉 Job completed!"
    break
  fi
  
  sleep 5
done

echo ""
echo "📋 Final Artifacts:"
curl -sS "$BACKEND_URL/api/jobs/$JOB_ID" | jq '.artifacts | keys'

echo ""
echo "🔗 SSE Stream available at:"
echo "curl -N \"$BACKEND_URL/api/jobs/$JOB_ID/stream\""
