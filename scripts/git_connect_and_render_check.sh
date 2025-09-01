#!/usr/bin/env bash
# scripts/git_connect_and_render_check.sh
set -euo pipefail

# ========= Settings (ändere bei Bedarf) =========
REPO_NAME="${REPO_NAME:-AigileXperience}"
# Falls du GH_OWNER nicht setzt, wird dein eingeloggter gh-User genutzt
GH_OWNER="${GH_OWNER:-}"
# Render Service Name (so haben wir ihn bisher genannt)
RENDER_SERVICE_NAME="${RENDER_SERVICE_NAME:-aigilexperience-backend}"
# Backend URL (aus Render, Public URL)
BACKEND_URL="${BACKEND_URL:-https://aigilexperience-backend.onrender.com}"

# ========= Helper =========
log() { printf "\033[1;36m%s\033[0m\n" "▶ $*"; }
ok()  { printf "\033[1;32m%s\033[0m\n" "✓ $*"; }
warn(){ printf "\033[1;33m%s\033[0m\n" "⚠ $*"; }
err() { printf "\033[1;31m%s\033[0m\n" "✗ $*"; }

need() { command -v "$1" >/dev/null 2>&1 || { err "Tool '$1' fehlt"; exit 1; }; }

# ========= 0) Tool Checks =========
need git
if ! command -v gh >/dev/null 2>&1; then warn "gh (GitHub CLI) fehlt – Repo-Erstellung per CLI nicht möglich."; fi

# ========= 1) Git Remote verbinden / erstellen =========
log "Git Remote prüfen/setzen …"
if git remote -v | grep -q '^origin'; then
  ok "Remote 'origin' existiert bereits."
else
  if [ -z "${GH_OWNER}" ] && command -v gh >/dev/null 2>&1; then
    GH_OWNER="$(gh api user -q .login 2>/dev/null || true)"
  fi
  if [ -z "${GH_OWNER}" ]; then
    warn "GH_OWNER unbekannt. Bitte setze: export GH_OWNER=<dein-github-user-oder-org>"
    exit 1
  fi

  if command -v gh >/dev/null 2>&1; then
    log "Erzeuge Repo ${GH_OWNER}/${REPO_NAME} (falls nicht vorhanden) und verknüpfe es…"
    gh repo view "${GH_OWNER}/${REPO_NAME}" >/dev/null 2>&1 || gh repo create "${GH_OWNER}/${REPO_NAME}" --public --source=. --remote=origin --push
    git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/${GH_OWNER}/${REPO_NAME}.git"
  else
    log "Setze Remote (ohne gh): https://github.com/${GH_OWNER}/${REPO_NAME}.git"
    git remote add origin "https://github.com/${GH_OWNER}/${REPO_NAME}.git"
  fi
  ok "Remote 'origin' konfiguriert."
fi

# Ensure main branch
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  log "Wechsle auf Branch 'main'…"
  git checkout -B main
fi

# Commit & Push (idempotent)
git add -A || true
git commit -m "chore: connect remote & health script" || true
log "Pushe nach origin/main …"
git push -u origin main || true
ok "Git push ausgeführt."

# ========= 2) Render: Health & Logs =========
log "Prüfe Backend Health @ $BACKEND_URL/health …"
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" || true)
if [ "$HTTP_CODE" = "200" ]; then
  ok "Health OK (200)."
else
  warn "Health nicht OK (HTTP=$HTTP_CODE). Versuche Logs zu holen …"

  # Priorität: Render CLI (falls vorhanden)
  if command -v render >/dev/null 2>&1; then
    log "Tail Logs via Render CLI für Service '$RENDER_SERVICE_NAME' (letzte 200 Zeilen):"
    render logs "$RENDER_SERVICE_NAME" --tail 200 || warn "Konnte render logs nicht ziehen. Ist 'render' eingeloggt/konfiguriert?"
    warn "Wenn keine Logs erscheinen: 'render login' oder 'render services' prüfen."
  else
    warn "Render CLI nicht installiert. Zwei Optionen:"
    echo "  1) CLI installieren: npm i -g render-cli   (danach 'render login')"
    echo "  2) Dashboard öffnen: https://dashboard.render.com/  → Service: ${RENDER_SERVICE_NAME} → Logs"
    # Falls du Render-API-Key hast, können wir noch einen simplen Ping anstoßen:
    if [ -n "${RENDER_API_KEY:-}" ]; then
      log "Optional: Pinge Render API (Services auflisten) …"
      curl -sS -H "Authorization: Bearer $RENDER_API_KEY" https://api.render.com/v1/services | head -c 800 || true
      echo
    fi
  fi
fi

ok "Fertig. Wenn Health weiterhin failt: Render-Logs prüfen & evtl. Redeploy auslösen."
