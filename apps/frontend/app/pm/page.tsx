import AppShell from "../../components/layout/AppShell";

export default function ProjectManagementPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🚧</div>
          <h1 className="text-3xl font-bold text-slate-800 mb-4">
            Projekt Management
          </h1>
          <p className="text-slate-600 mb-8">
            Diese Seite ist in Entwicklung und wird bald verfügbar sein.
          </p>
          <div className="bg-slate-100 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="font-semibold mb-2">Geplante Features:</h3>
            <ul className="text-left text-sm text-slate-600 space-y-1">
              <li>• Sprint Planning & Backlogs</li>
              <li>• Roadmap Tracking</li>
              <li>• Team Kapazitäten</li>
              <li>• Milestone Management</li>
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
