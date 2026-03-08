import type { Page } from "../App.tsx";
import StatusCard from "../components/StatusCard.tsx";
import { useApi } from "../hooks/useApi.ts";

interface StatusData {
  memory: { heapUsed: number; heapTotal: number; rss: number };
  uptime: number;
}

interface QuickAction {
  id: Page;
  label: string;
  icon: string;
  desc: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "ai", label: "Solomon", icon: "◈", desc: "Ask anything" },
  { id: "apps", label: "Apps", icon: "⊞", desc: "Installed modules" },
  { id: "files", label: "Files", icon: "⊟", desc: "Browse storage" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

export default function Dashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { data: status, loading } = useApi<StatusData>("/status");

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-slide-up">
      {/* Header */}
      <div className="mb-10">
        <p className="text-ark-muted text-sm mb-1">{greeting()}</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          Your <span className="text-ark-accent">Ark</span>
        </h1>
        <p className="text-ark-text-dim mt-2">All systems nominal. Your data stays yours.</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        <StatusCard
          icon="💾"
          label="Heap Used"
          value={loading ? "—" : fmtMb(status?.memory.heapUsed ?? 0)}
          sub={loading ? "" : `of ${fmtMb(status?.memory.heapTotal ?? 0)}`}
        />
        <StatusCard
          icon="📦"
          label="RSS Memory"
          value={loading ? "—" : fmtMb(status?.memory.rss ?? 0)}
        />
        <StatusCard
          icon="⏱"
          label="Uptime"
          value={loading ? "—" : fmtUptime(status?.uptime ?? 0)}
          accent
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-4">
        <h2 className="text-xs text-ark-muted uppercase tracking-widest mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => onNavigate(action.id)}
              className="bg-ark-card border border-ark-border rounded-2xl p-6 text-left hover:border-ark-accent/50 hover:shadow-ark-glow transition-all duration-200 group"
            >
              <span className="text-4xl block mb-3 group-hover:scale-110 transition-transform duration-200">
                {action.icon}
              </span>
              <div className="font-medium">{action.label}</div>
              <div className="text-sm text-ark-muted">{action.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
