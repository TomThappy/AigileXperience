import { Deck, DeckSchema } from "@aigilexperience/common";
import { chatComplete } from "../lib/llm.js";
import fs from "fs";
import path from "path";

function loadPrompt(relPath: string) {
  const p = path.join(process.cwd(), "prompts", relPath);
  return fs.readFileSync(p, "utf8");
}

/**
 * Refine deck with LLM using venture.assume.md.
 * - Füllt TODOs sinnvoll aus
 * - poliert Bullets (prägnant, faktenbasiert)
 * - überschreibt NICHT harte Fakten (nur TODO/Assumptions)
 */
export async function refineAssumptionsLLM(deck: Deck): Promise<Deck> {
  const sys = loadPrompt("venture.assume.md");
  const schema = loadPrompt("venture.schema.json");

  const user = `
SYSTEM:
${sys}

SCHEMA (JSON only!):
${schema}

INPUT_DECK (JSON):
${JSON.stringify(deck, null, 2)}
`;

  const out = await chatComplete(user, {
    model: process.env.MODEL_REFINE || "gpt-4o",
    temperature: 0.2,
  });

  const json = out
    .trim()
    .replace(/^```json/g, "")
    .replace(/^```/g, "")
    .replace(/```$/g, "");
  const parsed = DeckSchema.safeParse(JSON.parse(json));
  if (!parsed.success) {
    throw new Error(
      "Refine LLM output invalid: " +
        JSON.stringify(parsed.error.format(), null, 2),
    );
  }
  const refined = parsed.data;
  // Hinweis in assumptions
  refined.deck_meta.assumptions = Array.from(
    new Set([
      ...(refined.deck_meta.assumptions || []),
      "Refined by LLM: " + (process.env.MODEL_REFINE || "gpt-4o"),
    ]),
  );
  return refined;
}
