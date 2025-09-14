"use client";

/**
 * Pipeline stages for the venture dossier generation process
 */
export type Stage = "S1" | "S2" | "S3" | "S4";

/**
 * Visual timeline component showing the progress of the AI pipeline stages with substep details
 * @param state - Current state of each pipeline stage with substep information
 */
export default function StageTimeline({
  state,
}: {
  state: Record<Stage, any>; // Enhanced structure with status, currentStep, substep
}) {
  const pill = (k: Stage, l: string) => {
    const stageData = state[k];
    const s = stageData?.status || "idle";
    const currentStep = stageData?.currentStep || "";
    const substep = stageData?.substep || "";
    
    const cls =
      s === "done"
        ? "bg-green-600"
        : s === "running"
          ? "bg-indigo-600 animate-pulse"
          : s === "error"
            ? "bg-red-600"
            : "bg-slate-300";
            
    // Show current substep if running
    const displayText = s === "running" && currentStep 
      ? `${k}: ${currentStep.slice(0, 8)}...` 
      : `${k} ${l}`;
      
    return (
      <div 
        className={`px-2 py-1 rounded text-white text-xs ${cls}`}
        title={s === "running" && substep ? `Running: ${substep}` : `${k} ${l} (${s})`}
      >
        {displayText}
      </div>
    );
  };
  
  return (
    <div className="flex gap-2 items-center">
      {pill("S1", "Analyze")}
      {pill("S2", "Sections")}
      {pill("S3", "Polish")}
      {pill("S4", "Score")}
    </div>
  );
}
