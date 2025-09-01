import { FastifyInstance } from "fastify";
import { recalcLeitfadenV1 } from "../pipeline/leitfaden_v1/recalc.js";

export default async function autoRecalc(app: FastifyInstance) {
  app.post("/api/auto/recalc", async (req, reply) => {
    const b = (req.body || {}) as any;
    if (!b.dossier) {
      return reply.code(400).send({ error: "dossier required" });
    }
    const out = recalcLeitfadenV1({
      dossier: b.dossier,
      overrides: b.overrides,
    });
    return reply.send(out);
  });
}
