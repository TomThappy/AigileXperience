"use client";
import { useEffect, useState } from "react";
import Subnav from "@/components/layout/Subnav";
export default function uteamPage({ params }: { params: { wsId: string } }) {
  const base = `/workspaces/${params.wsId}/dossier`;
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    const s = localStorage.getItem("last_dossier");
    if (s) setData(JSON.parse(s));
  }, []);
  useEffect(() => {
    if (data) localStorage.setItem("last_dossier", JSON.stringify(data));
  }, [data]);
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
      <h1 className="text-xl font-semibold">Venture Dossier · uteam</h1>
      <pre className="bg-white border rounded p-3 mt-3 text-xs overflow-auto">
        {JSON.stringify(
          data?.sections?.team ?? "Noch kein Run ausgeführt.",
          null,
          2,
        )}
      </pre>
    </div>
  );
}
