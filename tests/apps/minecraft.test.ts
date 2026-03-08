/**
 * Minecraft module tests.
 * We mock child_process.execSync to avoid needing real Docker.
 */
import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import type { FastifyInstance } from "fastify";

// Mock execSync before the module loads
const mockExecSync = mock((cmd: string, _opts?: any): string | Buffer => {
	if (cmd.includes("docker info")) return "";
	if (cmd.includes("docker inspect") && cmd.includes("State.Status")) return "running\n";
	if (cmd.includes("docker inspect") && cmd.includes("IPAddress")) return "172.17.0.2\n";
	if (cmd.includes("docker run")) return "abc123containerid\n";
	if (cmd.includes("docker stop")) return "";
	if (cmd.includes("docker start")) return "";
	if (cmd.includes("docker rm")) return "";
	if (cmd.includes("docker volume rm")) return "";
	if (cmd.includes("docker logs")) return "Server started\n[Server] Done!\n";
	return "";
});

mock.module("node:child_process", () => ({
	execSync: mockExecSync,
	spawn: mock(() => ({ on: mock(() => {}), stdout: { on: mock(() => {}) }, stderr: { on: mock(() => {}) } })),
}));

import { buildTestServer } from "../helpers/server.ts";

let app: FastifyInstance;

beforeAll(async () => {
	app = await buildTestServer();
});

afterAll(async () => {
	await app.close();
});

describe("minecraft module", () => {
	it("GET /minecraft/status — returns status object", async () => {
		const res = await app.inject({ method: "GET", url: "/minecraft/status" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveProperty("status");
		expect(body).toHaveProperty("container");
		expect(body).toHaveProperty("port");
		expect(body.port).toBe(25565);
	});

	it("GET /minecraft/status — includes IP when running", async () => {
		const res = await app.inject({ method: "GET", url: "/minecraft/status" });
		const body = res.json();
		// Container mock returns "running"
		if (body.status === "running") {
			expect(body.ip).not.toBeNull();
		}
	});

	it("POST /minecraft/start — starts/deploys the server", async () => {
		// Override inspect to return "missing" so we test the docker run path
		mockExecSync.mockImplementationOnce((cmd: string) => {
			if (cmd.includes("docker info")) return "";
			throw new Error("container not found"); // triggers "missing" status
		});

		const res = await app.inject({
			method: "POST",
			url: "/minecraft/start",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ version: "1.21", memory: "2G", gamemode: "creative" }),
		});
		// Either ok (deployed) or already running — both are valid
		expect([200, 201]).toContain(res.statusCode);
		const body = res.json();
		expect(body).toHaveProperty("ok");
	});

	it("POST /minecraft/stop — stops the server", async () => {
		const res = await app.inject({ method: "POST", url: "/minecraft/stop" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.ok).toBe(true);
	});

	it("GET /minecraft/logs — returns log lines array", async () => {
		const res = await app.inject({ method: "GET", url: "/minecraft/logs?lines=20" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(Array.isArray(body.logs)).toBe(true);
	});

	it("DELETE /minecraft/destroy — removes container and volume", async () => {
		const res = await app.inject({ method: "DELETE", url: "/minecraft/destroy" });
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("is listed in /apps with docker permission", async () => {
		const res = await app.inject({ method: "GET", url: "/apps" });
		const { apps } = res.json() as { apps: { name: string; permissions: string[] }[] };
		const mc = apps.find((a) => a.name === "minecraft");
		expect(mc).toBeDefined();
		expect(mc!.permissions).toContain("docker");
		expect(mc!.permissions).toContain("network");
	});
});
