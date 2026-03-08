/**
 * Generate PWA PNG icons from SVG using @resvg/resvg-js (WASM, no native deps).
 * Run: bun scripts/gen-icons.ts
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "../src/web/public/icons");

const SVG = (size: number) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#0C0804"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${Math.round(size * 0.42)}"
    fill="none" stroke="#C9A84C" stroke-width="${Math.round(size * 0.02)}" opacity="0.25"/>
  <line x1="${size / 2}" y1="${Math.round(size * 0.26)}" x2="${size / 2}" y2="${Math.round(size * 0.82)}"
    stroke="#C9A84C" stroke-width="${Math.round(size * 0.055)}" stroke-linecap="round"/>
  <line x1="${Math.round(size * 0.3)}" y1="${Math.round(size * 0.45)}" x2="${Math.round(size * 0.7)}" y2="${Math.round(size * 0.45)}"
    stroke="#C9A84C" stroke-width="${Math.round(size * 0.045)}" stroke-linecap="round"/>
  <circle cx="${size / 2}" cy="${Math.round(size * 0.225)}" r="${Math.round(size * 0.065)}"
    fill="none" stroke="#C9A84C" stroke-width="${Math.round(size * 0.04)}"/>
  <path d="M ${Math.round(size * 0.29)} ${Math.round(size * 0.82)} Q ${size / 2} ${Math.round(size * 0.91)} ${Math.round(size * 0.71)} ${Math.round(size * 0.82)}"
    fill="none" stroke="#C9A84C" stroke-width="${Math.round(size * 0.045)}" stroke-linecap="round"/>
</svg>`.trim();

function renderPNG(size: number, filename: string) {
	const resvg = new Resvg(SVG(size), { fitTo: { mode: "width", value: size } });
	const png = resvg.render().asPng();
	writeFileSync(join(OUT, filename), png);
	console.log(`  ✓ ${filename} (${size}×${size}px, ${png.length} bytes)`);
}

mkdirSync(OUT, { recursive: true });
console.log("Generating PWA icons…");
renderPNG(192, "icon-192.png");
renderPNG(512, "icon-512.png");
console.log(`Done → ${OUT}`);
