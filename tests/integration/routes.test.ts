/**
 * Integration tests — spins up a real Fastify server and hits routes via inject().
 * No network calls, no Docker. Pure in-process testing.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { FastifyInstance } from "fastify";
import { buildTestServer } from "../helpers/server.ts";

// Mock fetch so AI routes don't need a real Ollama
(globalThis as any).fetch = async (url: string) => {
	const u = url.toString();
	if (u.includes("/api/tags")) {
		return new Response(JSON.stringify({ models: [{ name: "llama3.2:latest" }] }), { status: 200 });
	}
	if (u.includes("/api/generate")) {
		return new Response(JSON.stringify({ response: "mocked response", done: true, model: "llama3.2" }), { status: 200 });
	}
	return new Response("{}", { status: 200 });
};

let app: FastifyInstance;

beforeAll(async () => {
	app = await buildTestServer();
});

afterAll(async () => {
	await app.close();
});

// ---- Core platform routes ----

describe("GET /health", () => {
	it("returns { status: ok }", async () => {
		const res = await app.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ status: "ok" });
	});
});

describe("GET /status", () => {
	it("returns cpu, memory, uptime", async () => {
		const res = await app.inject({ method: "GET", url: "/status" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveProperty("memory");
		expect(body).toHaveProperty("uptime");
		expect(body).toHaveProperty("cpu");
		expect(typeof body.uptime).toBe("number");
	});
});

describe("GET /", () => {
	it("returns welcome message and version", async () => {
		const res = await app.inject({ method: "GET", url: "/" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.message).toContain("Ark Node");
		expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
	});
});

describe("GET /apps", () => {
	it("returns an apps array", async () => {
		const res = await app.inject({ method: "GET", url: "/apps" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(Array.isArray(body.apps)).toBe(true);
	});

	it("each app has name, version, description", async () => {
		const res = await app.inject({ method: "GET", url: "/apps" });
		const { apps } = res.json();
		for (const app of apps) {
			expect(typeof app.name).toBe("string");
			expect(typeof app.version).toBe("string");
			expect(typeof app.description).toBe("string");
		}
	});
});

// ---- Storage routes ----

describe("storage routes", () => {
	const filename = `integration-test-${Date.now()}.txt`;

	it("POST /storage/:filename — saves a file (201)", async () => {
		const res = await app.inject({
			method: "POST",
			url: `/storage/${filename}`,
			headers: { "content-type": "text/plain" },
			payload: "test content",
		});
		expect(res.statusCode).toBe(201);
		expect(res.json()).toHaveProperty("saved");
	});

	it("GET /storage/:filename — retrieves the saved file", async () => {
		const res = await app.inject({ method: "GET", url: `/storage/${filename}` });
		expect(res.statusCode).toBe(200);
		expect(res.body).toBe("test content");
	});

	it("GET /storage — lists files (includes our test file)", async () => {
		const res = await app.inject({ method: "GET", url: "/storage" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(Array.isArray(body.files)).toBe(true);
		expect(body.files).toContain(filename);
	});

	it("GET /storage/:filename — 404 for nonexistent file", async () => {
		const res = await app.inject({ method: "GET", url: "/storage/no-such-file-xyz.txt" });
		expect(res.statusCode).toBe(404);
	});
});

// ---- AI routes ----

describe("AI routes", () => {
	it("GET /ai/health — returns availability info", async () => {
		const res = await app.inject({ method: "GET", url: "/ai/health" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(typeof body.available).toBe("boolean");
		expect(typeof body.url).toBe("string");
	});

	it("GET /ai/models — returns models array", async () => {
		const res = await app.inject({ method: "GET", url: "/ai/models" });
		expect(res.statusCode).toBe(200);
		expect(Array.isArray(res.json().models)).toBe(true);
	});

	it("POST /ai/query — returns response string", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/ai/query",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ prompt: "Hello" }),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(typeof body.response).toBe("string");
		expect(typeof body.model).toBe("string");
	});

	it("POST /ai/query — 400 when prompt is missing", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/ai/query",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({}),
		});
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error");
	});
});

// ---- 404 handler ----

describe("404 handler", () => {
	it("returns 404 for unknown routes", async () => {
		const res = await app.inject({ method: "GET", url: "/does-not-exist" });
		expect(res.statusCode).toBe(404);
		expect(res.json()).toMatchObject({ error: "Not found" });
	});
});
