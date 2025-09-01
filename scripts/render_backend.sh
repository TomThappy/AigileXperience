#!/usr/bin/env bash
set -euo pipefail

: "${RENDER_API_KEY:?Bitte RENDER_API_KEY als Env setzen}"
API="https://api.render.com/v1"

need() { command -v "$1" >/dev/null || { echo "❌ '$1' fehlt"; exit 1; }; }
need curl; need jq; need git

# Git Infos
REMOTE_URL=$(git remote get-url "$(git remote | head -n1)")
REPO_URL="${REMOTE_URL%.git}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

NAME="${RENDER_SERVICE_NAME:-aigilexperience-backend}"
REGION="${RENDER_REGION:-frankfurt}"
PLAN="${RENDER_PLAN:-starter}"
RUNTIME="node"
BUILD_CMD='npm ci && npm run -w apps/backend build'
START_CMD='node apps/backend/dist/server.js'

echo "▶️  Hole Owner ID…"
OWNER=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" "$API/owners" | jq -r '.[0].id')
test -n "$OWNER" && echo "   Owner: $OWNER"

echo "▶️  Prüfe ob Service bereits existiert…"
SERVICES=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" "$API/services?limit=200")
SID=$(echo "$SERVICES" | jq -r --arg NAME "$NAME" '.[] | select(.name==$NAME) | .id' | head -n1 || true)

create_or_update_envs () {
  local service_id=$1
  # Env-Vars zusammenstellen
  declare -A ENVS
  [[ -n "${OPENAI_API_KEY:-}" ]] && ENVS["OPENAI_API_KEY"]="$OPENAI_API_KEY"
  [[ -n "${ANTHROPIC_API_KEY:-}" ]] && ENVS["ANTHROPIC_API_KEY"]="$ANTHROPIC_API_KEY"
  ENVS["MODEL_NAME"]="${MODEL_NAME:-gpt-4o-mini}"
  ENVS["NODE_ENV"]="production"
  ENVS["PORT"]="3001"

  # Batch Payload
  TMP=$(mktemp)
  {
    echo '['
    first=1
    for k in "${!ENVS[@]}"; do
      [[ $first -eq 0 ]] && echo ','
      first=0
      printf '{"key":"%s","value":"%s","type":"plain_text"}' "$k" "${ENVS[$k]}"
    done
    echo ']'
  } > "$TMP"

  echo "▶️  Setze Env Vars…"
  curl -s -X PUT "$API/services/$service_id/env-vars" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    --data-binary @"$TMP" | jq '.[].key' >/dev/null
  rm -f "$TMP"
}

if [[ -z "$SID" || "$SID" == "null" ]]; then
  echo "▶️  Erstelle neuen Web Service '$NAME'…"
  PAYLOAD=$(jq -n \
    --arg name "$NAME" \
    --arg ownerId "$OWNER" \
    --arg type "web_service" \
    --arg runtime "$RUNTIME" \
    --arg repo "$REPO_URL" \
    --arg branch "$BRANCH" \
    --arg region "$REGION" \
    --arg buildCommand "$BUILD_CMD" \
    --arg startCommand "$START_CMD" \
    --arg plan "$PLAN" \
    '{ name: $name, ownerId: $ownerId, type: $type, runtime: $runtime,
       repo: $repo, branch: $branch, region: $region,
       buildCommand: $buildCommand, startCommand: $startCommand, plan: $plan }'
  )

  RES=$(curl -s -X POST "$API/services" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")
  echo "$RES" | jq . >/dev/null
  SID=$(echo "$RES" | jq -r '.id')

  if [[ -z "$SID" || "$SID" == "null" ]]; then
    echo "❌ Service konnte nicht erstellt werden"; exit 1;
  fi

  create_or_update_envs "$SID"

  echo "▶️  Initiale Deploy auslösen…"
  curl -s -X POST "$API/services/$SID/deploys" \
    -H "Authorization: Bearer $RENDER_API_KEY" | jq . >/dev/null
else
  echo "ℹ️  Service existiert (ID: $SID) – Update Env Vars & neuer Deploy…"
  create_or_update_envs "$SID"
  curl -s -X POST "$API/services/$SID/deploys" \
    -H "Authorization: Bearer $RENDER_API_KEY" | jq . >/dev/null
fi

echo "✅ Fertig. Service-ID: $SID"
echo "ℹ️  Render Dashboard: https://dashboard.render.com/"
