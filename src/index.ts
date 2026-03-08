import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { loadApps } from "./apps/loader.ts";
import { registerRoutes } from "./routes.ts";
import { initStorage } from "./services/storage.ts";

const app = Fastify({ logger: true });

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

		await app.listen({ port: 3000, host: "0.0.0.0" });
		console.log("🚢 Ark Node running at http://localhost:3000");
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
};

start();
