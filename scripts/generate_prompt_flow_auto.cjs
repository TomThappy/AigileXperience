/* Auto-doc generator for Leitfaden pipeline */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const promDir = (p) =>
  path.join(root, "apps", "backend", "prompts", "leitfaden_v1", p);
const read = (p) => fs.readFileSync(promDir(p), "utf8");

const now = new Date().toISOString().slice(0, 16).replace("T", " ");
const out = [];
out.push(`# Prompt Flow – Auto (Leitfaden v1)\n\n_Last updated: ${now}_\n`);
out.push(
  `## Pipeline\n- P1: Analyze & Map (o3-mini) → \`p1_analyze.md\`\n- P2: Best-Assumption Fill (o3-mini) → \`p2_assume.md\`\n- P3: Polish & Visuals (gpt-4o-mini) → \`p3_polish.md\`\n- P3b: Guideline Enforcer (gpt-4o-mini) → \`p3b_enforce.md\`\n- Schema: \`leitfaden_v1.json\`\n`,
);
out.push(
  `## Response Headers\nx-trace-id, x-prompt-ver=LF.P1.v1|LF.P2.v1|LF.P3.v1|LF.P3b.v1, x-schema-ver=leitfaden_v1, x-model\n`,
);
out.push(`## Prompts`);
["p1_analyze.md", "p2_assume.md", "p3_polish.md", "p3b_enforce.md"].forEach(
  (f) => {
    out.push(`\n### ${f}\n\n\`\`\`md\n${read(f).trim()}\n\`\`\``);
  },
);
out.push(`\n## Section Guidelines (editierbar)`);
fs.readdirSync(promDir("sections")).forEach((f) => {
  out.push(
    `\n### sections/${f}\n\n\`\`\`md\n${read("sections/" + f).trim()}\n\`\`\``,
  );
});
const outPath = path.join(root, "docs", "prompt-flow-auto.md");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out.join("\n"), "utf8");
console.log("Wrote", outPath);
