"use client";
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useSSE } from "@/lib/useSSE";
import StageTimeline from "@/components/dossier/StageTimeline";
import SectionCard from "@/components/dossier/SectionCard";
import { MarketBar, KPILine } from "@/components/Charts";

/**
 * Throttled history API protection
 * Prevents excessive replaceState calls while allowing normal navigation
 */
if (typeof window !== "undefined") {
  // Throttle history API calls to prevent excessive usage
  if (!(window as any).__HISTORY_THROTTLED__) {
    (window as any).__HISTORY_THROTTLED__ = true;

    const originalReplaceState = window.history.replaceState;
    let replaceCount = 0;
    let lastReplaceTime = 0;

    window.history.replaceState = function (...args) {
      const now = Date.now();

      // Reset counter every 10 seconds
      if (now - lastReplaceTime > 10000) {
        replaceCount = 0;
      }

      replaceCount++;

      // Allow reasonable number of calls (10 per 10 seconds)
      if (replaceCount > 10) {
        if (replaceCount === 11) {
          console.warn(
            "[THROTTLED] Excessive replaceState calls - throttling active",
          );
        }
        return; // Throttle but don't completely block
      }

      lastReplaceTime = now;
      return originalReplaceState.apply(this, args);
    };

    console.log("✅ History API throttling enabled (10 calls/10s limit)");
  }
}

/**
 * Throttled router utility to prevent excessive URL updates
 * Only allows URL changes every 3 seconds maximum
 */
const useThrottledRouter = () => {
  const lastUpdateRef = useRef(0);
  const lastUrlRef = useRef("");

  const throttledReplace = useCallback((url: string) => {
    const now = Date.now();

    // Skip if URL is the same
    if (lastUrlRef.current === url) return;

    // Skip if less than 3 seconds since last update
    if (now - lastUpdateRef.current < 3000) {
      console.log("[Router] Throttled URL update:", url);
      return;
    }

    lastUpdateRef.current = now;
    lastUrlRef.current = url;

    // Do NOT use router.replace - keep URL completely stable
    console.log("[Router] URL update blocked for stability:", url);
  }, []);

  return { throttledReplace };
};

/**
 * Dossier structure type definition
 */
type Dossier = {
  sections: Partial<
    Record<
      | "executive_summary"
      | "problem"
      | "solution"
      | "market"
      | "gtm"
      | "business_model"
      | "competition"
      | "team"
      | "status_quo"
      | "financial_plan",
      { headline?: string; bullets?: string[]; narrative?: string; data?: any }
    >
  >;
  charts?: Array<{
    id: string;
    type: "line" | "bar";
    title: string;
    x: string[];
    series: Array<{ name: string; values: number[] }>;
  }>;
  meta?: { version?: string; generated_at?: string; jobId?: string };
};

/**
 * Configuration for all venture dossier sections
 * Maps backend keys to display labels
 */
const SECTIONS = [
  { key: "executive_summary", label: "Executive Summary" },
  { key: "problem", label: "Problem" },
  { key: "solution", label: "Solution" },
  { key: "market", label: "Market" },
  { key: "gtm", label: "Go-to-Market" },
  { key: "business_model", label: "Business Model" },
  { key: "competition", label: "Competition" },
  { key: "team", label: "Team" },
  { key: "status_quo", label: "Status Quo" },
  { key: "financial_plan", label: "Financial Plan" },
];

// Step to stage mapping for consistent S-badge updates
type StageKey = "S1" | "S2" | "S3" | "S4";
const STEP_TO_STAGE: Record<string, StageKey> = {
  input: "S1",
  evidence: "S1",
  brief: "S1",
  problem: "S2",
  solution: "S2",
  team: "S2",
  market: "S2",
  business_model: "S2",
  competition: "S2",
  status_quo: "S2",
  gtm: "S2",
  financial_plan: "S2",
  validate: "S3",
  investor_score: "S4",
  assembly: "S4",
};

/**
 * Component to render section content with progressive filling
 */
