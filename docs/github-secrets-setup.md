# GitHub Secrets Setup für Automatisierte Deployments

## Übersicht

Die automatisierten Deployments benötigen folgende GitHub Secrets für die GitHub Actions:

## 1. Render Backend Deployment

Für das Backend-Deployment auf Render benötigst du:

### `RENDER_API_KEY`

1. Gehe zu [Render Dashboard](https://dashboard.render.com/)
2. Klicke auf dein Profil (rechts oben) → "Account Settings"
3. Wähle "API Keys" aus
4. Erstelle einen neuen API Key
5. Kopiere den Key

### `RENDER_SERVICE_ID`

1. Gehe zu deinem Render Service
2. In der URL findest du die Service ID: `https://dashboard.render.com/web/{SERVICE_ID}`
3. Oder im Service Dashboard unter "Settings"

## 2. Vercel Frontend Deployment

Für das Frontend-Deployment auf Vercel benötigst du:

### `VERCEL_TOKEN`

1. Gehe zu [Vercel Dashboard](https://vercel.com/dashboard)
2. Klicke auf dein Profil → "Settings"
3. Wähle "Tokens" aus
4. Erstelle einen neuen Token mit Scope "Full Access"

### `VERCEL_ORG_ID`

1. In deinem Vercel Dashboard
2. Team Settings → "General"
3. Kopiere die "Team ID"

### `VERCEL_PROJECT_ID`

1. Gehe zu deinem Vercel Project
2. Settings → "General"
3. Kopiere die "Project ID"

## 3. Secrets in GitHub hinzufügen

1. Gehe zu deinem GitHub Repository
2. Klicke auf "Settings" (Tab)
3. Wähle "Secrets and variables" → "Actions"
4. Klicke "New repository secret"
5. Füge alle 5 Secrets hinzu:
   - `RENDER_API_KEY`
   - `RENDER_SERVICE_ID`
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

## 4. CodeRabbit Setup

CodeRabbit funktioniert automatisch über die GitHub App Integration:

1. Gehe zu [CodeRabbit.ai](https://coderabbit.ai)
2. Verbinde dein GitHub Account
3. Installiere die CodeRabbit GitHub App
4. Wähle das Repository aus
5. CodeRabbit reviewt automatisch alle Pull Requests

## Workflow

Nach der Konfiguration läuft folgender automatisierter Prozess:

### Bei Pull Requests:

1. **CodeRabbit** analysiert den Code automatisch
2. **GitHub Actions** führen Tests und Builds durch
3. **Kein Deployment** (nur Testing)

### Bei Push zu `main`:

1. **Tests und Builds** werden ausgeführt
2. **Backend** wird automatisch auf Render deployed
3. **Frontend** wird automatisch auf Vercel deployed
4. **Bei Fehlern** wird der Deployment gestoppt

## Testen

Um zu testen, ob alles funktioniert:

1. Erstelle einen Feature-Branch: `git checkout -b test-deployment`
2. Mache eine kleine Änderung und committe sie
3. Push den Branch: `git push origin test-deployment`
4. Erstelle eine Pull Request auf GitHub
5. CodeRabbit sollte automatisch reviewen
6. Merge die PR → Automatic Deployment sollte starten

## Troubleshooting

### Deployment schlägt fehl:

- Überprüfe die Secrets in GitHub
- Schaue in die GitHub Actions Logs
- Verifiziere Render/Vercel Service IDs

### CodeRabbit reviewt nicht:

- Überprüfe die GitHub App Installation
- Stelle sicher, dass das Repository ausgewählt ist

### Tests schlagen fehl:

- Lokal testen: `npm test`
- Dependencies aktualisieren: `npm install`
