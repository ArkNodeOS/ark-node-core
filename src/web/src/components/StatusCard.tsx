interface StatusCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accent?: boolean;
}

export default function StatusCard({ label, value, sub, icon, accent }: StatusCardProps) {
  return (
    <div className={`bg-ark-card rounded-2xl p-5 border border-ark-border shadow-ark-card animate-fade-in ${accent ? "border-ark-accent/30 shadow-ark-glow" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {accent && <span className="w-2 h-2 rounded-full bg-ark-accent animate-pulse2" />}
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-sm text-ark-muted mt-0.5">{label}</div>
      {sub && <div className="text-xs text-ark-muted/60 mt-1">{sub}</div>}
    </div>
  );
}
