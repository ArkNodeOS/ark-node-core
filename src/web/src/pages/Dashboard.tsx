import type { Page } from "../App.tsx";
import StatusCard from "../components/StatusCard.tsx";
import { useApi } from "../hooks/useApi.ts";

interface StatusData {
	memory: { heapUsed: number; heapTotal: number; rss: number };
	uptime: number;
}

interface WelcomeData {
	version: string;
	tagline: string;
}

function greeting() {
	const h = new Date().getHours();
	if (h < 5) return "Vigilate et orate";
	if (h < 12) return "Bonum mane";
	if (h < 17) return "Bona hora";
	return "Bona vespera";
}

function fmtUptime(s: number) {
	const d = Math.floor(s / 86400),
		h = Math.floor((s % 86400) / 3600),
		m = Math.floor((s % 3600) / 60);
	if (d > 0) return `${d}d ${h}h`;
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

function fmtMb(b: number) {
	return `${(b / 1024 / 1024).toFixed(0)} MB`;
}

const ACTIONS: {
	id: Page;
	label: string;
	latin: string;
	icon: string;
	desc: string;
}[] = [
	{
		id: "ai",
		label: "Solomon",
		latin: "Sapientia",
		icon: "✝",
		desc: "Ask your private AI anything",
	},
	{
		id: "apps",
		label: "Relics",
		latin: "Moduli",
		icon: "❧",
		desc: "Installed modules & extensions",
	},
	{
		id: "files",
		label: "Vault",
		latin: "Archivum",
		icon: "◈",
		desc: "Your sovereign file storage",
	},
];

export default function Dashboard({
	onNavigate,
}: {
	onNavigate: (p: Page) => void;
}) {
	const { data: status, loading } = useApi<StatusData>("/status");
	const { data: welcome } = useApi<WelcomeData>("/");

	return (
		<div className="relative min-h-full px-4 py-4 md:px-8 md:py-10 max-w-5xl mx-auto">
			{/* Cross watermark */}
			<div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
				<span className="text-[400px] md:text-[600px] font-serif text-ark-gold/[0.015] leading-none">
					✝
				</span>
			</div>

			<div className="relative animate-slide-up">
				{/* Header */}
				<div className="mb-8 md:mb-12">
					<p className="text-ark-gold/60 text-sm font-sans tracking-[0.3em] uppercase mb-2">
						{greeting()}
					</p>
					<h1 className="font-serif text-4xl md:text-6xl text-ark-ivory font-light tracking-wide mb-3">
						Your <span className="text-gold-gradient">Ark</span>
					</h1>
					<div className="divider-gold w-32 mb-3" />
					<p className="text-ark-muted font-sans text-sm">
						{welcome?.tagline ?? "Your data. Your intelligence. Your Ark."}
					</p>
				</div>

				{/* Status row */}
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8 md:mb-12">
					<StatusCard
						icon="◎"
						label="Heap Memory"
						value={loading ? "—" : fmtMb(status?.memory.heapUsed ?? 0)}
						sub={loading ? "" : `of ${fmtMb(status?.memory.heapTotal ?? 0)}`}
					/>
					<StatusCard
						icon="◉"
						label="RSS Memory"
						value={loading ? "—" : fmtMb(status?.memory.rss ?? 0)}
					/>
					<StatusCard
						icon="✦"
						label="Uptime"
						value={loading ? "—" : fmtUptime(status?.uptime ?? 0)}
						glow
					/>
				</div>

				{/* Ornamental divider */}
				<div className="flex items-center gap-4 mb-6 md:mb-8">
					<div className="divider-gold flex-1" />
					<span className="text-ark-gold/40 text-sm font-serif italic">
						Ministeria
					</span>
					<div className="divider-gold flex-1" />
				</div>

				{/* Quick actions */}
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
					{ACTIONS.map((action) => (
						<button
							key={action.id}
							type="button"
							onClick={() => onNavigate(action.id)}
							className="ark-card p-5 md:p-7 text-left group hover:border-ark-gold/40 hover:shadow-gold-glow transition-all duration-300 relative overflow-hidden"
						>
							<div className="absolute inset-0 bg-gold-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
							<div className="relative">
								<span className="text-3xl text-ark-gold/70 group-hover:text-ark-gold block mb-4 transition-colors duration-200">
									{action.icon}
								</span>
								<div className="font-serif text-xl text-ark-ivory mb-0.5">
									{action.label}
								</div>
								<div className="text-[10px] tracking-[0.2em] uppercase text-ark-gold/50 font-sans mb-2">
									{action.latin}
								</div>
								<p className="text-xs text-ark-muted font-sans leading-relaxed">
									{action.desc}
								</p>
							</div>
						</button>
					))}
				</div>

				{/* Version badge */}
				<div className="mt-8 md:mt-12 text-center">
					<span className="text-xs text-ark-dim/50 font-sans tracking-widest uppercase">
						v{welcome?.version ?? "0.3.0"} · Codename Solomon
					</span>
				</div>
			</div>
		</div>
	);
}
