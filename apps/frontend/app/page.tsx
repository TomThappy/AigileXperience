"use client";
import { useState, useTransition } from "react";
import { MarketBar, UseOfFundsPie, KPILine } from "../components/Charts";

type Slide = { id: string; type: string; title?: string; key_points: string[] };
type Deck = {
  deck_meta: {
    project_name: string;
    language: string;
    target_audience?: string;
    assumptions: string[];
  };
  slides: Slide[];
  missing_info_questions: string[];
  warnings: string[];
};

export default function Home() {
  const [project, setProject] = useState("HappyNest");
  const [pitch, setPitch] = useState("HappyNest ist das digitale Zuhause …");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loadingStep, setLoadingStep] = useState<0 | 1 | 2 | 3>(0); // 1 Analyze, 2 Assume, 3 Render
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  const [isPending, startTransition] = useTransition();

  function Step({ n, label }: { n: 1 | 2 | 3; label: string }) {
    const active = loadingStep === n;
    const done = loadingStep > n;
    return (
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`h-5 w-5 rounded-full flex items-center justify-center border ${done ? "bg-green-500 text-white" : active ? "animate-spin border-gray-400" : "bg-gray-200"}`}
        >
          {done ? "✓" : active ? "⏳" : n}
        </span>
        <span className={`${done ? "line-through" : ""}`}>{label}</span>
      </div>
    );
  }

  async function runPipeline(mode: "live" | "assume" | "assume_llm") {
    setDeck(null);
    setLoadingStep(1);
    // Step 1: Analyze (LLM skeleton)
    let res = await fetch(
      process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:3001/api/venture/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_title: project,
          elevator_pitch: pitch,
          mode: mode === "assume_llm" ? "live" : "live",
        }),
      },
    );
    let d: Deck = await res.json();
    setLoadingStep(2);

    if (mode === "assume" || mode === "assume_llm") {
      // Step 2: Fill with best assumptions (server-side deterministic + optional LLM refinement)
      res = await fetch(
        process.env.NEXT_PUBLIC_API_URL ||
          "http://localhost:3001/api/venture/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_title: project,
            elevator_pitch: pitch,
            mode: mode,
          }),
        },
      );
      d = await res.json();
    }
    setLoadingStep(3);
    startTransition(() => {
      setDeck(d);
      setLoadingStep(0);
    });
  }

  async function recalc() {
    if (!deck) return;
    const res = await fetch(
      process.env.NEXT_PUBLIC_API_RECALC_URL ||
        "http://localhost:3001/api/venture/recalc",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck, overrides }),
      },
    );
    const d = await res.json();
    startTransition(() => setDeck(d));
  }

  // Extract simple chart inputs from deck
  const marketSlide = deck?.slides.find((s) => s.type === "market");
  const askSlide = deck?.slides.find((s) => s.type === "ask");
  const finSlide = deck?.slides.find((s) => s.type === "financials");

  // naive parse helpers
  const m = {
    tam: undefined as any,
    sam: undefined as any,
    som: undefined as any,
  };
  marketSlide?.key_points.forEach((k) => {
    const num = (k.match(/([\d\.]+[\d\.]*)/g) || [])
      .join("")
      .replace(/\./g, "");
    if (k.startsWith("TAM")) m.tam = Number(num);
    if (k.startsWith("SAM")) m.sam = Number(num);
    if (k.startsWith("SOM")) m.som = Number(num);
  });

  const uof = { product: 0.45, growth: 0.35, ops: 0.2 };
  askSlide?.key_points.forEach((k) => {
    const mm = k.match(/Product (\d+)% .* Growth (\d+)% .* Ops (\d+)%/);
    if (mm) {
      uof.product = +mm[1] / 100;
      uof.growth = +mm[2] / 100;
      uof.ops = +mm[3] / 100;
    }
  });

  const kp = { y1: 60000, y2: 200000, y3: 600000 };
  finSlide?.key_points.forEach((k) => {
    const mm = k.match(/MAU Y1–Y3: ([\d\.]+) .* ([\d\.]+) .* ([\d\.]+)/);
    if (mm) {
      kp.y1 = Number(mm[1].replace(/\./g, ""));
      kp.y2 = Number(mm[2].replace(/\./g, ""));
      kp.y3 = Number(mm[3].replace(/\./g, ""));
    }
  });

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AigileXperience</h1>
        <nav className="text-sm space-x-4">
          <a
            className="hover:underline bg-amber-500 text-white px-3 py-1 rounded"
            href="/workspaces/demo/dossier/elevator"
          >
            🚀 Neue Dossier-Ansicht
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
          <div className="space-y-2 border rounded p-3 bg-white">
            <div className="flex items-center gap-4">
              <Step n={1} label="Analyse (LLM)" />
              <Step n={2} label="Best-Guess Annahmen füllen" />
              <Step n={3} label="Rendern" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => runPipeline("live")}
                className="rounded bg-black text-white px-3 py-2"
              >
                Live (nur LLM)
              </button>
              <button
                onClick={() => runPipeline("assume")}
                className="rounded bg-gray-900 text-white px-3 py-2"
              >
                Live + Assumptions
              </button>
              <button
                onClick={() => runPipeline("assume_llm")}
                className="rounded bg-indigo-700 text-white px-3 py-2"
              >
                Live + Assumptions + LLM-Feinschliff
              </button>
            </div>
          </div>
        </div>

        <div className="border rounded p-3 bg-white">
          <h2 className="font-semibold mb-2">Ergebnis</h2>
          {!deck && (
            <p className="text-sm text-gray-500">Noch nichts erzeugt.</p>
          )}
          {deck && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-medium">{deck.deck_meta.project_name}</div>
                <div className="text-gray-500">
                  {deck.deck_meta.target_audience || "—"}
                </div>
              </div>

              <div>
                <h3 className="font-semibold">Slides</h3>
                <ul className="list-disc pl-5 text-sm">
                  {deck.slides?.map((s) => (
                    <li key={s.id}>
                      <span className="font-medium">{s.type}</span>
                      {s.title ? ` – ${s.title}` : ""}
                    </li>
                  ))}
                </ul>
              </div>

              {deck.missing_info_questions?.length > 0 && (
                <div>
                  <h3 className="font-semibold">Offene Fragen</h3>
                  <ol className="list-decimal pl-5 text-sm">
                    {deck.missing_info_questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-1">Assumptions</h3>
                <ul className="list-disc pl-5 text-sm">
                  {deck.deck_meta.assumptions?.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Overrides (optional)</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label>
                    ARPU €/Monat{" "}
                    <input
                      className="border rounded p-1 w-full"
                      placeholder="3.2"
                      onChange={(e) =>
                        setOverrides((o) => ({
                          ...o,
                          "pricing.arpu_month": Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    Free→Paid %{" "}
                    <input
                      className="border rounded p-1 w-full"
                      placeholder="6"
                      onChange={(e) =>
                        setOverrides((o) => ({
                          ...o,
                          "pricing.free_to_paid": Number(e.target.value) / 100,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Raise €{" "}
                    <input
                      className="border rounded p-1 w-full"
                      placeholder="500000"
                      onChange={(e) =>
                        setOverrides((o) => ({
                          ...o,
                          "ask.raise_eur": Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    UseOfFunds Product %{" "}
                    <input
                      className="border rounded p-1 w-full"
                      placeholder="45"
                      onChange={(e) =>
                        setOverrides((o) => ({
                          ...o,
                          "ask.use_of_funds": {
                            ...(o["ask.use_of_funds"] || {}),
                            Product: Number(e.target.value) / 100,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    UseOfFunds Growth %{" "}
                    <input
                      className="border rounded p-1 w-full"
                      placeholder="35"
                      onChange={(e) =>
                        setOverrides((o) => ({
                          ...o,
                          "ask.use_of_funds": {
                            ...(o["ask.use_of_funds"] || {}),
                            Growth: Number(e.target.value) / 100,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    UseOfFunds Ops %{" "}
                    <input
                      className="border rounded p-1 w-full"
                      placeholder="20"
                      onChange={(e) =>
                        setOverrides((o) => ({
                          ...o,
                          "ask.use_of_funds": {
                            ...(o["ask.use_of_funds"] || {}),
                            Ops: Number(e.target.value) / 100,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
                <button
                  onClick={recalc}
                  className="rounded bg-indigo-600 text-white px-3 py-2"
                >
                  Neu berechnen
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">
                    Markt (TAM/SAM/SOM)
                  </h4>
                  <MarketBar tam={m.tam} sam={m.sam} som={m.som} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Use of Funds</h4>
                  <UseOfFundsPie
                    product={uof.product}
                    growth={uof.growth}
                    ops={uof.ops}
                  />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">MAU (Y1–Y3)</h4>
                  <KPILine y1={kp.y1} y2={kp.y2} y3={kp.y3} />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
