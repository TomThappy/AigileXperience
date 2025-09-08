"use client";
import { useState } from "react";
import StageTimeline from "@/components/dossier/StageTimeline";
import SectionCard from "@/components/dossier/SectionCard";
import { useSSE } from "@/lib/useSSE";

/**
 * Venture dossier sections as produced by backend final_dossier artifact
 */
const SECTIONS = [
  { key: "executive_summary", label: "Executive Summary" },
  { key: "problem", label: "Problem" },
  { key: "solution", label: "Solution" },
  { key: "market", label: "Market" },
  { key: "gtm", label: "Go-to-Market" },
  { key: "business_model", label: "Business Model" },
  { key: "competition", label: "Competition" },
  { key: "status_quo", label: "Status Quo" },
  { key: "financial_plan", label: "Financials" },
];

export default function AutoPage() {
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
  const [jobId, setJobId] = useState<string | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://aigilexperience-backend.onrender.com";

  // Use robust SSE hook for streaming job progress
  useSSE(
    jobId || "",
    {
      status: (evt) => {
        // color S-badges by status if present
        const status = evt?.payload?.status || evt?.status;
        if (status === "completed") {
          setStages({ S1: "done", S2: "done", S3: "done", S4: "done" });
        }
      },
      progress: (evt) => {
        const { step, status } = evt.payload || evt;
        // Map pipeline step to S badges
        const map: Record<string, keyof typeof stages> = {
          analyze: "S1",
          integration: "S2",
          polish: "S3",
          scoring: "S4",
        };
        if (step && map[step]) {
          setStages((s: any) => ({ ...s, [map[step]]: status || "running" }));
        }
      },
      artifact_written: async (evt) => {
        // Priority: fetch full final_dossier artifact when written
        const key = evt?.payload?.key || evt?.key;
        if (key === "final_dossier" && jobId) {
          try {
            const res = await fetch(
              `${backendUrl}/api/jobs/${jobId}/artifacts/final_dossier`,
            );
            if (res.ok) {
              const artifact = await res.json();
              const sections = artifact?.sections || {};
              setData((prev: any) => {
                const nxt = {
                  ...prev,
                  sections: { ...(prev?.sections || {}), ...sections },
                };
                try {
                  localStorage.setItem("last_dossier", JSON.stringify(nxt));
                } catch {}
                return nxt;
              });
              // mark any received sections as done
              setSecState((s) => {
                const next = { ...s } as Record<
                  string,
                  "pending" | "running" | "done" | "error"
                >;
                Object.keys(sections).forEach((k) => {
                  if (k in next) next[k] = "done";
                });
                return next;
              });
            }
          } catch (e) {
            setError(
              `Artifact fetch failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
          return;
        }
        // Fallback: section-level artifact events
        const { section, data: sectionData } = evt.payload || evt;
        if (section && sectionData) {
          setData((prev: any) => {
            const nxt = {
              ...prev,
              sections: { ...(prev?.sections || {}), [section]: sectionData },
            };
            try {
              localStorage.setItem("last_dossier", JSON.stringify(nxt));
            } catch {}
            return nxt;
          });
          setSecState((s) => ({ ...s, [section]: "done" }));
        }
      },
      result: (evt) => {
        // Fallback: if result includes sections, merge
        const payload = evt.payload || evt;
        const sections = payload?.data?.sections || payload?.sections;
        if (sections) {
          setData((prev: any) => {
            const nxt = {
              ...prev,
              sections: { ...(prev?.sections || {}), ...sections },
            };
            try {
              localStorage.setItem("last_dossier", JSON.stringify(nxt));
            } catch {}
            return nxt;
          });
          setSecState((s) => {
            const next = { ...s } as Record<
              string,
              "pending" | "running" | "done" | "error"
            >;
            Object.keys(sections).forEach((k) => {
              if (k in next) next[k] = "done";
            });
            return next;
          });
        }
      },
      error: (evt) => {
        setError(
          `Pipeline error: ${evt?.payload?.error || (evt as any)?.message || "Unknown error"}`,
        );
        setStages((p: any) => ({ ...p, S2: "error" }));
      },
      done: (evt) => {
        // Only mark done when server says done
        const finalData = evt.payload || evt;
        if (finalData?.sections) {
          setData((prev: any) => {
            const nxt = {
              ...prev,
              ...finalData,
              sections: {
                ...(prev?.sections || {}),
                ...(finalData.sections || {}),
              },
            };
            try {
              localStorage.setItem("last_dossier", JSON.stringify(nxt));
            } catch {}
            return nxt;
          });
          const doneState = Object.fromEntries(
            SECTIONS.map(
              (s) =>
                [s.key, finalData.sections[s.key] ? "done" : "pending"] as [
                  string,
                  "pending" | "running" | "done" | "error",
                ],
            ),
          ) as Record<string, "pending" | "running" | "done" | "error">;
          setSecState(doneState);
        }
        setStages({ S1: "done", S2: "done", S3: "done", S4: "done" });
      },
      message: (evt) => {
        try {
          if (evt.type === "progress") {
            const { step, status } = evt.payload || evt;
            const map: Record<string, keyof typeof stages> = {
              analyze: "S1",
              integration: "S2",
              polish: "S3",
              scoring: "S4",
            };
            if (step && map[step]) {
              setStages((s: any) => ({
                ...s,
                [map[step]]: status || "running",
              }));
            }
          }
        } catch (err) {
          console.error("Failed to parse SSE message:", err, "Raw data:", evt);
        }
      },
      connection_lost: () => {
        setConnectionLost(true);
        setError(
          "Connection lost. Job may still be processing in background. Please check job status.",
        );
      },
    },
    {
      idleMs: 25000, // must be < server heartbeat
      hardTimeoutMs: 12 * 60 * 1000,
    },
  );

  async function run() {
    setError(null);
    setConnectionLost(false);
    setStages({ S1: "running", S2: "idle", S3: "idle", S4: "idle" });
    setSecState(Object.fromEntries(SECTIONS.map((s) => [s.key, "pending"])));
    setData(null);
    setJobId(null);

    try {
      const jobRes = await fetch(`${backendUrl}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_title: title,
          elevator_pitch: pitch,
          use_assumptions: true,
        }),
      });

      if (!jobRes.ok) {
        setStages((p: any) => ({ ...p, S1: "error" }));
        setError(`Job creation failed: ${jobRes.status}`);
        return;
      }

      const { jobId: newJobId } = await jobRes.json();
      setStages((p: any) => ({ ...p, S1: "done", S2: "running" }));
      setData({ meta: { jobId: newJobId }, sections: {} });
      setJobId(newJobId); // triggers SSE
    } catch (error) {
      setStages((p: any) => ({ ...p, S1: "error" }));
      setError(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">
          Venture Dossier
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
