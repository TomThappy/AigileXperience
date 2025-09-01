#!/usr/bin/env bash
set -euo pipefail

echo "▶️ AigileXperience – Auto-Pipeline deploy: Git → Render → Vercel"

# ===== 0) Variablen ====
: "${BACKEND_URL:=https://aigilexperience-backend.onrender.com}"   # ggf. export BACKEND_URL=...
VERCEL_PROJECT="${VERCEL_PROJECT:-frontend}"                        # dein aktives Vercel-Projektname
ALIAS_DOMAIN="${ALIAS_DOMAIN:-aigilexperience.vercel.app}"         # hübsche Domain

echo "Using:"
echo "  BACKEND_URL    = $BACKEND_URL"
echo "  VERCEL_PROJECT = $VERCEL_PROJECT"
echo "  ALIAS_DOMAIN   = $ALIAS_DOMAIN"

# ===== 1) Schnelltest: lokale Doku updaten (optional, commiten wir mit) ====
if npm run docs:auto >/dev/null 2>&1; then
  echo "📝 docs/prompt-flow-auto.md regeneriert."
fi

# ===== 2) Git: commit & push main (triggert Render Auto-Deploy) ====
test -d .git || { echo "❌ Kein Git-Repo hier"; exit 1; }
git add -A
git commit -m "chore: deploy auto-pipeline (leitfaden v1)" || echo "ℹ️ nichts zu committen"
# Stelle sicher, dass main existiert
git branch --show-current | grep -q '^main$' || git checkout -B main
git push -u origin main

echo "⏳ Warte kurz, bis Render buildet..."
sleep 8

# ===== 3) Render: Health / Smoke ====
echo "🔎 Render Health:"
set +e
curl -fsS "$BACKEND_URL/health" && echo || echo "⚠️ Health noch nicht erreichbar – Render baut evtl. noch."
set -e

echo "🔎 Auto-API (kleiner Smoke, kann Tokens kosten):"
set +e
curl -fsS -X POST "$BACKEND_URL/api/auto/run" \
  -H "Content-Type: application/json" \
  -d '{"project_title":"HappyNest","elevator_pitch":"HappyNest ist das digitale Zuhause …"}' \
  | head -c 400 || echo "⚠️ Auto-API noch nicht erreichbar – erneut probieren, wenn Render-Deploy fertig ist."
set -e

# ===== 4) Vercel: Projekt linken & ENV setzen ====
if ! command -v vercel >/dev/null 2>&1; then
  npm i -g vercel@latest
fi

# vercel.json für Monorepo ist bereits vorhanden; jetzt link + ENVs auf korrektes Projekt
vercel link --project "$VERCEL_PROJECT" --yes --confirm || true

# ENVs für Preview + Production setzen/ersetzen
for ENV in production preview; do
  vercel env rm NEXT_PUBLIC_AUTO_URL $ENV --yes >/dev/null 2>&1 || true
  vercel env rm NEXT_PUBLIC_AUTO_RECALC_URL $ENV --yes >/dev/null 2>&1 || true
  echo -n "${BACKEND_URL}/api/auto/run"    | vercel env add NEXT_PUBLIC_AUTO_URL $ENV
  echo -n "${BACKEND_URL}/api/auto/recalc" | vercel env add NEXT_PUBLIC_AUTO_RECALC_URL $ENV
done

# Optional: die alten Venture-Endpoints weiter gepflegt lassen
for ENV in production preview; do
  vercel env rm NEXT_PUBLIC_API_URL $ENV --yes >/dev/null 2>&1 || true
  vercel env rm NEXT_PUBLIC_API_RECALC_URL $ENV --yes >/dev/null 2>&1 || true
  echo -n "${BACKEND_URL}/api/venture/generate" | vercel env add NEXT_PUBLIC_API_URL $ENV
  echo -n "${BACKEND_URL}/api/venture/recalc"   | vercel env add NEXT_PUBLIC_API_RECALC_URL $ENV
done

# ===== 5) Frontend: Prod-Deploy anstoßen ====
URL=$(vercel --prod --confirm | tail -n1 | sed 's/.*https/https/')
echo "🌐 Vercel Prod URL: $URL"

# ===== 6) Alias auf hübsche Domain legen (zeigt auf den neuesten Deploy) ====
set +e
vercel alias set "$URL" "$ALIAS_DOMAIN" --yes || {
  echo "ℹ️ Falls Alias bereits belegt: vercel alias rm $ALIAS_DOMAIN --yes ; dann erneut setzen."
}
set -e

# ===== 7) Finaler Check =====
echo "🔎 Finaler GET $URL/auto"
set +e
curl -I "$URL/auto" || true
set -e

cat <<TXT

✅ Fertig!

• Backend (Render):   $BACKEND_URL   (Health: $BACKEND_URL/health)
• Frontend (Vercel):  $URL
• Alias (falls gesetzt): https://$ALIAS_DOMAIN/auto

Wenn /auto eine 401 zeigt: Vercel Dashboard → Project "$VERCEL_PROJECT" → Settings → Deployment Protection → Password Protection: Disable.

Bei Render-Problemen: Dashboard-Logs checken. Typische ENVs:
  OPENAI_API_KEY=...   (o3-mini/gpt-4o-mini)
  MODEL_ANALYZE=o3-mini
  MODEL_REFINE=gpt-4o-mini

TXT
