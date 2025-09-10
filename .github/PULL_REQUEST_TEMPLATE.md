## Ziel

Kurzbeschreibung des Changes (Problem → Lösung).

## CodeRabbit Review Pflicht ⚠️

**VOR MERGE:**

- [ ] CodeRabbit-Kommentare gelesen und verstanden
- [ ] Wichtige Findings umgesetzt oder begründet ignoriert (mit Kommentar warum)
- [ ] Keine `High` oder `Critical` Issues unbehandelt
- [ ] Code-Qualität/Performance-Verbesserungen berücksichtigt

**CodeRabbit Kommandos:**

- `@coderabbit review` - Vollständige Analyse
- `@coderabbit review: focus=security,performance` - Schwerpunkt auf Security/Performance
- `@coderabbit ignore` - Issue als "won't fix" markieren
- `@coderabbit resolve` - Issue als behoben markieren

## Risiko / Einfluss

- [ ] Breaking Change?
- [ ] Security-relevant?
- [ ] Performance-Impact?
- [ ] Migrations nötig?
- [ ] Database Schema Changes?

## Tests & Qualität

- [ ] Unit-Tests ergänzt/aktualisiert
- [ ] E2E/Smoke durchgelaufen (Warp-Snippet siehe unten)
- [ ] Linting ohne neue Warnings
- [ ] TypeScript-Checks bestanden
- [ ] Bundle Size überprüft (falls Frontend-Change)

## Deployment

- [ ] Backend (Render) - Environment Variables geprüft
- [ ] Worker (Render) - Queue/Job-Logic validiert
- [ ] Frontend (Vercel) - Build lokal getestet
- [ ] Cache-Invalidierung berücksichtigt

## Review-Hinweise für CodeRabbit

> @coderabbit review: focus=security,performance,maintainability
>
> Besonders auf folgende Aspekte achten:
>
> - [ ] Infinite Loops / Performance
> - [ ] Memory Leaks
> - [ ] Error Handling
> - [ ] Type Safety
> - [ ] Security Patterns
