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

export default function ElevatorPage({ params }: { params: { wsId: string } }) {
  const base = `/workspaces/${params.wsId}/dossier`;
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

    try {
      // 1) Job anlegen (asynchron über Render Backend direkt)
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://aigilexperience-backend.onrender.com";
      const jobRes = await fetch(`${backendUrl}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_title: title,
          elevator_pitch: pitch,
          use_assumptions: true
        }),
      });

      if (!jobRes.ok) {
        setStages((p: any) => ({ ...p, S1: "error" }));
        setError(`Job creation failed: ${jobRes.status}`);
        return;
      }

      const { jobId } = await jobRes.json();
      setStages((p: any) => ({ ...p, S1: "done", S2: "running" }));

      // 2) Progress via Server-Sent Events streamen
      const eventSource = new EventSource(`${backendUrl}/api/jobs/${jobId}/stream`);
      setData({ meta: { jobId }, sections: {} });

      eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === 'progress') {
          // Update UI mit Progress
          const { step, status } = message.payload;
          if (step) {
            setSecState((s) => ({ ...s, [step]: status || "running" }));
          }
        } else if (message.type === 'artifact') {
          // Einzelne Section ist fertig
          const { section, data: sectionData } = message.payload;
          if (section && sectionData) {
            setData((prev: any) => {
              const nxt = { 
                ...prev, 
                sections: { ...prev.sections, [section]: sectionData } 
              };
              try {
                localStorage.setItem("last_dossier", JSON.stringify(nxt));
              } catch {}
              return nxt;
            });
            setSecState((s) => ({ ...s, [section]: "done" }));
          }
        } else if (message.type === 'done') {
          // Job komplett fertig
          const finalData = message.payload;
          if (finalData?.sections) {
            setData((prev: any) => {
              const nxt = { ...prev, ...finalData };
              try {
                localStorage.setItem("last_dossier", JSON.stringify(nxt));
              } catch {}
              return nxt;
            });
            
            // Alle Sections als done markieren
            const doneState = Object.fromEntries(
              SECTIONS.map((s) => [s.key, finalData.sections[s.key] ? "done" : "pending"] as [string, "pending" | "running" | "done" | "error"])
            ) as Record<string, "pending" | "running" | "done" | "error">;
            setSecState(doneState);
          }
          setStages({ S1: "done", S2: "done", S3: "done", S4: "done" });
          eventSource.close();
        } else if (message.type === 'error') {
          setError(`Pipeline error: ${message.payload?.error || 'Unknown error'}`);
          setStages((p: any) => ({ ...p, S2: "error" }));
          eventSource.close();
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Error:', err);
        setError('Connection lost - please refresh');
        setStages((p: any) => ({ ...p, S2: "error" }));
        eventSource.close();
      };

      // Cleanup function speichern für späteren Gebrauch
      (window as any).currentEventSource = eventSource;
      
    } catch (error) {
      setStages((p: any) => ({ ...p, S1: "error" }));
      setError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <div>
      <Subnav
        base={base}
        items={[
          { slug: "elevator", label: "Elevator Pitch" },
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
