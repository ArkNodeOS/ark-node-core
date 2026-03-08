import { Icon } from "../components/Icons.tsx";
import { useApi } from "../hooks/useApi.ts";

interface AppManifest {
	name: string;
	version: string;
	description: string;
	icon?: string;
	permissions?: string[];
}

const PERM_STYLES: Record<string, string> = {
	docker: "border-blue-500/30 text-blue-300/80",
	storage: "border-ark-gold/30 text-ark-gold/70",
	network: "border-green-500/30 text-green-300/80",
	ai: "border-purple-500/30 text-purple-300/80",
	email: "border-orange-500/30 text-orange-300/80",
	media: "border-pink-500/30 text-pink-300/80",
	system: "border-red-500/30 text-red-300/80",
};

export default function Apps() {
	const { data, loading, error } = useApi<{ apps: AppManifest[] }>("/apps");

	return (
		<div className="relative p-6 md:p-12 max-w-4xl mx-auto animate-slide-up">
			{/* Header */}
			<div className="mb-10">
				<p className="text-ark-gold/50 text-xs tracking-[0.3em] uppercase font-sans mb-2">
					Moduli
				</p>
				<h1 className="font-serif text-5xl text-ark-ivory font-light tracking-wide">
					Relics
				</h1>
				<div className="divider-gold w-24 mt-3" />
			</div>

			{loading && (
				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="ark-card p-6 h-24 animate-pulse-gold opacity-40"
						/>
					))}
				</div>
			)}

			{error && (
				<div className="ark-card p-6 border-ark-crimson/30 text-ark-crimson">
					Failed to load modules: {error}
				</div>
			)}

			{data && (
				<>
					<div className="space-y-3 mb-10">
						{data.apps.length === 0 ? (
							<div className="text-center py-20 text-ark-dim">
								<Icon
									name="star4"
									className="w-10 h-10 text-ark-gold/30 mb-4"
								/>
								<p className="font-serif text-xl">No modules installed</p>
							</div>
						) : (
							data.apps.map((app) => (
								<div
									key={app.name}
									className="ark-card p-6 hover:border-ark-gold/30 hover:shadow-gold-subtle transition-all duration-300 group"
								>
									<div className="flex items-start gap-5">
										<div className="w-12 h-12 rounded-ark bg-ark-raised border border-ark-border flex items-center justify-center text-2xl shrink-0 group-hover:border-ark-gold/30 transition-colors">
											<Icon name="star4" className="w-6 h-6 text-ark-gold/60" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-3 flex-wrap mb-1">
												<span className="font-serif text-lg text-ark-ivory">
													{app.name}
												</span>
												<span className="text-[10px] tracking-widest uppercase font-sans text-ark-gold/50 border border-ark-gold/20 px-2 py-0.5 rounded-full">
													v{app.version}
												</span>
											</div>
											<p className="text-sm text-ark-muted font-sans leading-relaxed mb-3">
												{app.description}
											</p>
											{app.permissions && app.permissions.length > 0 && (
												<div className="flex gap-2 flex-wrap">
													{app.permissions.map((p) => (
														<span
															key={p}
															className={`text-[10px] px-2.5 py-0.5 rounded-full border font-sans tracking-wider uppercase ${PERM_STYLES[p] ?? "border-ark-border text-ark-dim"}`}
														>
															{p}
														</span>
													))}
												</div>
											)}
										</div>
									</div>
								</div>
							))
						)}
					</div>

					{/* Ornamental divider */}
					<div className="flex items-center gap-4 mb-8">
						<div className="divider-gold flex-1" />
						<span className="text-ark-gold/30 font-serif text-sm italic">
							Clawhub
						</span>
						<div className="divider-gold flex-1" />
					</div>

					{/* Marketplace */}
					<div className="ark-card p-8 text-center border-dashed">
						<Icon name="star4" className="w-8 h-8 text-ark-gold/30 mb-3" />
						<h3 className="font-serif text-xl text-ark-ivory mb-2">
							Module Marketplace
						</h3>
						<p className="text-sm text-ark-muted font-sans mb-5 max-w-sm mx-auto">
							Browse and install community-crafted extensions for your Ark
						</p>
						<button
							disabled
							className="btn-ghost opacity-30 cursor-not-allowed"
						>
							Coming Soon
						</button>
					</div>
				</>
			)}
		</div>
	);
}
