"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const modules = [
  { href: "/auto", label: "Venture Dossier" },
  { href: "/strategy", label: "Strategie (bald)" },
  { href: "/roadmap", label: "Roadmap (bald)" },
  { href: "/backlog", label: "Backlog (bald)" },
  { href: "/pm", label: "Projekt Mgmt (bald)" },
];

export default function AppShell({ children, right }: { children: React.ReactNode; right?: React.ReactNode; }) {
  const path = usePathname();
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Topbar */}
      <div className="h-12 px-4 flex items-center justify-between border-b bg-white">
        <div className="font-semibold">AigileXperience</div>
        <div className="text-xs text-slate-500">Trace: on demand • Exports: soon</div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 border-r bg-white min-h-[calc(100vh-3rem)] p-3">
          <div className="text-xs uppercase text-slate-500 mb-2">Module</div>
          <nav className="space-y-1">
            {modules.map(m => {
              const active = path?.startsWith(m.href);
              return (
                <Link key={m.href} href={m.href as any} className={`block rounded px-3 py-2 text-sm ${active ? "bg-indigo-600 text-white" : "hover:bg-slate-100"}`}>
                  {m.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content + Right rail */}
        <main className="flex-1 p-6">{children}</main>
        <aside className="w-80 border-l bg-white p-4 hidden xl:block">
          {right ?? <div className="text-sm text-slate-500">Right Rail – Assumptions, Open Questions, Actions</div>}
        </aside>
      </div>
    </div>
  );
}
