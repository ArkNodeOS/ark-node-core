import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import type { FastifyInstance } from "fastify";

const mockExecSync = mock((cmd: string): string => {
	if (cmd.includes("docker info")) return "";
	if (cmd.includes("docker inspect") && cmd.includes("State.Status")) return "running\n";
	if (cmd.includes("docker stop")) return "";
	if (cmd.includes("docker start")) return "";
	if (cmd.includes("docker run")) return "wg-container-id\n";
	if (cmd.includes("docker rm")) return "";
	if (cmd.includes("docker volume rm")) return "";
	return "";
});

// Mock fetch for wg-easy API calls
const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string, opts?: RequestInit) => {
	const u = url.toString();
	if (u.includes("ipify.org")) return new Response("1.2.3.4");
	// wg-easy API mocks
	if (u.includes("/api/session")) {
		return new Response("{}", { status: 200, headers: { "set-cookie": "connect.sid=test; Path=/" } });
	}
	if (u.includes("/configuration")) {
		return new Response("[Interface]\nPrivateKey = fake\nAddress = 10.8.0.2/24", { status: 200 });
	}
	if (u.includes("/qrcode.svg")) {
		return new Response("<svg>fake-qr</svg>", { status: 200 });
	}
	if (u.includes("/api/wireguard/client") && (!opts?.method || opts.method === "GET")) {
		return new Response(JSON.stringify([
			{
				id: "peer-001", name: "iPhone", enabled: true,
				address: "10.8.0.2", publicKey: "abc123==",
				createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
				latestHandshakeAt: new Date().toISOString(),
				transferRx: 1024 * 1024, transferTx: 512 * 1024,
			},
		]), { status: 200 });
	}
	if (u.includes("/api/wireguard/client") && opts?.method === "POST") {
		return new Response(JSON.stringify({
			id: "peer-002", name: "Laptop", enabled: true,
			address: "10.8.0.3", publicKey: "xyz789==",
			createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
			latestHandshakeAt: null, transferRx: 0, transferTx: 0,
		}), { status: 200 });
	}
	if (u.includes("/api/wireguard/client/peer-001") && opts?.method === "DELETE") {
		return new Response("{}", { status: 200 });
	}
	if (u.includes("/enable") || u.includes("/disable")) {
		return new Response("{}", { status: 200 });
	}
	return new Response("{}", { status: 200 });
};

mock.module("node:child_process", () => ({ execSync: mockExecSync, spawn: mock(() => ({})) }));

import { buildTestServer } from "../helpers/server.ts";

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestServer(); });
afterAll(async () => { await app.close(); });

describe("vpn module", () => {
	it("GET /vpn/status — returns status object", async () => {
		const res = await app.inject({ method: "GET", url: "/vpn/status" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveProperty("status");
		expect(body).toHaveProperty("wgPort");
		expect(body).toHaveProperty("peers");
	});

	it("POST /vpn/start — 400 without required host", async () => {
		const res = await app.inject({
			method: "POST", url: "/vpn/start",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ password: "strongpassword123" }),
		});
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error"); // host field missing → validation error
	});

	it("POST /vpn/start — 400 with short password", async () => {
		const res = await app.inject({
			method: "POST", url: "/vpn/start",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ password: "short", host: "1.2.3.4" }),
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error).toContain("8 characters");
	});

	it("POST /vpn/start — returns ok when already running", async () => {
		// Container mock returns "running", so it should say already running
		const res = await app.inject({
			method: "POST", url: "/vpn/start",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ password: "strongpassword123", host: "1.2.3.4" }),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("GET /vpn/peers — lists peers", async () => {
		const res = await app.inject({ method: "GET", url: "/vpn/peers" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(Array.isArray(body.peers)).toBe(true);
		expect(body.peers[0].name).toBe("iPhone");
		expect(body.peers[0].transferRx).toContain("MB");
	});

	it("POST /vpn/peers — 400 for invalid peer name (spaces)", async () => {
		const res = await app.inject({
			method: "POST", url: "/vpn/peers",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ name: "my laptop" }),
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /vpn/peers — creates a valid peer", async () => {
		const res = await app.inject({
			method: "POST", url: "/vpn/peers",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ name: "MyLaptop" }),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.ok).toBe(true);
		expect(body.peer.name).toBe("Laptop");
		expect(body.next).toContain("/qr");
	});

	it("GET /vpn/peers/peer-001/config — returns WireGuard config", async () => {
		const res = await app.inject({ method: "GET", url: "/vpn/peers/peer-001/config" });
		expect(res.statusCode).toBe(200);
		expect(res.body).toContain("[Interface]");
	});

	it("GET /vpn/peers/peer-001/qr — returns SVG", async () => {
		const res = await app.inject({ method: "GET", url: "/vpn/peers/peer-001/qr" });
		expect(res.statusCode).toBe(200);
		expect(res.body).toContain("<svg>");
	});

	it("DELETE /vpn/peers/peer-001 — removes peer", async () => {
		const res = await app.inject({ method: "DELETE", url: "/vpn/peers/peer-001" });
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("POST /vpn/stop — stops WireGuard", async () => {
		const res = await app.inject({ method: "POST", url: "/vpn/stop" });
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("is in /apps with docker + network + system permissions", async () => {
		const res = await app.inject({ method: "GET", url: "/apps" });
		const apps = res.json().apps as { name: string; permissions: string[] }[];
		const vpn = apps.find((a) => a.name === "vpn");
		expect(vpn).toBeDefined();
		expect(vpn!.permissions).toContain("docker");
		expect(vpn!.permissions).toContain("network");
	});
});
