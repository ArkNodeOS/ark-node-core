import Fastify from "fastify";
import { loadApps } from "./apps/loader.ts";
import { registerRoutes } from "./routes.ts";
import { initStorage } from "./services/storage.ts";

const app = Fastify({ logger: true });

app.get("/health", async () => {
	return { status: "ok" };
});

app.get("/status", async () => {
	return {
		cpu: process.cpuUsage(),
		memory: process.memoryUsage(),
		uptime: process.uptime(),
	};
});

const start = async () => {
	try {
		await initStorage();
		const loadedApps = await loadApps();
		registerRoutes(app, loadedApps);

		await app.listen({ port: 3000, host: "0.0.0.0" });
		console.log("Server running at http://localhost:3000");
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
};

start();
