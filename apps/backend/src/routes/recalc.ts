import { FastifyInstance } from "fastify";
import { z } from "zod";
import { applyBestAssumptions } from "../pipeline/autoAssumptions.js";
import { DeckSchema } from "@aigilexperience/common";

export async function recalcRoutes(fastify: FastifyInstance) {
  fastify.post("/api/venture/recalc", {}, async (req, reply) => {
    const Body = z.object({
      deck: DeckSchema,
      overrides: z.record(z.any()).optional(),
    });
    const { deck, overrides } = Body.parse(req.body);
    const updated = applyBestAssumptions(deck, overrides || {});
    return reply.send(updated);
  });
}
