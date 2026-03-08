/**
 * Generate all PWA assets: icons + screenshots.
 * Run: bun scripts/gen-icons.ts
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ICONS_OUT = join(import.meta.dirname, "../src/web/public/icons");
const SCREENS_OUT = join(import.meta.dirname, "../src/web/public/screenshots");

// ── Icon SVG ─────────────────────────────────────────────────────────────────

const iconSvg = (size: number) => {
	const cx = size / 2;
	const sw = Math.round(size * 0.055);
	const swSm = Math.round(size * 0.04);
	const topY = Math.round(size * 0.22);
	const barEnd = Math.round(size * 0.82);
	const crossY = Math.round(size * 0.45);
	const crossX1 = Math.round(size * 0.3);
	const crossX2 = Math.round(size * 0.7);
	const ringR = Math.round(size * 0.065);
	const rx = Math.round(size * 0.18);

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#0C0804"/>
  <circle cx="${cx}" cy="${cx}" r="${Math.round(size * 0.42)}" fill="none" stroke="#C9A84C" stroke-width="${Math.round(size * 0.018)}" opacity="0.2"/>
  <line x1="${cx}" y1="${topY + ringR * 2}" x2="${cx}" y2="${barEnd}" stroke="#C9A84C" stroke-width="${sw}" stroke-linecap="round"/>
  <line x1="${crossX1}" y1="${crossY}" x2="${crossX2}" y2="${crossY}" stroke="#C9A84C" stroke-width="${swSm}" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${topY}" r="${ringR}" fill="none" stroke="#C9A84C" stroke-width="${swSm}"/>
  <path d="M ${crossX1} ${barEnd} Q ${cx} ${Math.round(size * 0.91)} ${crossX2} ${barEnd}" fill="none" stroke="#C9A84C" stroke-width="${swSm}" stroke-linecap="round"/>
</svg>`;
};

// ── Screenshot SVGs ───────────────────────────────────────────────────────────

// Mobile screenshot (390×844 — iPhone 14 Pro size)
const mobileScreenshot = () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" width="390" height="844">
  <!-- Background -->
  <rect width="390" height="844" fill="#060402"/>
  <!-- Top header -->
  <rect width="390" height="60" fill="#0C0804"/>
  <line x1="0" y1="60" x2="390" y2="60" stroke="#3A2A10" stroke-width="1"/>
  <text x="20" y="38" font-family="Georgia,serif" font-size="18" fill="#C9A84C" letter-spacing="3">ARK NODE</text>
  <!-- Hero section -->
  <text x="20" y="120" font-family="Georgia,serif" font-size="13" fill="#C9A84C" opacity="0.6" letter-spacing="3">BONUM MANE</text>
  <text x="20" y="160" font-family="Georgia,serif" font-size="44" fill="#F5F0E0" font-weight="300">Your</text>
  <text x="20" y="210" font-family="Georgia,serif" font-size="44" fill="#C9A84C" font-weight="300">Ark</text>
  <line x1="20" y1="228" x2="140" y2="228" stroke="#C9A84C" stroke-width="1" opacity="0.4"/>
  <text x="20" y="250" font-family="Arial,sans-serif" font-size="12" fill="#9A8A6A">Your data. Your intelligence. Your Ark.</text>
  <!-- Stat cards -->
  <rect x="20" y="280" width="165" height="90" rx="12" fill="#1A1108" stroke="#3A2A10" stroke-width="1"/>
  <text x="36" y="310" font-family="Arial,sans-serif" font-size="10" fill="#9A8A6A" letter-spacing="2">HEAP MEMORY</text>
  <text x="36" y="345" font-family="Georgia,serif" font-size="28" fill="#F5F0E0">42 MB</text>
  <rect x="205" y="280" width="165" height="90" rx="12" fill="#1A1108" stroke="#C9A84C" stroke-width="1" opacity="0.4"/>
  <text x="221" y="310" font-family="Arial,sans-serif" font-size="10" fill="#9A8A6A" letter-spacing="2">UPTIME</text>
  <text x="221" y="345" font-family="Georgia,serif" font-size="28" fill="#F5F0E0">3h 12m</text>
  <!-- Bottom navigation -->
  <rect x="0" y="764" width="390" height="80" fill="#0C0804" opacity="0.97"/>
  <line x1="0" y1="764" x2="390" y2="764" stroke="#3A2A10" stroke-width="1"/>
  <!-- Nav items -->
  <text x="27" y="795" font-family="Arial,sans-serif" font-size="8" fill="#C9A84C" letter-spacing="1">HOME</text>
  <text x="100" y="795" font-family="Arial,sans-serif" font-size="8" fill="#6A5A3A" letter-spacing="1">SOLOMON</text>
  <text x="168" y="795" font-family="Arial,sans-serif" font-size="8" fill="#6A5A3A" letter-spacing="1">CHRONICLE</text>
  <text x="250" y="795" font-family="Arial,sans-serif" font-size="8" fill="#6A5A3A" letter-spacing="1">APPS</text>
  <text x="328" y="795" font-family="Arial,sans-serif" font-size="8" fill="#6A5A3A" letter-spacing="1">SETTINGS</text>
</svg>`.trim();

// Desktop screenshot (1280×800)
const desktopScreenshot = () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" width="1280" height="800">
  <rect width="1280" height="800" fill="#060402"/>
  <!-- Sidebar -->
  <rect width="224" height="800" fill="#0C0804"/>
  <line x1="224" y1="0" x2="224" y2="800" stroke="#3A2A10" stroke-width="1"/>
  <text x="24" y="56" font-family="Georgia,serif" font-size="18" fill="#C9A84C" letter-spacing="3">ARK NODE</text>
  <text x="24" y="72" font-family="Arial,sans-serif" font-size="9" fill="#6A5A3A" letter-spacing="3">SOVEREIGN SERVER</text>
  <!-- Nav items -->
  <rect x="12" y="100" width="200" height="38" rx="8" fill="#C9A84C" opacity="0.1"/>
  <rect x="12" y="100" width="200" height="38" rx="8" fill="none" stroke="#C9A84C" stroke-width="1" opacity="0.2"/>
  <text x="48" y="124" font-family="Arial,sans-serif" font-size="11" fill="#C9A84C" letter-spacing="2">SANCTUM</text>
  <text x="48" y="160" font-family="Arial,sans-serif" font-size="11" fill="#6A5A3A" letter-spacing="2">SAPIENTIA</text>
  <text x="48" y="196" font-family="Arial,sans-serif" font-size="11" fill="#6A5A3A" letter-spacing="2">MEMORIA</text>
  <text x="48" y="232" font-family="Arial,sans-serif" font-size="11" fill="#6A5A3A" letter-spacing="2">RELICS</text>
  <text x="48" y="268" font-family="Arial,sans-serif" font-size="11" fill="#6A5A3A" letter-spacing="2">VAULT</text>
  <!-- Main content -->
  <text x="264" y="120" font-family="Arial,sans-serif" font-size="12" fill="#C9A84C" opacity="0.6" letter-spacing="3">BONUM MANE</text>
  <text x="264" y="188" font-family="Georgia,serif" font-size="64" fill="#F5F0E0" font-weight="300">Your </text>
  <text x="500" y="188" font-family="Georgia,serif" font-size="64" fill="#C9A84C" font-weight="300">Ark</text>
  <line x1="264" y1="210" x2="500" y2="210" stroke="#C9A84C" stroke-width="1" opacity="0.35"/>
  <!-- Stat cards -->
  <rect x="264" y="240" width="280" height="120" rx="12" fill="#1A1108" stroke="#3A2A10" stroke-width="1"/>
  <text x="288" y="276" font-family="Arial,sans-serif" font-size="10" fill="#9A8A6A" letter-spacing="2">HEAP MEMORY</text>
  <text x="288" y="328" font-family="Georgia,serif" font-size="40" fill="#F5F0E0">42 MB</text>
  <rect x="564" y="240" width="280" height="120" rx="12" fill="#1A1108" stroke="#3A2A10" stroke-width="1"/>
  <text x="588" y="276" font-family="Arial,sans-serif" font-size="10" fill="#9A8A6A" letter-spacing="2">RSS MEMORY</text>
  <text x="588" y="328" font-family="Georgia,serif" font-size="40" fill="#F5F0E0">124 MB</text>
  <rect x="864" y="240" width="280" height="120" rx="12" fill="#1A1108" stroke="#C9A84C" stroke-width="1" opacity="0.4"/>
  <text x="888" y="276" font-family="Arial,sans-serif" font-size="10" fill="#9A8A6A" letter-spacing="2">UPTIME</text>
  <text x="888" y="328" font-family="Georgia,serif" font-size="40" fill="#F5F0E0">3h 12m</text>
  <!-- Action cards -->
  <rect x="264" y="420" width="380" height="140" rx="12" fill="#1A1108" stroke="#3A2A10" stroke-width="1"/>
  <text x="296" y="490" font-family="Georgia,serif" font-size="28" fill="#F5F0E0">Solomon</text>
  <text x="296" y="520" font-family="Arial,sans-serif" font-size="12" fill="#9A8A6A">Ask your private AI anything</text>
  <rect x="664" y="420" width="380" height="140" rx="12" fill="#1A1108" stroke="#3A2A10" stroke-width="1"/>
  <text x="696" y="490" font-family="Georgia,serif" font-size="28" fill="#F5F0E0">Chronicle</text>
  <text x="696" y="520" font-family="Arial,sans-serif" font-size="12" fill="#9A8A6A">Search your memories</text>
</svg>`.trim();

// ── Renderer ──────────────────────────────────────────────────────────────────

function render(svg: string, outPath: string, label: string) {
	const resvg = new Resvg(svg);
	const png = resvg.render().asPng();
	writeFileSync(outPath, png);
	console.log(`  ✓ ${label} (${png.length.toLocaleString()} bytes)`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

mkdirSync(ICONS_OUT, { recursive: true });
mkdirSync(SCREENS_OUT, { recursive: true });

console.log("Icons:");
render(iconSvg(192), join(ICONS_OUT, "icon-192.png"), "icon-192.png (192×192)");
render(iconSvg(512), join(ICONS_OUT, "icon-512.png"), "icon-512.png (512×512)");
render(iconSvg(180), join(ICONS_OUT, "apple-touch-icon.png"), "apple-touch-icon.png (180×180)");

console.log("Screenshots:");
render(mobileScreenshot(), join(SCREENS_OUT, "mobile.png"), "mobile.png (390×844)");
render(desktopScreenshot(), join(SCREENS_OUT, "desktop.png"), "desktop.png (1280×800)");

console.log("Done.");
