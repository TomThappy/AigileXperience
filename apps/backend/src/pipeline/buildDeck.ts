import { DeckSchema } from "@aigilexperience/common";
import { completePrompt } from "../lib/llm.js";
import hasha from "hasha";
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, string>({
  max: 500,
  ttl: (Number(process.env.CACHE_TTL_SECONDS) || 86400) * 1000,
});

export async function buildDeckFromPitch(
  elevator_pitch: string,
  opts: {
    language?: string;
    audience?: string;
    geo_focus?: string;
    time_horizon?: string;
  } = {},
) {
  const key = await hasha.async(JSON.stringify({ elevator_pitch, opts }), {
    algorithm: "sha256",
  });
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const { SYSTEM_PROMPT, JSON_SCHEMA } = await import("./prompt.js");

  const userPrompt = `
Eingaben:
- elevator_pitch: ${elevator_pitch}
- language: ${opts.language || "de"}
- audience: ${opts.audience || "Pre-Seed/Seed-Investoren"}
- geo_focus: ${opts.geo_focus || "DACH→EU"}
- time_horizon: ${opts.time_horizon || "bis 2030"}

SCHEMA:
${JSON_SCHEMA}
`;

  const prompt = `${SYSTEM_PROMPT}\n${userPrompt}`;
  const raw = await completePrompt(prompt);

  // Best effort: JSON extrahieren
  const jsonText = raw
    .trim()
    .replace(/^```json/g, "")
    .replace(/^```/g, "")
    .replace(/```$/g, "");
  const parsed = DeckSchema.safeParse(JSON.parse(jsonText));
  if (!parsed.success) {
    throw new Error(
      "LLM output invalid: " + JSON.stringify(parsed.error.format(), null, 2),
    );
  }

  cache.set(key, JSON.stringify(parsed.data));
  return parsed.data;
}
