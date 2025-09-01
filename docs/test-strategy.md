# Teststrategie

- Unit: Pipeline pure functions (Zod schemas, parsing).
- Integration: /api/venture/generate (LLM stub/dry mode in CI).
- E2E: Frontend→Backend happy path (Playwright, ohne echte LLMs).
- Non-Functional: Rate Limit, CORS, Cache.
- Contract: @aigilexperience/common DeckSchema als Single Source.

_Autogen-Hinweis: wird von scripts/generate_docs.cjs aktualisiert._


_Aktualisiert: 2025-09-01T09:58:17.349Z_