function SectionContent({
  section,
  status,
}: {
  section: any;
  status: "pending" | "running" | "done" | "error";
}) {
  if (status === "pending") {
    return null; // Don't render empty boxes
  }

  if (status === "running") {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-sm text-slate-500">
          <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
          <span>Writing...</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return <div className="text-red-500 italic">Error loading content</div>;
  }

  if (!section) {
    return <div className="text-slate-400 text-sm">(no data yet)</div>;
  }

  return (
    <div className="space-y-4">
      {section.headline && (
        <h4 className="font-semibold text-slate-900 text-lg">
          {section.headline}
        </h4>
      )}

      {section.narrative && (
        <p className="text-slate-700 leading-relaxed">{section.narrative}</p>
      )}

      {section.bullets && Array.isArray(section.bullets) && (
        <ul className="space-y-2">
          {section.bullets.map((bullet: string, i: number) => (
            <li key={i} className="flex items-start space-x-3">
              <span className="text-indigo-600 mt-1.5 flex-shrink-0">•</span>
              <span className="text-slate-700">{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {section.data && (
        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
          <div className="text-sm font-medium text-slate-700">Key Metrics</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(section.data).map(([key, value]) => {
              if (key.startsWith("_")) return null; // skip meta keys
              return (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-slate-600 capitalize text-sm">
                    {key.replace(/_/g, " ")}:
                  </span>
                  <span className="text-slate-900 font-medium text-sm">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {section.assumptions && Array.isArray(section.assumptions) && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-700">
            Key Assumptions
          </div>
          <div className="flex flex-wrap gap-2">
            {section.assumptions
              .slice(0, 4)
              .map((assumption: string, i: number) => (
                <span
                  key={i}
                  className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm"
                >
                  {assumption.slice(0, 60)}
                  {assumption.length > 60 ? "..." : ""}
                </span>
              ))}
          </div>
        </div>
      )}

      {section.open_questions && Array.isArray(section.open_questions) && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-700">
            Open Questions
          </div>
          <div className="flex flex-wrap gap-2">
            {section.open_questions
              .slice(0, 3)
              .map((question: string, i: number) => (
                <span
                  key={i}
                  className="inline-block bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm"
                >
                  {question.slice(0, 80)}
                  {question.length > 80 ? "..." : ""}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Charts section component
 */
function ChartsSection({ charts }: { charts?: Array<any> }) {
  if (!charts || charts.length === 0) return null;

  return (
    <SectionCard title="Charts & Metrics" status="done">
      <div className="space-y-6">
        {charts.map((chart, i) => (
          <div key={i} className="space-y-3">
            <h5 className="font-medium text-slate-900">{chart.title}</h5>
            {chart.type === "bar" && (
              <MarketBar
                tam={chart.series[0]?.values[0] || 0}
                sam={chart.series[0]?.values[1] || 0}
                som={chart.series[0]?.values[2] || 0}
              />
            )}
            {chart.type === "line" && (
              <KPILine
                y1={chart.series[0]?.values[0] || 0}
                y2={chart.series[0]?.values[1] || 0}
                y3={chart.series[0]?.values[2] || 0}
              />
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/**
 * Generate executive summary from existing sections
 */
function generateExecutiveSummary(sections: any): string {
  const parts = [];

  if (sections.problem?.narrative) {
    parts.push(sections.problem.narrative.split(".")[0] + ".");
  }

  if (sections.solution?.narrative) {
    parts.push(sections.solution.narrative.split(".")[0] + ".");
  }

  if (sections.market?.data?.tam) {
    parts.push(`The total addressable market is ${sections.market.data.tam}.`);
  }

  return parts.slice(0, 3).join(" ");
}

/**
 * Progress bar component
 */
function ProgressBar({ progress }: { progress: number }) {
  if (progress === 0 || progress === 100) return null;

  return (
    <div className="w-full bg-slate-200 rounded-full h-1 mb-6">
      <div
        className="bg-indigo-600 h-1 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
}

function ElevatorPageComponent({ params }: { params: { wsId: string } }) {
  const { throttledReplace } = useThrottledRouter();

  const [title, setTitle] = useState("");
  const [pitch, setPitch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dryRunWarning, setDryRunWarning] = useState(false);

  // Stage management for S-badges
  const [stages, setStages] = useState({
    S1: "idle",
    S2: "idle",
    S3: "idle",
    S4: "idle",
  } as any);

  // Main dossier state
  const [dossier, setDossier] = useState<Dossier>({ sections: {} });

  // Section status tracking
  const [secState, setSecState] = useState<
    Record<string, "pending" | "running" | "done" | "error">
  >({});

  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Prevent excessive re-renders
  const stableBackendUrl = useRef(
    process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://aigilexperience-backend.onrender.com",
  ).current;

  // URL update protection - only allow jobId and terminal states
  const urlUpdateRef = useRef({ hasUpdatedForJob: false, lastJobId: "" });

  // Optimized with useCallback for expensive operations (CodeRabbit suggestion)
  const updateUrlIfNeeded = useCallback(
    (newJobId: string | null, isTerminal = false) => {
      if (!newJobId) return;

      const { hasUpdatedForJob, lastJobId } = urlUpdateRef.current;

      // Only update URL once per jobId, and once on completion
      if (newJobId !== lastJobId) {
        urlUpdateRef.current = { hasUpdatedForJob: false, lastJobId: newJobId };
      }

      if (!hasUpdatedForJob || isTerminal) {
        // Block all URL updates for maximum stability
        console.log("[URL] Blocked update for stability:", {
          jobId: newJobId,
          isTerminal,
        });
        urlUpdateRef.current.hasUpdatedForJob = true;
      }
    },
    [], // Empty dependency array for maximum stability
  );

  // Check for dry run mode on mount
  useEffect(() => {
    let mounted = true;

    const initializeData = async () => {
      await checkBackendConfig();

      // Start with clean state - don't load cached data on app start
      // User should explicitly start a new generation
    };

    initializeData();

    return () => {
      mounted = false;
    };
  }, []);

  // Optimized with useCallback for expensive operations (CodeRabbit suggestion)
  const checkBackendConfig = useCallback(async () => {
    try {
      const res = await fetch(`${stableBackendUrl}/api/config`);
      if (res.ok) {
        const config = await res.json();
        if (config.env_flags?.LLM_DRY_RUN === "true") {
          setDryRunWarning(true);
        }
      }
    } catch (e) {
      console.warn("Could not fetch backend config:", e);
    }
  }, [stableBackendUrl]); // Stable dependency for optimal performance

  // Robust SSE hook for streaming job progress
  useSSE(
    jobId || "",
    {
      status: (evt) => {
        const status = evt?.payload?.status || evt?.status;
        if (status === "completed") {
          setStages({ S1: "done", S2: "done", S3: "done", S4: "done" });
          setProgress(100);
          setTimeout(() => setProgress(0), 2000); // Hide after completion
        }
      },
      progress: (evt) => {
        const { step, percentage, currentStep, totalSteps } =
          evt.payload || evt;

        // Update progress bar - throttled
        if (percentage && Math.abs(percentage - progress) > 5) {
          setProgress(percentage);
        }

        // Update S-badges based on step - prevent unnecessary updates + NO URL UPDATES
        if (step && STEP_TO_STAGE[step]) {
          const stage = STEP_TO_STAGE[step];

          setStages((currentStages: any) => {
            // Only update if stage status is actually changing
            if (currentStages[stage] === "running") {
              return currentStages; // No change needed
            }

            const newStages = { ...currentStages, [stage]: "running" };

            // Mark previous stages as done
            const stageOrder = ["S1", "S2", "S3", "S4"];
            const currentIndex = stageOrder.indexOf(stage);
            if (currentIndex > 0) {
              for (let i = 0; i < currentIndex; i++) {
                if (newStages[stageOrder[i]] !== "done") {
                  newStages[stageOrder[i]] = "done";
                }
              }
            }

            return newStages;
          });

          // NO URL UPDATES - Keep URL completely stable during progress
        }
      },
      artifact_written: async (evt) => {
        const key = evt?.payload?.key || evt?.key;
        if (key === "final_dossier" && jobId) {
          try {
            const res = await fetch(
              `${stableBackendUrl}/api/jobs/${jobId}/artifacts/final_dossier`,
            );
            if (res.ok) {
              const artifact = await res.json();
              const sections = artifact?.sections || {};
              const charts = artifact?.charts;

              setDossier((prev) => {
                // Prevent unnecessary updates
                const hasNewData = Object.keys(sections).some(
                  (key) =>
                    !prev.sections[key] ||
                    JSON.stringify(prev.sections[key]) !==
                      JSON.stringify(sections[key]),
                );

                if (!hasNewData && !charts) {
                  return prev; // No changes needed
                }

                const updated = {
                  ...prev,
                  sections: { ...prev.sections, ...sections },
                  ...(charts && { charts }),
                  meta: artifact.meta,
                };

                // Store in localStorage with throttling
                try {
                  const lastStored = localStorage.getItem(
                    "last_dossier_timestamp",
                  );
                  const now = Date.now();
                  if (!lastStored || now - parseInt(lastStored) > 1000) {
                    localStorage.setItem(
                      "last_dossier",
                      JSON.stringify(updated),
                    );
                    localStorage.setItem(
                      "last_dossier_timestamp",
                      now.toString(),
                    );
                  }
                } catch {}

                return updated;
              });

              // Mark received sections as done - prevent unnecessary updates
              setSecState((currentState) => {
                const hasChanges = Object.keys(sections).some(
                  (k) => currentState[k] !== "done",
                );
                if (!hasChanges) {
                  return currentState; // No changes needed
                }

                const next = { ...currentState };
                Object.keys(sections).forEach((k) => {
                  next[k] = "done";
                });
                return next;
              });
            }
          } catch (e) {
            setError(
              `Artifact fetch failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
      },
      result: (evt) => {
        const payload = evt.payload || evt;
        const sections = payload?.data?.sections || payload?.sections;
        if (sections) {
          setDossier((prev) => {
            const updated = {
              ...prev,
              sections: { ...prev.sections, ...sections },
            };

            try {
              localStorage.setItem("last_dossier", JSON.stringify(updated));
            } catch {}

            return updated;
          });

          setSecState((s) => {
            const next = { ...s };
            Object.keys(sections).forEach((k) => {
              next[k] = "done";
            });
            return next;
          });
        }
      },
      error: (evt) => {
        setError(
          `Pipeline error: ${evt?.payload?.error || evt?.message || "Unknown error"}`,
        );
        setStages((p: any) => ({ ...p, S2: "error" }));
        setProgress(0);
      },
      done: (evt) => {
        setStages({ S1: "done", S2: "done", S3: "done", S4: "done" });
        setProgress(100);
        setTimeout(() => setProgress(0), 2000);

        // Update URL only on terminal completion
        if (jobId) {
          updateUrlIfNeeded(jobId, true);
        }
      },
      connection_lost: () => {
        setError("Connection lost. Job may still be processing in background.");
      },
    },
    {
      idleMs: 25000,
      hardTimeoutMs: 12 * 60 * 1000,
    },
  );

  async function run() {
    setError(null);
    setStages({ S1: "running", S2: "idle", S3: "idle", S4: "idle" });
    setSecState({});
    setDossier({ sections: {} });
    setJobId(null);
    setProgress(5);

    try {
      const nowNonce = Date.now().toString();
      const jobRes = await fetch(`${stableBackendUrl}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_title: String(title || "").trim(),
          elevator_pitch: String(pitch || "").trim(),
          language: "de",
          target: "Pre-Seed VCs",
          geo: "EU/DE",
          // Cache-busting controls
          force_rebuild: true,
          nonce: nowNonce,
        }),
      });

      if (!jobRes.ok) {
        setStages((p: any) => ({ ...p, S1: "error" }));
        setError(`Job creation failed: ${jobRes.status}`);
        setProgress(0);
        return;
      }

      const { jobId: newJobId } = await jobRes.json();
      setStages((p: any) => ({ ...p, S1: "done", S2: "running" }));
      setDossier({ meta: { jobId: newJobId }, sections: {} });
      setJobId(newJobId);
      setProgress(10);

      // Update URL only ONCE when jobId is first available
      updateUrlIfNeeded(newJobId, false);
    } catch (error) {
      setStages((p: any) => ({ ...p, S1: "error" }));
      setError(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      setProgress(0);
    }
  }

  // Generate executive summary if not present
  const executiveSummary =
    dossier.sections.executive_summary ||
    (Object.keys(dossier.sections).length > 2
      ? {
          narrative: generateExecutiveSummary(dossier.sections),
        }
      : null);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Progress Bar */}
      <ProgressBar progress={progress} />

      {/* Warning Banners */}
      {dryRunWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-600">⚠️</span>
            <span className="text-yellow-800 text-sm">
              Dry-run mode is active. Results may be mock data.
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-red-600">❌</span>
              <span className="text-red-800 text-sm">{error}</span>
            </div>
            <button
              onClick={run}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Content - Single Column Layout */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Venture Dossier</h1>
          <StageTimeline state={stages} />
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Project Title
            </label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter your project title..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Elevator Pitch
            </label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 h-32 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              placeholder="Describe your venture in a compelling pitch..."
            />
          </div>

          <button
            onClick={run}
            disabled={stages.S1 === "running" || stages.S2 === "running"}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Generate (Auto)
          </button>
        </div>

        {/* Sections - Progressive Rendering */}
        {executiveSummary && (
          <SectionCard title="Executive Summary" status="done">
            <SectionContent section={executiveSummary} status="done" />
          </SectionCard>
        )}

        {SECTIONS.map((section) => {
          const sectionData =
            dossier.sections[section.key as keyof typeof dossier.sections];
          const status = secState[section.key] || "pending";

          // Only render if we have data or it's currently running
          if (!sectionData && status === "pending") return null;

          return (
            <SectionCard
              key={section.key}
              title={section.label}
              status={status}
            >
              <SectionContent section={sectionData} status={status} />
            </SectionCard>
          );
        })}

        {/* Charts Section */}
        <ChartsSection charts={dossier.charts} />
      </div>
    </div>
  );
}

// CRITICAL: Wrap with React.memo to prevent unnecessary re-renders
// This should stop any infinite render loops
const ElevatorPage = memo(ElevatorPageComponent);
export default ElevatorPage;
