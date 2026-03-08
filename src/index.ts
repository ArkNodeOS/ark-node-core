import { existsSync } from "node:fs";
import https from "node:https";
import { resolve } from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { loadApps } from "./apps/loader.ts";
import { registerRoutes } from "./routes.ts";
import { getOrCreateCerts } from "./services/certs.ts";
import { advertiseMDNS, stopMDNS } from "./services/mdns.ts";
import { initStorage } from "./services/storage.ts";

const app = Fastify({ logger: true });

const HOSTNAME = process.env.ARK_HOSTNAME ?? "ark-node";
const HTTP_PORT = Number(process.env.PORT ?? 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 3443);
const MDNS_ENABLED = process.env.ARK_MDNS !== "false";

app.get("/health", async () => ({ status: "ok" }));

app.get("/status", async () => ({
	cpu: process.cpuUsage(),
	memory: process.memoryUsage(),
	uptime: process.uptime(),
}));

const start = async () => {
	try {
		await initStorage();

		// Serve web UI if built
		const uiDist = resolve(import.meta.dirname, "../src/web/dist");
		if (existsSync(uiDist)) {
			await app.register(fastifyStatic, {
				root: uiDist,
				prefix: "/ui/",
			});
			console.log("🎨 Web UI available at http://localhost:3000/ui/");
		}

		// Load modules first (they register routes onto app)
		await loadApps(app);

		// Then register platform routes
		registerRoutes(app);

		// Start HTTP server
		await app.listen({ port: HTTP_PORT, host: "0.0.0.0" });
		console.log(`\n⚓ Ark Node`);
		console.log(`   HTTP  → http://localhost:${HTTP_PORT}`);

		// Start HTTPS server
		try {
			const certs = await getOrCreateCerts(HOSTNAME);
			// Reuse Fastify's request listener — no duplicate route registration
			type ReqListener = (
				req: import("node:http").IncomingMessage,
				res: import("node:http").ServerResponse,
			) => void;
			const requestListener = app.server.listeners("request")[0] as ReqListener;
			const httpsServer = https.createServer(
				{ key: certs.key, cert: certs.cert },
				requestListener,
			);
			await new Promise<void>((resolve, reject) => {
				httpsServer.listen(HTTPS_PORT, "0.0.0.0", () => resolve());
				httpsServer.on("error", reject);
			});
			console.log(`   HTTPS → https://localhost:${HTTPS_PORT}`);
			if (MDNS_ENABLED) {
				advertiseMDNS("Ark Node", HTTPS_PORT, true);
				console.log(`   LAN   → https://${HOSTNAME}.local:${HTTPS_PORT}`);
			}
		} catch (httpsErr) {
			console.warn("⚠ HTTPS startup failed (non-fatal):", String(httpsErr));
		}

		// mDNS for HTTP too if HTTPS failed or disabled
		if (MDNS_ENABLED) {
			advertiseMDNS("Ark Node HTTP", HTTP_PORT, false);
		}

		console.log(`   UI    → http://localhost:${HTTP_PORT}/ui/\n`);
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
};

start();

process.on("SIGTERM", stopMDNS);
process.on("SIGINT", stopMDNS);
