import { FastifyInstance } from "fastify";
import { runLeitfadenV1 } from "../pipeline/leitfaden_v1/run.js";

export default async function autoV1(app: FastifyInstance) {
  app.post("/api/auto/run", async (req, reply) => {
    const b = (req.body || {}) as any;
    if (!b.project_title || !b.elevator_pitch) {
      return reply
        .code(400)
        .send({ error: "project_title and elevator_pitch are required" });
    }
    const { final, headers } = await runLeitfadenV1(b);
    Object.entries(headers).forEach(([k, v]) => reply.header(k, v as any));
    return reply.send(final);
  });
}
