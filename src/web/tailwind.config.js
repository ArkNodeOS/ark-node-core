/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ark: {
          bg: "#0a0a0f",
          surface: "#13131a",
          card: "#1c1c26",
          border: "#2a2a3a",
          accent: "#6366f1",
          "accent-glow": "#818cf8",
          muted: "#6b7280",
          text: "#f1f5f9",
          "text-dim": "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Inter", "sans-serif"],
      },
      backgroundImage: {
        "ark-gradient": "linear-gradient(135deg, #1c1c26 0%, #0a0a0f 100%)",
      },
      boxShadow: {
        "ark-glow": "0 0 40px rgba(99, 102, 241, 0.15)",
        "ark-card": "0 4px 24px rgba(0,0,0,0.4)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        pulse2: "pulse2 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        pulse2: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
      },
    },
  },
  plugins: [],
};
