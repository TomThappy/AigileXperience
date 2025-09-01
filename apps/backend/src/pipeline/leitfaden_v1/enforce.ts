import fs from "node:fs";
import path from "node:path";
import { chatComplete } from "../../lib/llm.js";

const P = (...x: string[]) => path.join(process.cwd(), "apps", "backend", ...x);
const R = (r: string) => fs.readFileSync(P(r), "utf8");
const strip = (s: string) =>
  s
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();

export async function enforceGuidelines(json: any) {
  const schema = R("prompts/leitfaden_v1/leitfaden_v1.json");
  const guidelines = {
    problem: R("prompts/leitfaden_v1/sections/problem.md"),
    solution: R("prompts/leitfaden_v1/sections/solution.md"),
    team: R("prompts/leitfaden_v1/sections/team.md"),
    market: R("prompts/leitfaden_v1/sections/market.md"),
    business_model: R("prompts/leitfaden_v1/sections/business_model.md"),
    competition: R("prompts/leitfaden_v1/sections/competition.md"),
    gtm: R("prompts/leitfaden_v1/sections/gtm.md"),
    status_quo: R("prompts/leitfaden_v1/sections/status_quo.md"),
    financials: R("prompts/leitfaden_v1/sections/financials.md"),
    ask: R("prompts/leitfaden_v1/sections/ask.md"),
    roadmap: R("prompts/leitfaden_v1/sections/roadmap.md"),
    contact: R("prompts/leitfaden_v1/sections/contact.md"),
  };

  const prompt = `# Enforce
${R("prompts/leitfaden_v1/p3b_enforce.md")}

SCHEMA:
${schema}

GUIDELINES:
${Object.entries(guidelines)
  .map(([k, v]) => `## ${k}\n${v}`)
  .join("\n\n")}

INPUT:
${JSON.stringify(json, null, 2)}
`;

  const out = await chatComplete(prompt, {
    model: process.env.MODEL_REFINE || "gpt-4o-mini",
    temperature: 0.2,
  });
  return JSON.parse(strip(out));
}
