"use client";
import { useState } from "react";

type Section = {
  title: string;
  summary: string;
  status?: string;
  gaps?: string[];
  visuals?: any[];
  metrics?: any;
  bullets?: string[];
  guideline_report?: { satisfied: string[]; missing: string[]; notes: string };
};
type Dossier = {
  meta: {
    project_title: string;
    language: string;
    version: string;
    recalc_at?: string;
  };
  sections: Record<string, Section>;
  assumption_log?: Array<{
    field: string;
    value: any;
    basis: string;
    source: string;
    version: string;
    severity: string;
    timestamp: string;
  }>;
};

export default function AutoPage() {
  const [title, setTitle] = useState("HappyNest");
  const [pitch, setPitch] = useState("HappyNest ist das digitale Zuhause …");
  const [data, setData] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [ov, setOv] = useState<any>({});

  async function run() {
    setLoading(true);
    setData(null);
    const url =
      process.env.NEXT_PUBLIC_AUTO_URL || "http://localhost:3001/api/auto/run";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_title: title, elevator_pitch: pitch }),
    });
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  async function recalc() {
    if (!data) return;
    const url =
      process.env.NEXT_PUBLIC_AUTO_RECALC_URL ||
      "http://localhost:3001/api/auto/recalc";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dossier: data, overrides: ov }),
    });
    const json = await res.json();
    setData(json);
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Auto (Leitfaden v1)</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="text-sm font-medium">Projekttitel</label>
          <input
            className="w-full border rounded p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="text-sm font-medium">Elevator Pitch</label>
          <textarea
            className="w-full border rounded p-2 h-40"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={run}
              className="rounded bg-purple-700 text-white px-3 py-2"
            >
              {loading ? "Erzeuge …" : "Generate (Auto)"}
            </button>
          </div>

          <div className="mt-4 border rounded p-3 bg-white space-y-2">
            <div className="font-semibold">Overrides (prompt-sparend)</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label>
                ARPU €/Monat
                <input
                  className="border rounded p-1 w-full mt-1"
                  placeholder="3.5"
                  onChange={(e) =>
                    setOv((o: any) => ({
                      ...o,
                      sections: {
                        ...(o.sections || {}),
                        business_model: {
                          ...(o.sections?.business_model || {}),
                          pricing: {
                            ...(o.sections?.business_model?.pricing || {}),
                            arpu_month: Number(e.target.value),
                          },
                        },
                      },
                    }))
                  }
                />
              </label>
              <label>
                Free→Paid %
                <input
                  className="border rounded p-1 w-full mt-1"
                  placeholder="3"
                  onChange={(e) =>
                    setOv((o: any) => ({
                      ...o,
                      sections: {
                        ...(o.sections || {}),
                        business_model: {
                          ...(o.sections?.business_model || {}),
                          pricing: {
                            ...(o.sections?.business_model?.pricing || {}),
                            free_to_paid: Number(e.target.value) / 100,
                          },
                        },
                      },
                    }))
                  }
                />
              </label>
              <label>
                TAM (Familien)
                <input
                  className="border rounded p-1 w-full mt-1"
                  placeholder="12000000"
                  onChange={(e) =>
                    setOv((o: any) => ({
                      ...o,
                      sections: {
                        ...(o.sections || {}),
                        market: {
                          ...(o.sections?.market || {}),
                          metrics: {
                            ...(o.sections?.market?.metrics || {}),
                            TAM: Number(e.target.value),
                          },
                        },
                      },
                    }))
                  }
                />
              </label>
              <label>
                SAM (Familien)
                <input
                  className="border rounded p-1 w-full mt-1"
                  placeholder="3600000"
                  onChange={(e) =>
                    setOv((o: any) => ({
                      ...o,
                      sections: {
                        ...(o.sections || {}),
                        market: {
                          ...(o.sections?.market || {}),
                          metrics: {
                            ...(o.sections?.market?.metrics || {}),
                            SAM: Number(e.target.value),
                          },
                        },
                      },
                    }))
                  }
                />
              </label>
              <label>
                SOM (Familien)
                <input
                  className="border rounded p-1 w-full mt-1"
                  placeholder="360000"
                  onChange={(e) =>
                    setOv((o: any) => ({
                      ...o,
                      sections: {
                        ...(o.sections || {}),
                        market: {
                          ...(o.sections?.market || {}),
                          metrics: {
                            ...(o.sections?.market?.metrics || {}),
                            SOM: Number(e.target.value),
                          },
                        },
                      },
                    }))
                  }
                />
              </label>
              <label>
                UseOfFunds Produkt %
                <input
                  className="border rounded p-1 w-full mt-1"
                  placeholder="45"
                  onChange={(e) =>
                    setOv((o: any) => ({
                      ...o,
                      sections: {
                        ...(o.sections || {}),
                        ask: {
                          ...(o.sections?.ask || {}),
                          use_of_funds: {
                            ...(o.sections?.ask?.use_of_funds || {}),
                            Produkt: Number(e.target.value) / 100,
                          },
                        },
                      },
                    }))
                  }
                />
              </label>
              <label>
                UseOfFunds Wachstum %
                <input
                  className="border rounded p-1 w-full mt-1"
                  placeholder="35"
                  onChange={(e) =>
                    setOv((o: any) => ({
                      ...o,
                      sections: {
                        ...(o.sections || {}),
                        ask: {
                          ...(o.sections?.ask || {}),
                          use_of_funds: {
                            ...(o.sections?.ask?.use_of_funds || {}),
                            Wachstum: Number(e.target.value) / 100,
                          },
                        },
                      },
                    }))
                  }
                />
              </label>
              <label>
                UseOfFunds Team %
                <input
                  className="border rounded p-1 w-full mt-1"
                  placeholder="20"
                  onChange={(e) =>
                    setOv((o: any) => ({
                      ...o,
                      sections: {
                        ...(o.sections || {}),
                        ask: {
                          ...(o.sections?.ask || {}),
                          use_of_funds: {
                            ...(o.sections?.ask?.use_of_funds || {}),
                            Team: Number(e.target.value) / 100,
                          },
                        },
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
        </div>

        <div className="border rounded p-3 bg-white">
          <h2 className="font-semibold mb-2">Ergebnis</h2>
          {!data && (
            <p className="text-sm text-gray-500">Noch nichts erzeugt.</p>
          )}
          {data && (
            <div className="space-y-4 text-sm">
              <div className="text-xs text-gray-500">
                Schema: {data.meta?.version} • Recalc:{" "}
                {data.meta?.recalc_at ? "ja" : "nein"}
              </div>
              {Object.entries(data.sections || {}).map(([key, sec]) => (
                <div key={key} className="border-t pt-2">
                  <div className="font-semibold">{sec.title || key}</div>
                  <p className="mt-1">{sec.summary}</p>
                  {sec.guideline_report && (
                    <div className="mt-2 grid md:grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="font-semibold">Erfüllt</div>
                        <ul className="list-disc pl-4">
                          {(sec.guideline_report.satisfied || [])
                            .slice(0, 6)
                            .map((x, i) => (
                              <li key={i}>{x}</li>
                            ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-semibold">Offen</div>
                        <ul className="list-disc pl-4 text-orange-700">
                          {(sec.guideline_report.missing || [])
                            .slice(0, 6)
                            .map((x, i) => (
                              <li key={i}>{x}</li>
                            ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {sec.metrics && (
                    <pre className="bg-gray-50 p-2 rounded mt-2 overflow-auto">
                      {JSON.stringify(sec.metrics, null, 2)}
                    </pre>
                  )}
                  {!!sec.visuals?.length && (
                    <pre className="bg-gray-50 p-2 rounded mt-2 overflow-auto">
                      {JSON.stringify(sec.visuals, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
              {data.assumption_log && data.assumption_log.length > 0 && (
                <div>
                  <h3 className="font-semibold mt-2">Assumptions (Log)</h3>
                  <ul className="list-disc pl-5">
                    {data.assumption_log.slice(0, 10).map((a, i) => (
                      <li key={i}>
                        <span className="font-medium">{a.field}:</span>{" "}
                        {typeof a.value === "object"
                          ? JSON.stringify(a.value)
                          : String(a.value)}{" "}
                        <span className="text-gray-500">[{a.basis}]</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
