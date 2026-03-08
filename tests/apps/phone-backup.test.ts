import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import type { FastifyInstance } from "fastify";

const mockExecSync = mock((cmd: string): string => {
	if (cmd.includes("ip route show default")) return "192.168.1.1";
	return "";
});
mock.module("node:child_process", () => ({
	execSync: mockExecSync,
	spawn: mock(() => ({})),
}));

import { buildTestServer } from "../helpers/server.ts";

let app: FastifyInstance;
let deviceToken = "";

beforeAll(async () => {
	app = await buildTestServer();
});
afterAll(async () => {
	await app.close();
});

describe("phone-backup module", () => {
	it("GET /phone-backup/devices — returns empty array initially", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/phone-backup/devices",
		});
		expect(res.statusCode).toBe(200);
		expect(Array.isArray(res.json().devices)).toBe(true);
	});

	it("POST /phone-backup/pair — 400 without deviceName", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/phone-backup/pair",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({}),
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /phone-backup/pair — creates a pairing for iPhone", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/phone-backup/pair",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ deviceName: "iPhone" }),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.ok).toBe(true);
		expect(typeof body.token).toBe("string");
		expect(body.token.length).toBeGreaterThan(30);
		expect(typeof body.pin).toBe("string");
		expect(body.pin).toMatch(/^\d{6}$/);
		expect(body.webdavUrl).toContain("/phone-backup/dav/");
		expect(body.rcloneConfig).toContain("[ark-iphone]");
		expect(body.instructions.ios).toContain("Files app");
		expect(body.instructions.android).toContain("FolderSync");
		expect(body.instructions.rclone).toContain("rclone sync");
		deviceToken = body.token;
	});

	it("POST /phone-backup/pair — accepts custom 6-digit PIN", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/phone-backup/pair",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ deviceName: "Android", pin: "123456" }),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().pin).toBe("123456");
	});

	it("GET /phone-backup/devices — lists paired device", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/phone-backup/devices",
		});
		expect(res.statusCode).toBe(200);
		const { devices } = res.json();
		expect(devices.length).toBeGreaterThanOrEqual(1);
		expect(devices[0]).toHaveProperty("deviceName");
		expect(devices[0]).toHaveProperty("token"); // partial shown
	});

	it("PUT /phone-backup/dav/:token/:filename — uploads a file", async () => {
		if (!deviceToken) return;
		const res = await app.inject({
			method: "PUT",
			url: `/phone-backup/dav/${deviceToken}/IMG_0001.jpg`,
			headers: { "content-type": "application/octet-stream" },
			payload: Buffer.from("fake-jpeg-data"),
		});
		expect(res.statusCode).toBe(201);
		expect(res.json().ok).toBe(true);
	});

	it("GET /phone-backup/dav/:token — lists uploaded files", async () => {
		if (!deviceToken) return;
		const res = await app.inject({
			method: "GET",
			url: `/phone-backup/dav/${deviceToken}`,
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(Array.isArray(body.files)).toBe(true);
	});

	it("PUT /phone-backup/dav/:token/:filename — 401 for invalid token", async () => {
		const res = await app.inject({
			method: "PUT",
			url: "/phone-backup/dav/invalid-token-xyz/photo.jpg",
			headers: { "content-type": "application/octet-stream" },
			payload: Buffer.from("data"),
		});
		expect(res.statusCode).toBe(401);
	});

	it("POST /phone-backup/devices/:token/disable — disables device", async () => {
		if (!deviceToken) return;
		const res = await app.inject({
			method: "POST",
			url: `/phone-backup/devices/${deviceToken}/disable`,
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().enabled).toBe(false);
	});

	it("PUT — 401 when device is disabled", async () => {
		if (!deviceToken) return;
		const res = await app.inject({
			method: "PUT",
			url: `/phone-backup/dav/${deviceToken}/photo.jpg`,
			headers: { "content-type": "application/octet-stream" },
			payload: Buffer.from("data"),
		});
		expect(res.statusCode).toBe(401);
	});

	it("POST /phone-backup/devices/:token/enable — re-enables device", async () => {
		if (!deviceToken) return;
		const res = await app.inject({
			method: "POST",
			url: `/phone-backup/devices/${deviceToken}/enable`,
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().enabled).toBe(true);
	});

	it("GET /phone-backup/stats — returns aggregate stats", async () => {
		const res = await app.inject({ method: "GET", url: "/phone-backup/stats" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(typeof body.pairedDevices).toBe("number");
		expect(typeof body.totalFiles).toBe("number");
		expect(typeof body.totalSizeMb).toBe("string");
	});

	it("DELETE /phone-backup/devices/:token — unpairs device", async () => {
		if (!deviceToken) return;
		const res = await app.inject({
			method: "DELETE",
			url: `/phone-backup/devices/${deviceToken}`,
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("is in /apps with storage + network permissions", async () => {
		const res = await app.inject({ method: "GET", url: "/apps" });
		const apps = res.json().apps as { name: string; permissions: string[] }[];
		const pb = apps.find((a) => a.name === "phone-backup");
		expect(pb).toBeDefined();
		expect(pb!.permissions).toContain("storage");
		expect(pb!.permissions).toContain("network");
	});
});
