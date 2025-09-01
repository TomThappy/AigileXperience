const fs = require("fs");
const path = require("path");

const stamp = `\n\n_Aktualisiert: ${new Date().toISOString()}_`;
["deployment-flow.md", "prompt-flow-venture.md", "test-strategy.md"].forEach(
  (f) => {
    const p = path.join(__dirname, "..", "docs", f);
    const txt = fs.readFileSync(p, "utf8");
    if (!txt.includes("_Aktualisiert:")) fs.writeFileSync(p, txt + stamp);
  },
);
console.log("Docs updated.");
