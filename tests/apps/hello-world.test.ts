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

describe("hello-world module", () => {
	it("GET /hello-world/ping — returns pong", async () => {
		const res = await app.inject({ method: "GET", url: "/hello-world/ping" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.message).toBe("pong");
		expect(body.module).toBe("hello-world");
		expect(body.version).toBe("1.0.0");
	});

	it("POST /hello-world/echo — echoes back the body", async () => {
		const payload = { test: true, value: 42 };
		const res = await app.inject({
			method: "POST",
			url: "/hello-world/echo",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify(payload),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().echo).toMatchObject(payload);
	});

	it("is listed in GET /apps with correct manifest", async () => {
		const res = await app.inject({ method: "GET", url: "/apps" });
		const { apps } = res.json() as { apps: { name: string; version: string; permissions: string[] }[] };
		const hw = apps.find((a) => a.name === "hello-world");
		expect(hw).toBeDefined();
		expect(hw!.version).toBe("1.0.0");
		expect(hw!.permissions).toContain("storage");
	});
});
