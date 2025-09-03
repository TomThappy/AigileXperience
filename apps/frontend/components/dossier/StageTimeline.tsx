"use client";

/**
 * Pipeline stages for the venture dossier generation process
 */
export type Stage = "S1"|"S2"|"S3"|"S4";

/**
 * Visual timeline component showing the progress of the AI pipeline stages
 * @param state - Current state of each pipeline stage
 */
export default function StageTimeline({ state }:{ state:Record<Stage,"idle"|"running"|"done"|"error"> }){
  const pill = (k:Stage,l:string)=>{
    const s=state[k];
    const cls = s==="done" ? "bg-green-600" : s==="running" ? "bg-indigo-600 animate-pulse" : s==="error" ? "bg-red-600" : "bg-slate-300";
    return <div className={`px-2 py-1 rounded text-white text-xs ${cls}`}>{k} {l}</div>;
  };
  return (
    <div className="flex gap-2 items-center">
      {pill("S1","Analyse")}
      {pill("S2","Integration")}
      {pill("S3","Polish")}
      {pill("S4","Scoring")}
    </div>
  );
}
