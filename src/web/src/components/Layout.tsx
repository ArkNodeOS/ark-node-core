import type { ReactNode } from "react";
import type { Page } from "../App.tsx";

interface LayoutProps {
	page: Page;
	onNavigate: (page: Page) => void;
	children: ReactNode;
}

const navItems: { id: Page; label: string; icon: string; latin: string }[] = [
	{ id: "dashboard", label: "Sanctum", icon: "✦", latin: "Domus" },
	{ id: "ai", label: "Solomon", icon: "✝", latin: "Sapientia" },
	{ id: "apps", label: "Relics", icon: "❧", latin: "Moduli" },
	{ id: "files", label: "Vault", icon: "◈", latin: "Archivum" },
];

export default function Layout({ page, onNavigate, children }: LayoutProps) {
	return (
		<div className="flex h-screen bg-ark-bg text-ark-ivory overflow-hidden">
			{/* ── Sidebar (desktop) ── */}
			<aside className="hidden md:flex flex-col w-64 bg-ark-surface border-r border-ark-border shrink-0 relative overflow-hidden">
				{/* Subtle cross watermark */}
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
					<span className="text-[280px] text-ark-gold/[0.02] font-serif leading-none">
						✝
					</span>
				</div>

				{/* Logo */}
				<div className="relative p-6 border-b border-ark-border">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-ark bg-ark-card border border-ark-border flex items-center justify-center shadow-gold-subtle">
							<span className="text-ark-gold text-lg font-serif">✝</span>
						</div>
						<div>
							<div className="font-serif text-xl text-ark-ivory tracking-wide">
								Ark Node
							</div>
							<div className="text-[10px] text-ark-gold/60 tracking-[0.2em] uppercase font-sans">
								Arca Foederis
							</div>
						</div>
					</div>
				</div>

				{/* Nav */}
				<nav className="relative flex-1 p-4 space-y-1">
					{navItems.map((item) => (
						<button
							key={item.id}
							onClick={() => onNavigate(item.id)}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-ark text-left transition-all duration-200 group ${
								page === item.id
									? "bg-ark-gold/10 border border-ark-gold/30 text-ark-gold"
									: "border border-transparent text-ark-muted hover:text-ark-parchment hover:bg-ark-raised hover:border-ark-border"
							}`}
						>
							<span
								className={`text-base transition-colors ${page === item.id ? "text-ark-gold" : "text-ark-dim group-hover:text-ark-gold/60"}`}
							>
								{item.icon}
							</span>
							<div className="flex-1 min-w-0">
								<div
									className={`font-serif text-base leading-tight ${page === item.id ? "" : ""}`}
								>
									{item.label}
								</div>
								<div className="text-[10px] tracking-widest uppercase font-sans text-ark-dim/70">
									{item.latin}
								</div>
							</div>
							{page === item.id && (
								<span className="w-1 h-4 rounded-full bg-ark-gold/60 shrink-0" />
							)}
						</button>
					))}
				</nav>

				{/* Footer */}
				<div className="relative p-5 border-t border-ark-border">
					<div className="divider-gold mb-3" />
					<p className="text-[10px] text-ark-dim text-center tracking-[0.15em] uppercase font-sans">
						Your data. Your sovereignty.
					</p>
				</div>
			</aside>

			{/* ── Main content ── */}
			<main className="flex-1 flex flex-col overflow-hidden">
				<div className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</div>
			</main>

			{/* ── Bottom tab bar (mobile) ── */}
			<nav
				className="md:hidden fixed bottom-0 left-0 right-0 z-50"
				style={{
					background: "rgba(10,7,3,0.96)",
					backdropFilter: "blur(20px)",
					borderTop: "1px solid #3A2A10",
				}}
			>
				<div className="flex justify-around items-center h-16 px-2">
					{navItems.map((item) => (
						<button
							key={item.id}
							onClick={() => onNavigate(item.id)}
							className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-ark transition-all min-w-[60px] ${
								page === item.id ? "text-ark-gold" : "text-ark-dim"
							}`}
						>
							<span className="text-xl leading-none">{item.icon}</span>
							<span className="text-[10px] font-serif tracking-wide">
								{item.label}
							</span>
						</button>
					))}
				</div>
			</nav>
		</div>
	);
}
