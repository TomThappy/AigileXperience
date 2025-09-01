"use client";
import { useState } from "react";

type Deck = {
  deck_meta: {
    project_name: string;
    language: string;
    target_audience?: string;
    assumptions: string[];
  };
  slides: { id: string; type: string; title?: string; key_points: string[] }[];
  missing_info_questions: string[];
  warnings: string[];
};

export default function Home() {
  const [project, setProject] = useState("HappyNest");
  const [pitch, setPitch] = useState("HappyNest ist das digitale Zuhause ...");
  const [result, setResult] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"live" | "dry">("live");

  async function generate() {
    setLoading(true);
    const res = await fetch(
      process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:3001/api/venture/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_title: project,
          elevator_pitch: pitch,
          mode,
        }),
      },
    );
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AigileXperience</h1>
        <nav className="text-sm space-x-4">
          <a className="hover:underline" href="#">
            Venture Dossier
          </a>
          <a className="hover:underline opacity-60">Strategie (bald)</a>
          <a className="hover:underline opacity-60">Roadmap (bald)</a>
          <a className="hover:underline opacity-60">Backlog (bald)</a>
        </nav>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-sm font-medium">Projekttitel</label>
          <input
            className="w-full border rounded p-2"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
          <label className="block text-sm font-medium">Elevator Pitch</label>
          <textarea
            className="w-full border rounded p-2 h-40"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <label className="text-sm">Modus:</label>
            <select
              className="border rounded p-1"
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
            >
              <option value="live">Live (LLM)</option>
              <option value="dry">Dry-Run (token-sparend)</option>
            </select>
            <button
              onClick={generate}
              disabled={loading}
              className="ml-auto rounded bg-black text-white px-4 py-2"
            >
              {loading ? "Erzeuge…" : "Generieren"}
            </button>
          </div>
        </div>

        <div className="border rounded p-3 bg-white">
          <h2 className="font-semibold mb-2">Ergebnis</h2>
          {!result && (
            <p className="text-sm text-gray-500">Noch nichts erzeugt.</p>
          )}
          {result && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-medium">
                  {result.deck_meta.project_name}
                </div>
                <div className="text-gray-500">
                  {result.deck_meta.target_audience || "—"}
                </div>
              </div>
              <div>
                <h3 className="font-semibold">Slides</h3>
                <ul className="list-disc pl-5 text-sm">
                  {result.slides?.map((s) => (
                    <li key={s.id}>
                      <span className="font-medium">{s.type}</span>
                      {s.title ? ` – ${s.title}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
              {result.missing_info_questions?.length > 0 && (
                <div>
                  <h3 className="font-semibold">Offene Fragen</h3>
                  <ol className="list-decimal pl-5 text-sm">
                    {result.missing_info_questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
