"use client";
import React from "react";

/**
 * Status-aware card component for displaying dossier section content
 * @param title - Section title (e.g., "Executive Summary")
 * @param status - Current processing status of the section
 * @param children - Section content to display
 */
export default function SectionCard({title, status, children}:{title:string; status:"pending"|"running"|"done"|"error"; children:React.ReactNode}){
  const badge = status==="done" ? "✅" : status==="running" ? "⏳" : status==="error" ? "⚠️" : "•";
  return (
    <div className="border rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">{title}</div>
        <div className="text-xs">{badge}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}
