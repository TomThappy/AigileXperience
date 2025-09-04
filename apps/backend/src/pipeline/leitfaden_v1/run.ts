import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chatComplete } from "../../lib/llm.js";

const p = (...xs: string[]) =>
  path.join(process.cwd(), "apps", "backend", ...xs);
const read = (rel: string) => fs.readFileSync(p(rel), "utf8");
const strip = (s: string) =>
  s
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();

type In = {
  project_title: string;
  elevator_pitch: string;
  language?: string;
  target_audience?: string;
  geo_focus?: string;
};

export async function runLeitfadenV1(input: In) {
  const trace = crypto.randomUUID();
  const language = input.language || "de";
  const target = input.target_audience || "Pre-Seed/Seed VCs";
  const geo = input.geo_focus || "EU/DACH";
  const schema = read("prompts/leitfaden_v1/leitfaden_v1.json");

  console.log(
    `[${trace.substring(0, 8)}] Starting Leitfaden V1 pipeline with:`,
    {
      project_title: input.project_title,
      elevator_pitch: input.elevator_pitch?.substring(0, 100) + "...",
      language,
      target,
      geo,
    },
  );

  // P1
  const p1 =
    read("prompts/leitfaden_v1/p1_analyze.md")
      .replaceAll("{project_title}", input.project_title)
      .replaceAll("{elevator_pitch}", input.elevator_pitch)
      .replaceAll("{language}", language)
      .replaceAll("{target_audience}", target)
      .replaceAll("{geo_focus}", geo) +
    "\n\nSCHEMA (JSON only):\n" +
    `{"meta":{},"sections":{},"assumption_policy":"conservative_eu_2025"}`;
  const p1Out = await chatComplete(p1, {
    model: process.env.MODEL_ANALYZE || "gpt-4o-mini",
    temperature: 0,
  });
  const p1Json = JSON.parse(strip(p1Out));

  // P2
  const p2 =
    read("prompts/leitfaden_v1/p2_assume.md") +
    "\n\nSCHEMA:\n" +
    schema +
    "\n\nP1_JSON:\n" +
    JSON.stringify(p1Json, null, 2);
  const p2Out = await chatComplete(p2, {
    model: process.env.MODEL_ANALYZE || "gpt-4o-mini",
    temperature: 0,
  });
  const p2Json = JSON.parse(strip(p2Out));

  // P3
  const p3 =
    read("prompts/leitfaden_v1/p3_polish.md") +
    "\n\nSCHEMA:\n" +
    schema +
    "\n\nINPUT:\n" +
    JSON.stringify(p2Json, null, 2);
  const p3Out = await chatComplete(p3, {
    model: process.env.MODEL_REFINE || "gpt-4o-mini",
    temperature: 0.5,
  });
  const finalPre = JSON.parse(strip(p3Out));

  // P3b
  const { enforceGuidelines } = await import("./enforce.js");
  const final = await enforceGuidelines(finalPre);

  const headers = {
    "x-trace-id": trace,
    "x-prompt-ver": "LF.P1.v1|LF.P2.v1|LF.P3.v1|LF.P3b.v1",
    "x-model": `${process.env.MODEL_ANALYZE || "gpt-4o-mini"}+${process.env.MODEL_REFINE || "gpt-4o-mini"}`,
    "x-schema-ver": "leitfaden_v1",
    "x-stage": "P3b",
  };
  return { final, headers };
}
