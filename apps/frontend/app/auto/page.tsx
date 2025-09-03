"use client";
import { useState } from "react";
import Subnav from "@/components/layout/Subnav";
import StageTimeline from "@/components/dossier/StageTimeline";
import SectionCard from "@/components/dossier/SectionCard";

/**
 * Configuration for all venture dossier sections
 * Each section represents a key component of a venture pitch
 */
const SECTIONS = [
  { key: "executive", label: "Executive Summary" },
  { key: "problem", label: "Problem" },
  { key: "solution", label: "Solution" },
  { key: "market", label: "Market" },
  { key: "gtm", label: "Go-to-Market" },
  { key: "business", label: "Business Model" },
  { key: "financials", label: "Financials" },
  { key: "competition", label: "Competition" },
  { key: "roadmap", label: "Roadmap" },
  { key: "team", label: "Team" },
  { key: "ask", label: "Ask" },
];

export default function AutoPage() {
  const base = `/auto`;
  const [title, setTitle] = useState("HappyNest");
  const [pitch, setPitch] = useState("HappyNest ist das digitale Zuhause …");
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState({
    S1: "idle",
    S2: "idle",
    S3: "idle",
    S4: "idle",
  } as any);
  const [data, setData] = useState<any>(null);
  const [secState, setSecState] = useState<
    Record<string, "pending" | "running" | "done" | "error">
  >(() => Object.fromEntries(SECTIONS.map((s) => [s.key, "pending"])));

  async function run() {
    setError(null);
    setStages({ S1: "running", S2: "idle", S3: "idle", S4: "idle" });
    setSecState(Object.fromEntries(SECTIONS.map((s) => [s.key, "pending"])));
    setData(null);
    const url = "/api/auto/run";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_title: title, elevator_pitch: pitch }),
    });
    if (!res.ok) {
      setStages((p: any) => ({ ...p, S1: "error" }));
      setError(`API ${res.status}`);
      return;
    }
    setStages((p: any) => ({ ...p, S1: "done", S2: "running" }));
    const json = await res.json();
    // Wir simulieren "progressives" Eintreffen, indem wir die Sections seriell setzen:
    setData({ meta: json.meta, sections: {} });
    const secOrder = [
      "executive",
      "problem",
      "solution",
      "market",
      "gtm",
      "business",
      "financials",
      "competition",
      "roadmap",
      "team",
      "ask",
    ];
    for (const k of secOrder) {
      setSecState((s) => ({ ...s, [k]: "running" }));
      // kleine Pause für UX (200ms)
      // @ts-ignore
      await new Promise((r) => setTimeout(r, 200));
      const content = json.sections?.[k] || null;
      setData((prev: any) => {
        const nxt = { ...prev, sections: { ...prev.sections, [k]: content } };
        try {
          localStorage.setItem("last_dossier", JSON.stringify(nxt));
        } catch {}
        return nxt;
      });
      setSecState((s) => ({ ...s, [k]: content ? "done" : "pending" }));
    }
    setStages({ S1: "done", S2: "done", S3: "done", S4: "idle" });
  }

  return (
    <div>
      <Subnav
        base={base}
        items={[
          { slug: "", label: "Elevator Pitch" },
          { slug: "executive", label: "Executive" },
          { slug: "problem", label: "Problem" },
          { slug: "solution", label: "Solution" },
          { slug: "market", label: "Market" },
        ]}
      />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">
          Venture Dossier · Elevator Pitch
        </h1>
        <StageTimeline state={stages} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="text-sm font-medium">Projekttitel</label>
          <input
            className="w-full border rounded p-2 bg-white"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="text-sm font-medium">Elevator Pitch</label>
          <textarea
            className="w-full border rounded p-2 h-40 bg-white"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
          />
          <button
            onClick={run}
            className="rounded bg-indigo-600 text-white px-3 py-2"
          >
            Generate (Auto)
          </button>
          {error && <p className="text-sm text-red-600">⚠️ {error}</p>}
        </div>

        <div className="space-y-3">
          <div className="text-sm text-slate-500">Ergebnis</div>
          {SECTIONS.map((s) => (
            <SectionCard key={s.key} title={s.label} status={secState[s.key]}>
              <pre className="bg-slate-50 p-2 rounded text-xs overflow-auto">
                {JSON.stringify(
                  data?.sections?.[s.key] ??
                    (secState[s.key] === "running" ? "…" : "—"),
                  null,
                  2,
                )}
              </pre>
            </SectionCard>
          ))}
        </div>
      </div>
    </div>
  );
}
