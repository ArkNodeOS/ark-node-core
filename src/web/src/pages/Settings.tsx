export default function Settings() {
	return (
		<div className="relative p-4 py-4 md:p-6 md:py-8 max-w-4xl mx-auto animate-slide-up">
			{/* Header */}
			<div className="mb-8">
				<p className="text-[#C9A84C]/50 text-xs tracking-[0.3em] uppercase font-sans mb-2">
					Regula
				</p>
				<h1 className="font-serif text-4xl md:text-5xl text-[#F5F0E0] font-light tracking-wide">
					Settings
				</h1>
				<div className="h-px bg-gradient-to-r from-[#C9A84C]/40 to-transparent w-24 mt-3" />
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* Node Info */}
				<div className="bg-[#1A1108] border border-[#3A2A10] rounded-lg p-6">
					<div className="flex items-center gap-3 mb-4">
						<span className="text-[#C9A84C] text-xl">⚓</span>
						<div>
							<div className="font-serif text-lg text-[#F5F0E0]">
								Node Identity
							</div>
							<div className="text-[10px] text-[#6A5A3A] tracking-widest uppercase">
								Identitas
							</div>
						</div>
					</div>
					<p className="text-sm text-[#9A8A6A] font-sans leading-relaxed">
						Your Ark Node is running in sovereign mode. All data stays on your
						hardware.
					</p>
				</div>

				{/* Theme */}
				<div className="bg-[#1A1108] border border-[#3A2A10] rounded-lg p-6">
					<div className="flex items-center gap-3 mb-4">
						<span className="text-[#C9A84C] text-xl">✦</span>
						<div>
							<div className="font-serif text-lg text-[#F5F0E0]">
								Appearance
							</div>
							<div className="text-[10px] text-[#6A5A3A] tracking-widest uppercase">
								Aspectus
							</div>
						</div>
					</div>
					<p className="text-sm text-[#9A8A6A] font-sans leading-relaxed">
						Dark Ark theme · Cormorant Garamond · Gold accent
					</p>
				</div>

				{/* PWA Install */}
				<div className="bg-[#1A1108] border border-[#3A2A10] rounded-lg p-6">
					<div className="flex items-center gap-3 mb-4">
						<span className="text-[#C9A84C] text-xl">📱</span>
						<div>
							<div className="font-serif text-lg text-[#F5F0E0]">
								Install as App
							</div>
							<div className="text-[10px] text-[#6A5A3A] tracking-widest uppercase">
								Applicatio
							</div>
						</div>
					</div>
					<p className="text-sm text-[#9A8A6A] font-sans leading-relaxed">
						On iPhone: tap the Share button, then "Add to Home Screen" to
						install Ark Node as a native-feeling app.
					</p>
				</div>

				{/* About */}
				<div className="bg-[#1A1108] border border-[#3A2A10] rounded-lg p-6">
					<div className="flex items-center gap-3 mb-4">
						<span className="text-[#C9A84C] text-xl">◉</span>
						<div>
							<div className="font-serif text-lg text-[#F5F0E0]">About</div>
							<div className="text-[10px] text-[#6A5A3A] tracking-widest uppercase">
								De Arca
							</div>
						</div>
					</div>
					<p className="text-sm text-[#9A8A6A] font-sans leading-relaxed">
						Ark Node · Codename Solomon
						<br />
						Your data. Your intelligence. Your Ark.
					</p>
				</div>
			</div>
		</div>
	);
}
