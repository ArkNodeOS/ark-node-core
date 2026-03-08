/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				ark: {
					// Backgrounds — deep velvet/mahogany
					void: "#060402",
					bg: "#0C0804",
					surface: "#130D06",
					card: "#1A1108",
					raised: "#221608",
					border: "#3A2A10",
					// Gold — liturgical, warm, radiant
					gold: "#C9A84C",
					"gold-bright": "#E2C06A",
					"gold-dim": "#8A6B28",
					"gold-glow": "#D4AF37",
					// Crimson — cardinal, sacred
					crimson: "#8B1A1A",
					"crimson-bright": "#B02020",
					// Royal blue — Marian
					royal: "#0B1B3A",
					"royal-bright": "#1A3A6A",
					// Text
					ivory: "#F5F0E0",
					parchment: "#DDD0B0",
					muted: "#9A8A6A",
					dim: "#6A5A3A",
				},
			},
			fontFamily: {
				serif: ["Cormorant Garamond", "Garamond", "Georgia", "serif"],
				sans: ["-apple-system", "BlinkMacSystemFont", "Inter", "sans-serif"],
			},
			backgroundImage: {
				"ark-vignette":
					"radial-gradient(ellipse at center, #1A1108 0%, #060402 100%)",
				"gold-gradient":
					"linear-gradient(135deg, #C9A84C 0%, #E2C06A 50%, #C9A84C 100%)",
				"gold-shimmer":
					"linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.15) 50%, transparent 100%)",
			},
			boxShadow: {
				"gold-glow":
					"0 0 30px rgba(201,168,76,0.2), 0 0 60px rgba(201,168,76,0.08)",
				"gold-subtle": "0 2px 20px rgba(201,168,76,0.12)",
				card: "0 4px 32px rgba(0,0,0,0.6)",
				"inner-gold": "inset 0 1px 0 rgba(201,168,76,0.3)",
			},
			animation: {
				"fade-in": "fadeIn 0.4s ease-out",
				"slide-up": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
				shimmer: "shimmer 3s ease-in-out infinite",
				"pulse-gold": "pulseGold 2s ease-in-out infinite",
			},
			keyframes: {
				fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
				slideUp: {
					from: { opacity: "0", transform: "translateY(16px)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
				shimmer: {
					"0%,100%": { backgroundPosition: "200% center" },
					"50%": { backgroundPosition: "0% center" },
				},
				pulseGold: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
			},
			borderRadius: {
				ark: "12px",
				"ark-lg": "20px",
			},
		},
	},
	plugins: [],
};
