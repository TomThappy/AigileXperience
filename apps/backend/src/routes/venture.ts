import { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildDeckFromPitch } from "../pipeline/buildDeck.js";

export async function ventureRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/venture/generate",
    {
      schema: { body: { type: "object" } },
    },
    async (req, reply) => {
      const Body = z.object({
        project_title: z.string().min(2),
        elevator_pitch: z.string().min(10),
        language: z.string().optional(),
        audience: z.string().optional(),
        geo_focus: z.string().optional(),
        time_horizon: z.string().optional(),
        mode: z.enum(["live", "dry", "assume", "assume_llm"]).default("live"),
      });
      const body = Body.parse(req.body);

      if (body.mode === "dry") {
        // Token-sparsam: Kein LLM-Call; gebe minimalen Skeleton mit TODOs zurück
        return reply.send({
          deck_meta: {
            project_name: body.project_title,
            language: body.language || "de",
            target_audience: body.audience || "Pre-Seed/Seed",
            assumptions: ["DRY-RUN: keine LLM-Kosten"],
          },
          slides: [],
          missing_info_questions: [
            "Welcher Startmarkt (Land/Sprache)?",
            "Welche Pricing-Tiers (Monat/Jahr)?",
            "Welche KPI-Ziele (MAU, % zahlend, Churn, CAC, LTV)?",
          ],
          warnings: ["Dry-Run ist nur für schnelle Vorschauen gedacht."],
        });
      }

      const deck = await buildDeckFromPitch(body.elevator_pitch, {
        language: body.language,
        audience: body.audience,
        geo_focus: body.geo_focus,
        time_horizon: body.time_horizon,
      });
      deck.deck_meta.project_name = body.project_title;

      if (body.mode === "assume") {
        const { applyBestAssumptions } = await import(
          "../pipeline/autoAssumptions.js"
        );
        const assumed = applyBestAssumptions(deck);
        return reply.send(assumed);
      }

      if (
        body.mode === "assume_llm" ||
        process.env.USE_ASSUMPTIONS_LLM === "true"
      ) {
        const { applyBestAssumptions } = await import(
          "../pipeline/autoAssumptions.js"
        );
        const base = applyBestAssumptions(deck);
        const { refineAssumptionsLLM } = await import(
          "../pipeline/refineAssumptions.js"
        );
        const refined = await refineAssumptionsLLM(base);
        return reply.send(refined);
      }

      return reply.send(deck);
    },
  );
}
