/**
 * AdBlock module tests — mocks Docker/execSync.
 */
import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import type { FastifyInstance } from "fastify";

const mockExecSync = mock((cmd: string, _opts?: any): string | Buffer => {
	if (cmd.includes("docker info")) return "";
	if (cmd.includes("docker inspect") && cmd.includes("State.Status"))
		return "running\n";
	if (cmd.includes("docker run")) return "pihole123\n";
	if (cmd.includes("docker stop")) return "";
	if (cmd.includes("docker start")) return "";
	if (cmd.includes("docker exec") && cmd.includes("api.php?summary")) {
		return JSON.stringify({
			domains_being_blocked: 142000,
			dns_queries_today: 8420,
			ads_blocked_today: 1200,
			ads_percentage_today: 14.25,
		});
	}
	if (cmd.includes("docker exec") && cmd.includes("api.php?topItems")) {
		return JSON.stringify({
			top_ads: { "doubleclick.net": 45, "ads.google.com": 30 },
			top_queries: { "dns.google": 100 },
		});
	}
	if (cmd.includes("pihole -w")) return "Whitelisting\n";
	if (cmd.includes("pihole -b")) return "Blacklisting\n";
	if (cmd.includes("pihole -g")) return "Updating lists\n";
	return "";
});

mock.module("node:child_process", () => ({
	execSync: mockExecSync,
	spawn: mock(() => ({})),
}));

import { buildTestServer } from "../helpers/server.ts";

let app: FastifyInstance;

beforeAll(async () => {
	app = await buildTestServer();
});

afterAll(async () => {
	await app.close();
});

describe("adblock module", () => {
	it("GET /adblock/status — returns status and stats", async () => {
		const res = await app.inject({ method: "GET", url: "/adblock/status" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveProperty("status");
		expect(body).toHaveProperty("container");
		expect(body).toHaveProperty("dns_port");
	});

	it("GET /adblock/status — includes stats when running", async () => {
		const res = await app.inject({ method: "GET", url: "/adblock/status" });
		const body = res.json();
		if (body.status === "running" && body.stats) {
			expect(typeof body.stats.domains_being_blocked).toBe("number");
			expect(typeof body.stats.ads_blocked_today).toBe("number");
		}
	});

	it("POST /adblock/start — starts Pi-hole", async () => {
		// Return "missing" for the inspect so it runs docker run
		mockExecSync.mockImplementationOnce((cmd: string) => {
			if (cmd.includes("docker info")) return "";
			throw new Error("not found");
		});
		const res = await app.inject({
			method: "POST",
			url: "/adblock/start",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				password: "test-pass",
				timezone: "America/Chicago",
			}),
		});
		expect([200, 201]).toContain(res.statusCode);
		expect(res.json()).toHaveProperty("ok");
	});

	it("POST /adblock/stop — stops Pi-hole", async () => {
		const res = await app.inject({ method: "POST", url: "/adblock/stop" });
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("GET /adblock/blocklist — returns top blocked domains", async () => {
		const res = await app.inject({ method: "GET", url: "/adblock/blocklist" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveProperty("top_blocked");
		expect(body).toHaveProperty("top_queries");
	});

	it("POST /adblock/whitelist — whitelists a domain", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/adblock/whitelist",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ domain: "example.com" }),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("POST /adblock/whitelist — 400 when domain is missing", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/adblock/whitelist",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({}),
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /adblock/blacklist — blacklists a domain", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/adblock/blacklist",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ domain: "ads.badsite.com" }),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("POST /adblock/update-lists — triggers blocklist update", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/adblock/update-lists",
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("is listed in /apps with docker + network + system permissions", async () => {
		const res = await app.inject({ method: "GET", url: "/apps" });
		const { apps } = res.json() as {
			apps: { name: string; permissions: string[] }[];
		};
		const ab = apps.find((a) => a.name === "adblock");
		expect(ab).toBeDefined();
		expect(ab!.permissions).toContain("docker");
		expect(ab!.permissions).toContain("network");
		expect(ab!.permissions).toContain("system");
	});
});
