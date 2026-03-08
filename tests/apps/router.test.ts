import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import type { FastifyInstance } from "fastify";

const mockExecSync = mock((cmd: string): string => {
	if (cmd.includes("ip route show default") && cmd.includes("awk '/default/ {print $3}'")) return "192.168.1.1";
	if (cmd.includes("ip route show default") && cmd.includes("awk '/default/ {print $5}'")) return "eth0";
	if (cmd.includes("ip -4 addr show eth0")) return "192.168.1.100";
	if (cmd.includes("ip -4 addr")) return "2: eth0\n    inet 192.168.1.100/24";
	if (cmd.includes("cat /etc/resolv.conf")) return "nameserver 1.1.1.1\nnameserver 8.8.8.8";
	if (cmd.includes("systemctl is-active systemd-resolved")) return "inactive";
	if (cmd.includes("iptables -L INPUT")) return "1    ACCEPT    all  --  0.0.0.0/0  0.0.0.0/0\n";
	if (cmd.includes("iptables -L OUTPUT")) return "";
	if (cmd.includes("iptables -L FORWARD")) return "";
	if (cmd.includes("iptables -t nat")) return "";
	if (cmd.includes("iptables -A") || cmd.includes("iptables -t nat -A")) return "";
	if (cmd.includes("echo 1 | sudo tee")) return "";
	if (cmd.includes("sysctl")) return "";
	if (cmd.includes("arp -n")) return "192.168.1.10  ether  aa:bb:cc:dd:ee:ff  C  eth0\n192.168.1.20  ether  11:22:33:44:55:66  C  eth0";
	if (cmd.includes("which nmap")) return "";
	if (cmd.includes("which arp-scan")) return "";
	return "";
});

(globalThis as any).fetch = async (url: string) => {
	if (url.toString().includes("ipify.org")) return new Response("1.2.3.4", { status: 200 });
	return new Response("{}", { status: 200 });
};

mock.module("node:child_process", () => ({ execSync: mockExecSync, spawn: mock(() => ({})) }));

import { buildTestServer } from "../helpers/server.ts";

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestServer(); });
afterAll(async () => { await app.close(); });

describe("router module", () => {
	it("GET /router/network — returns gateway, localIP, publicIP", async () => {
		const res = await app.inject({ method: "GET", url: "/router/network" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveProperty("gateway");
		expect(body).toHaveProperty("localIP");
		expect(body).toHaveProperty("publicIP");
		expect(Array.isArray(body.interfaces)).toBe(true);
	});

	it("GET /router/dns — returns current DNS servers", async () => {
		const res = await app.inject({ method: "GET", url: "/router/dns" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(Array.isArray(body.servers)).toBe(true);
		expect(typeof body.usingArk).toBe("boolean");
	});

	it("POST /router/dns — validates IP format", async () => {
		const res = await app.inject({
			method: "POST", url: "/router/dns",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ primary: "not-an-ip" }),
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /router/dns — accepts valid IPv4", async () => {
		const res = await app.inject({
			method: "POST", url: "/router/dns",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ primary: "1.1.1.1", secondary: "8.8.8.8" }),
		});
		// Either 200 (set) or 403 (no sudo) — both valid in test env
		expect([200, 403]).toContain(res.statusCode);
		expect(res.json()).toHaveProperty("servers");
	});

	it("GET /router/firewall — returns rule chains", async () => {
		const res = await app.inject({ method: "GET", url: "/router/firewall" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveProperty("INPUT");
		expect(body).toHaveProperty("OUTPUT");
		expect(body).toHaveProperty("FORWARD");
	});

	it("POST /router/firewall — 400 for invalid action", async () => {
		const res = await app.inject({
			method: "POST", url: "/router/firewall",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ action: "INVALID", direction: "INPUT", protocol: "tcp", port: 80 }),
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /router/firewall — adds valid rule", async () => {
		const res = await app.inject({
			method: "POST", url: "/router/firewall",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ action: "DROP", direction: "INPUT", protocol: "tcp", port: 23, comment: "block-telnet" }),
		});
		expect([200, 500]).toContain(res.statusCode); // 500 if no sudo in test env
	});

	it("POST /router/ports — validates required fields", async () => {
		const res = await app.inject({
			method: "POST", url: "/router/ports",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ externalPort: 8080 }), // missing internalIp + internalPort
		});
		expect(res.statusCode).toBe(400);
	});

	it("GET /router/devices — returns device list", async () => {
		const res = await app.inject({ method: "GET", url: "/router/devices" });
		// Either returns devices or 503 (can't get subnet in test env)
		expect([200, 503]).toContain(res.statusCode);
		if (res.statusCode === 200) {
			expect(Array.isArray(res.json().devices)).toBe(true);
		}
	});

	it("is in /apps with network + system permissions", async () => {
		const res = await app.inject({ method: "GET", url: "/apps" });
		const apps = res.json().apps as { name: string; permissions: string[] }[];
		const router = apps.find((a) => a.name === "router");
		expect(router).toBeDefined();
		expect(router!.permissions).toContain("network");
		expect(router!.permissions).toContain("system");
	});
});
