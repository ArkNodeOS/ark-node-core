/**
 * Test server factory — spins up a full Fastify instance with modules loaded.
 * Use this in integration tests for end-to-end route testing.
 */
import Fastify, { type FastifyInstance } from "fastify";
import { loadApps } from "../../src/apps/loader.ts";
import { registerRoutes } from "../../src/routes.ts";
import { initStorage } from "../../src/services/storage.ts";

export async function buildTestServer(): Promise<FastifyInstance> {
	const app = Fastify({ logger: false });

	app.get("/health", async () => ({ status: "ok" }));
	app.get("/status", async () => ({
		cpu: process.cpuUsage(),
		memory: process.memoryUsage(),
		uptime: process.uptime(),
	}));

	await initStorage();
	await loadApps(app);
	registerRoutes(app);

	await app.ready();
	return app;
}
