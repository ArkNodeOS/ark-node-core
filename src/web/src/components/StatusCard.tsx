interface StatusCardProps {
	label: string;
	value: string;
	sub?: string;
	icon: string;
	glow?: boolean;
}

export default function StatusCard({
	label,
	value,
	sub,
	icon,
	glow,
}: StatusCardProps) {
	return (
		<div
			className={`ark-card p-5 relative overflow-hidden transition-all duration-300 hover:border-ark-gold/30 ${glow ? "shadow-gold-glow border-ark-gold/20" : ""}`}
		>
			{/* Shimmer overlay */}
			<div className="absolute inset-0 bg-gold-shimmer opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

			<div className="relative">
				<div className="flex items-start justify-between mb-4">
					<span className="text-xl text-ark-gold/80">{icon}</span>
					{glow && (
						<span className="w-1.5 h-1.5 rounded-full bg-ark-gold animate-pulse-gold" />
					)}
				</div>
				<div className="font-serif text-2xl text-ark-ivory tracking-tight">
					{value}
				</div>
				<div className="text-xs text-ark-muted font-sans uppercase tracking-widest mt-1">
					{label}
				</div>
				{sub && (
					<div className="text-xs text-ark-dim/70 font-sans mt-1">{sub}</div>
				)}
			</div>
		</div>
	);
}
