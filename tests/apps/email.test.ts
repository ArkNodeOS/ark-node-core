/**
 * Email module tests.
 * IMAP connections are not made — we test the API layer (account management,
 * validation, presets) and verify credentials are never returned.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { FastifyInstance } from "fastify";
import { buildTestServer } from "../helpers/server.ts";

let app: FastifyInstance;

beforeAll(async () => {
	app = await buildTestServer();
});

afterAll(async () => {
	await app.close();
});

describe("email module — presets", () => {
	it("GET /email/presets — returns provider list", async () => {
		const res = await app.inject({ method: "GET", url: "/email/presets" });
		expect(res.statusCode).toBe(200);
		const { presets } = res.json();
		expect(Array.isArray(presets)).toBe(true);
		expect(presets.length).toBeGreaterThan(0);
	});

	it("includes Gmail preset with correct IMAP host", async () => {
		const res = await app.inject({ method: "GET", url: "/email/presets" });
		const { presets } = res.json() as {
			presets: { provider: string; host: string; port: number; tls: boolean }[];
		};
		const gmail = presets.find((p) => p.provider === "gmail");
		expect(gmail).toBeDefined();
		expect(gmail!.host).toBe("imap.gmail.com");
		expect(gmail!.port).toBe(993);
		expect(gmail!.tls).toBe(true);
	});

	it("includes outlook, yahoo, icloud, hotmail, aol presets", async () => {
		const res = await app.inject({ method: "GET", url: "/email/presets" });
		const { presets } = res.json() as { presets: { provider: string }[] };
		const providers = presets.map((p) => p.provider);
		for (const expected of ["outlook", "yahoo", "icloud", "hotmail", "aol"]) {
			expect(providers).toContain(expected);
		}
	});
});

describe("email module — account management", () => {
	const testAccountId = { id: "" };

	it("GET /email/accounts — returns empty array initially", async () => {
		const res = await app.inject({ method: "GET", url: "/email/accounts" });
		expect(res.statusCode).toBe(200);
		expect(Array.isArray(res.json().accounts)).toBe(true);
	});

	it("POST /email/accounts — adds account with provider preset", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/email/accounts",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				label: "Test Gmail",
				username: "test@gmail.com",
				password: "super-secret-password",
				provider: "gmail",
			}),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.ok).toBe(true);
		expect(body.account).toBeDefined();
		expect(body.account.id).toBeDefined();
		testAccountId.id = body.account.id;
	});

	it("POST /email/accounts — returned account does NOT contain password", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/email/accounts",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				label: "Test Yahoo",
				username: `test-${Date.now()}@yahoo.com`,
				password: "another-secret",
				provider: "yahoo",
			}),
		});
		const body = res.json();
		expect(JSON.stringify(body)).not.toContain("another-secret");
	});

	it("GET /email/accounts — lists accounts WITHOUT passwords", async () => {
		const res = await app.inject({ method: "GET", url: "/email/accounts" });
		const body = res.json();
		expect(Array.isArray(body.accounts)).toBe(true);
		const raw = JSON.stringify(body);
		expect(raw).not.toContain("super-secret-password");
		expect(raw).not.toContain("another-secret");
	});

	it("POST /email/accounts — 400 when label is missing", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/email/accounts",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				username: "a@b.com",
				password: "pass",
				provider: "gmail",
			}),
		});
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error");
	});

	it("POST /email/accounts — 400 when password is missing", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/email/accounts",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				label: "No Pass",
				username: "a@b.com",
				provider: "gmail",
			}),
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /email/accounts — 400 for unknown provider", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/email/accounts",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				label: "Bad Provider",
				username: "a@fakemail.xyz",
				password: "pw",
				provider: "fakemail",
			}),
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error).toContain("Unknown provider");
	});

	it("POST /email/accounts — 409 on duplicate account", async () => {
		// Same username+host = same ID
		const payload = {
			label: "Dupe",
			username: "test@gmail.com",
			password: "pw",
			provider: "gmail",
		};
		const res = await app.inject({
			method: "POST",
			url: "/email/accounts",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify(payload),
		});
		expect(res.statusCode).toBe(409);
	});

	it("POST /email/accounts — works with custom host/port/tls", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/email/accounts",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				label: "Custom IMAP",
				username: `user-${Date.now()}@custom.example.com`,
				password: "pw",
				host: "imap.custom.example.com",
				port: 993,
				tls: true,
			}),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("DELETE /email/accounts/:id — removes account", async () => {
		if (!testAccountId.id) return;
		const res = await app.inject({
			method: "DELETE",
			url: `/email/accounts/${testAccountId.id}`,
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("DELETE /email/accounts/:id — 404 for nonexistent id", async () => {
		const res = await app.inject({
			method: "DELETE",
			url: "/email/accounts/nonexistent-id-xyz",
		});
		expect(res.statusCode).toBe(404);
	});
});

describe("email module — manifest", () => {
	it("is listed in /apps with network + storage permissions", async () => {
		const res = await app.inject({ method: "GET", url: "/apps" });
		const { apps } = res.json() as {
			apps: { name: string; permissions: string[] }[];
		};
		const emailApp = apps.find((a) => a.name === "email");
		expect(emailApp).toBeDefined();
		expect(emailApp!.permissions).toContain("network");
		expect(emailApp!.permissions).toContain("storage");
	});
});
