import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { runLeitfadenV1 } from "../pipeline/leitfaden_v1/run.js";

export default async function autoV1(app: FastifyInstance) {
  app.post("/api/auto/run", async (req, reply) => {
    const startTime = Date.now();
    const traceId = crypto.randomUUID().substring(0, 8);

    app.log.info(`[${traceId}] AUTO/RUN Request received`);

    try {
      const b = (req.body || {}) as any;
      app.log.info(`[${traceId}] Request body: project_title=${!!b.project_title}, elevator_pitch=${!!b.elevator_pitch}`);

      if (!b.project_title || !b.elevator_pitch) {
        app.log.warn(`[${traceId}] Missing required fields`);
        return reply
          .code(400)
          .send({ error: "project_title and elevator_pitch are required" });
      }

      app.log.info(`[${traceId}] Calling runLeitfadenV1...`);
      const { final, headers } = await runLeitfadenV1(b);

      app.log.info(`[${traceId}] Pipeline completed successfully in ${Date.now() - startTime}ms`);

      Object.entries(headers).forEach(([k, v]) => reply.header(k, v as any));
      return reply.send(final);
    } catch (error) {
      const duration = Date.now() - startTime;
      app.log.error(`[${traceId}] Pipeline failed after ${duration}ms: ${error instanceof Error ? error.message : String(error)}`);

      return reply.code(500).send({
        error: "Internal server error",
        traceId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
