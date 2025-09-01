# Deployment Flow

1. Branching: trunk-based (main protected), feature/\* via PR.
2. CI: Lint, Test, Build. On main → Deploy.
3. Frontend: Next.js → Vercel (or Docker).
4. Backend: Fastify → Render/Fly/Heroku (Docker).
5. Env: `.env` per app (+ secrets in GitHub Actions).

_Autogen-Hinweis: wird von scripts/generate_docs.cjs aktualisiert._


_Aktualisiert: 2025-09-01T09:58:17.349Z_