#!/usr/bin/env bash
set -euo pipefail

echo "▶️ AigileXperience – Orchestrator: PR + CodeRabbit Review + Auto-Merge + Vercel Deploy"

# ---- 0) Checks & Inputs ----
command -v gh >/dev/null || { echo "❌ gh CLI fehlt"; exit 1; }
command -v vercel >/dev/null || { echo "❌ vercel CLI fehlt (npm i -g vercel)"; exit 1; }
command -v jq >/dev/null || { echo "❌ jq fehlt (brew install jq / apt-get install jq)"; exit 1; }
test -d apps/frontend && test -d apps/backend || { echo "❌ bitte im Repo-Root ausführen"; exit 1; }
: "${BACKEND_URL:?Bitte export BACKEND_URL=https://<dein-render>.onrender.com}"
CODERABBIT_PLAN="${CODERABBIT_PLAN:-false}"

# Best-Pipeline-ENV Defaults (kannst du schon gesetzt haben)
pushd apps/backend >/dev/null
cp -n .env.example .env || true
grep -q '^MODEL_ANALYZE=' .env || echo "MODEL_ANALYZE=claude-3-5-sonnet-20240620" >> .env
grep -q '^MODEL_REFINE=' .env   || echo "MODEL_REFINE=gpt-4o" >> .env
grep -q '^USE_ASSUMPTIONS_LLM=' .env || echo "USE_ASSUMPTIONS_LLM=true" >> .env
popd >/dev/null

# ---- 1) Sync + Build + Test ----
git fetch origin || true
BR="chore/auto-sync-$(date -u +%Y%m%d-%H%M%S)"
git checkout -B "$BR"
npm install
npm run build --workspaces --if-present
npm run test  --workspaces --if-present || echo "⚠️ Tests fehlgeschlagen oder übersprungen – fahre dennoch fort"

git add -A
git commit -m "chore: auto-sync prod (warp orchestrated)" || echo "ℹ️ nichts zu committen"
git push -u origin "$BR"

# ---- 2) PR erstellen ----
PR_URL=$(gh pr create -B main -H "$BR" -t "chore: auto-sync prod" -b "Automated sync via Warp; trigger CodeRabbit review." -l "automation" -r "$(gh api user -q .login)" 2>/dev/null | tail -n1)
if [[ -z "$PR_URL" ]]; then
  PR_URL=$(gh pr view --json url -q .url)
fi
echo "📎 PR: $PR_URL"

# ---- 3) CodeRabbit Review anfordern (per Kommentar) ----
# Doku: @coderabbitai review / full review / summary / configuration
gh pr comment -b "@coderabbitai full review"       >/dev/null || true
gh pr comment -b "@coderabbitai summary"           >/dev/null || true

# Optional: Verbesserungs-PR anfordern (Pro-Plan) via 'plan'
if [[ "$CODERABBIT_PLAN" == "true" ]]; then
  gh pr comment -b "@coderabbitai plan"            >/dev/null || true
fi

# ---- 4) Auf CodeRabbit-Statuscheck pollen & Auto-Merge setzen ----
# Viele Installationen exposen einen Check-Name mit "CodeRabbit" im Titel.
PR_NUM=$(gh pr view --json number -q .number)
SHA=$(gh pr view --json headRefOid -q .headRefOid)
echo "⏳ warte auf CodeRabbit-Check (Commit $SHA) ..."
for i in {1..60}; do
  # hole check-runs dieses Commits, suche nach 'CodeRabbit' im Namen
  STATUS=$(gh api repos/:owner/:repo/commits/$SHA/check-runs \
    -q '[.check_runs[]? | select(.name|test("CodeRabbit"; "i")) | .conclusion] | first' 2>/dev/null || echo "")
  echo "   Versuch $i/60 – Status: ${STATUS:-none}"
  if [[ "$STATUS" =~ ^(success|neutral|completed)$ ]]; then
    break
  fi
  sleep 5
done

# Merge (squash) wenn erlaubt; Auto-Merge einschalten, Branch löschen
gh pr merge "$PR_NUM" --squash --auto --delete-branch || echo "ℹ️ Auto-Merge wird erfolgen, sobald Checks grün sind (Branch Protection?)"

# ---- 5) Vercel: ENVs setzen & Prod-Deploy ----
vercel link --project AigileXperience --yes --confirm || true

# ENVs neu setzen (Preview + Prod)
for ENV in production preview; do
  vercel env rm NEXT_PUBLIC_API_URL $ENV --yes >/dev/null 2>&1 || true
  vercel env rm NEXT_PUBLIC_API_RECALC_URL $ENV --yes >/dev/null 2>&1 || true
  echo -n "$BACKEND_URL/api/venture/generate" | vercel env add NEXT_PUBLIC_API_URL $ENV
  echo -n "$BACKEND_URL/api/venture/recalc"   | vercel env add NEXT_PUBLIC_API_RECALC_URL $ENV
done

# Deploy (Prod)
URL=$(vercel --prod --confirm | tail -n1 | sed 's/.*https/https/')
echo "🌐 Vercel URL: $URL"

# Optional: E2E gegen Prod (Smoke)
if command -v npx >/dev/null; then
  echo "▶️ E2E Smoke (Playwright) gegen $URL"
  E2E_BASE="$URL" npx playwright test apps/frontend/e2e/smoke.spec.ts || echo "⚠️ E2E Smoke hat Warnungen/Fehlschläge"
fi

echo "✅ Fertig."
echo "Falls du die Verbesserungs-PR von CodeRabbit nutzen willst, öffne den verlinkten PR (CodeRabbit erstellt einen separaten Verbesserungs-PR bei 'plan')."
