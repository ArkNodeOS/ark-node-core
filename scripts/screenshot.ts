/**
 * Visual regression / preview screenshots across device sizes.
 * Run: bun scripts/screenshot.ts
 * Output: screenshots/*.png
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join } from "node:path";

const DIST = join(import.meta.dirname, "../src/web/dist");
const OUT = join(import.meta.dirname, "../screenshots");

const MIME: Record<string, string> = {
	".html": "text/html",
	".js": "application/javascript",
	".css": "text/css",
	".svg": "image/svg+xml",
	".png": "image/png",
	".json": "application/json",
	".webp": "image/webp",
};

const DEVICES = [
	{ name: "iphone-se", width: 375, height: 667, deviceScaleFactor: 2, mobile: true },
	{ name: "iphone-14-pro-max", width: 430, height: 932, deviceScaleFactor: 3, mobile: true },
	{ name: "ipad-air", width: 820, height: 1180, deviceScaleFactor: 2, mobile: true },
	{ name: "ipad-pro-12", width: 1024, height: 1366, deviceScaleFactor: 2, mobile: false },
	{ name: "desktop-1440", width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
];

const PAGES = [
	{ name: "dashboard", path: "/ui/#/" },
	{ name: "solomon", path: "/ui/#/solomon" },
	{ name: "apps", path: "/ui/#/apps" },
	{ name: "settings", path: "/ui/#/settings" },
];

// Serve dist/ as a static file server on a random port
function startServer(): Promise<{ port: number; close: () => void }> {
	return new Promise((resolve) => {
		const server = createServer((req, res) => {
			const urlPath = (req.url ?? "/").split("?")[0] ?? "/";
			// SPA fallback — anything under /ui/ that isn't a file → serve index.html
			let fsPath = join(DIST, urlPath.replace(/^\/ui/, ""));
			if (!existsSync(fsPath) || fsPath === DIST) {
				fsPath = join(DIST, "index.html");
			}
			const ext = extname(fsPath);
			res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
			createReadStream(fsPath).pipe(res);
		});
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address() as { port: number };
			resolve({ port: addr.port, close: () => server.close() });
		});
	});
}

async function main() {
	mkdirSync(OUT, { recursive: true });

	const { port, close } = await startServer();
	const base = `http://127.0.0.1:${port}`;
	console.log(`Serving ${DIST} at ${base}`);

	const browser = await chromium.launch();

	for (const device of DEVICES) {
		const ctx = await browser.newContext({
			viewport: { width: device.width, height: device.height },
			deviceScaleFactor: device.deviceScaleFactor,
			isMobile: device.mobile,
			userAgent: device.mobile
				? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
				: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		});

		const page = await ctx.newPage();

		for (const pg of PAGES) {
			await page.goto(`${base}${pg.path}`, { waitUntil: "networkidle", timeout: 10000 });
			await page.waitForTimeout(500);
			const file = join(OUT, `${device.name}--${pg.name}.png`);
			await page.screenshot({ path: file, fullPage: false });
			console.log(`  ✓ ${device.name} / ${pg.name}`);
		}

		await ctx.close();
	}

	await browser.close();
	close();
	console.log(`\nScreenshots saved to: ${OUT}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
