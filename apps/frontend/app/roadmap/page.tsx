import AppShell from "../../components/layout/AppShell";

export default function RoadmapPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🛣️</div>
          <h1 className="text-3xl font-bold text-slate-800 mb-4">
            Product Roadmap
          </h1>
          <p className="text-slate-600 mb-8">
            Diese Seite ist in Entwicklung und wird bald verfügbar sein.
          </p>
          <div className="bg-slate-100 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="font-semibold mb-2">Geplante Features:</h3>
            <ul className="text-left text-sm text-slate-600 space-y-1">
              <li>• Timeline Visualisierung</li>
              <li>• Milestone Planning</li>
              <li>• Release Management</li>
              <li>• Strategic Alignment</li>
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
