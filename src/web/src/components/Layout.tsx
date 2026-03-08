import { type ReactNode, useEffect, useState } from "react";
import type { Page } from "../App.tsx";

interface LayoutProps {
	page: Page;
	onNavigate: (page: Page) => void;
	children: ReactNode;
}

interface NavItem {
	id: Page;
	label: string;
	icon: string;
	latinLabel: string;
}

// Primary nav for mobile bottom bar (5 items)
const MOBILE_NAV: NavItem[] = [
	{ id: "dashboard", label: "Home", icon: "⚓", latinLabel: "Sanctum" },
	{ id: "ai", label: "Solomon", icon: "👁️", latinLabel: "Sapientia" },
	{ id: "apps", label: "Apps", icon: "✦", latinLabel: "Relics" },
	{ id: "files", label: "Files", icon: "◈", latinLabel: "Vault" },
	{ id: "settings", label: "Settings", icon: "⚙️", latinLabel: "Regula" },
];

// Full nav for desktop sidebar
const ALL_NAV: NavItem[] = [
	{ id: "dashboard", label: "Sanctum", icon: "⚓", latinLabel: "Domus" },
	{ id: "ai", label: "Solomon", icon: "👁️", latinLabel: "Sapientia" },
	{ id: "apps", label: "Relics", icon: "✦", latinLabel: "Moduli" },
	{ id: "files", label: "Vault", icon: "◈", latinLabel: "Archivum" },
	{ id: "minecraft", label: "Minecraft", icon: "⛏", latinLabel: "Ludus" },
	{ id: "vpn", label: "VPN", icon: "🔒", latinLabel: "Tutela" },
	{ id: "backup", label: "Backup", icon: "💾", latinLabel: "Custodia" },
	{ id: "router", label: "Router", icon: "🌐", latinLabel: "Retis" },
	{ id: "email", label: "Epistulae", icon: "✉", latinLabel: "Nuntius" },
	{ id: "settings", label: "Settings", icon: "⚙️", latinLabel: "Regula" },
];

function useBreakpoint() {
	const [width, setWidth] = useState(
		typeof window !== "undefined" ? window.innerWidth : 1024,
	);
	useEffect(() => {
		const handler = () => setWidth(window.innerWidth);
		window.addEventListener("resize", handler);
		return () => window.removeEventListener("resize", handler);
	}, []);
	return { isMobile: width < 768, isTablet: width >= 768 && width < 1024 };
}

export default function Layout({ page, onNavigate, children }: LayoutProps) {
	const { isMobile, isTablet } = useBreakpoint();

	// ── Mobile layout ──
	if (isMobile) {
		return (
			<div className="flex flex-col min-h-screen bg-[#060402] text-[#F5F0E0]">
				<header
					className="flex items-center justify-between px-4 pb-3 bg-[#0C0804] border-b border-[#3A2A10]"
					style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
				>
					<span className="font-serif text-xl text-[#C9A84C] tracking-widest">
						ARK NODE
					</span>
					<span className="text-xl">⚓</span>
				</header>

				<main className="flex-1 overflow-y-auto pb-24">{children}</main>

				<nav
					className="fixed bottom-0 left-0 right-0 bg-[#0C0804]/95 backdrop-blur-sm border-t border-[#3A2A10] z-50"
					style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
				>
					<div className="flex">
						{MOBILE_NAV.map((item) => (
							<button
								key={item.id}
								type="button"
								onClick={() => onNavigate(item.id)}
								className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors min-h-[52px] justify-center ${
									page === item.id ? "text-[#C9A84C]" : "text-[#6A5A3A]"
								}`}
							>
								<span className="text-xl leading-none">{item.icon}</span>
								<span className="text-[10px] tracking-wider uppercase">
									{item.label}
								</span>
							</button>
						))}
					</div>
				</nav>
			</div>
		);
	}

	// ── Tablet layout (icon-only sidebar) ──
	if (isTablet) {
		return (
			<div className="flex min-h-screen bg-[#060402] text-[#F5F0E0]">
				<aside className="w-16 flex flex-col items-center py-6 gap-2 bg-[#0C0804] border-r border-[#3A2A10] sticky top-0 h-screen overflow-y-auto">
					<span className="text-[#C9A84C] text-2xl mb-4">⚓</span>
					{ALL_NAV.map((item) => (
						<button
							key={item.id}
							type="button"
							onClick={() => onNavigate(item.id)}
							title={item.latinLabel}
							className={`w-10 h-10 flex items-center justify-center rounded-lg text-xl transition-colors ${
								page === item.id
									? "bg-[#C9A84C]/15 text-[#C9A84C]"
									: "text-[#6A5A3A] hover:text-[#9A8A6A] hover:bg-[#221608]"
							}`}
						>
							{item.icon}
						</button>
					))}
				</aside>
				<main className="flex-1 overflow-y-auto">{children}</main>
			</div>
		);
	}

	// ── Desktop layout ──
	return (
		<div className="flex h-screen bg-[#060402] text-[#F5F0E0] overflow-hidden">
			<aside className="w-56 flex flex-col py-6 px-3 bg-[#0C0804] border-r border-[#3A2A10] sticky top-0 h-screen gap-1 overflow-y-auto shrink-0">
				<div className="px-3 mb-6">
					<h1 className="font-serif text-xl text-[#C9A84C] tracking-widest">
						ARK NODE
					</h1>
					<p className="text-[10px] text-[#6A5A3A] tracking-widest uppercase mt-0.5">
						Sovereign Server
					</p>
				</div>
				{ALL_NAV.map((item) => (
					<button
						key={item.id}
						type="button"
						onClick={() => onNavigate(item.id)}
						className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left w-full ${
							page === item.id
								? "bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20"
								: "text-[#9A8A6A] hover:text-[#F5F0E0] hover:bg-[#221608] border border-transparent"
						}`}
					>
						<span className="text-base w-5 text-center shrink-0">
							{item.icon}
						</span>
						<div className="flex-1 min-w-0">
							<div className="text-xs tracking-widest uppercase font-sans">
								{item.label}
							</div>
							<div className="text-[10px] text-[#6A5A3A] tracking-widest uppercase font-sans mt-0.5">
								{item.latinLabel}
							</div>
						</div>
					</button>
				))}
			</aside>
			<main className="flex-1 overflow-y-auto">{children}</main>
		</div>
	);
}
