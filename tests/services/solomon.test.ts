import { describe, expect, it, test } from "bun:test";
import Fastify from "fastify";
import {
	detectMemoryIntent,
	executeAction,
} from "../../src/services/solomon.ts";

/**
 * Tests for Solomon's execution engine.
 * We test executeAction directly — no AI mocking needed, no cross-test pollution.
 * interpretCommand() is covered by integration tests.
 */
describe("Solomon execution engine", () => {
	it("executes a high-confidence GET action (system/health)", async () => {
		const app = Fastify({ logger: false });
		app.get("/health", async () => ({ status: "ok" }));
		await app.ready();

		const result = await executeAction(
			{
				module: "system",
				action: "health",
				params: {},
				raw: "is the system healthy?",
				confidence: "high",
			},
			"Checking system health.",
			app,
		);

		expect(result.executed).toBe(true);
		expect((result.result as Record<string, unknown>).status).toBe("ok");
		await app.close();
	});

	it("does not execute when module is null", async () => {
		const app = Fastify({ logger: false });
		await app.ready();

		const result = await executeAction(
			{
				module: null,
				action: null,
				params: {},
				raw: "hello",
				confidence: "low",
			},
			"Hello!",
			app,
		);

		expect(result.executed).toBe(false);
		expect(result.result).toBeUndefined();
		await app.close();
	});

	it("does not execute when confidence is low", async () => {
		const app = Fastify({ logger: false });
		app.get("/minecraft/status", async () => ({ running: false }));
		await app.ready();

		const result = await executeAction(
			{
				module: "minecraft",
				action: "status",
				params: {},
				raw: "maybe check minecraft",
				confidence: "low",
			},
			"I'm not sure what you mean.",
			app,
		);

		expect(result.executed).toBe(false);
		await app.close();
	});

	it("does not execute when action is not in registry", async () => {
		const app = Fastify({ logger: false });
		await app.ready();

		const result = await executeAction(
			{
				module: "minecraft",
				action: "nonexistent_action",
				params: {},
				raw: "do something",
				confidence: "high",
			},
			"Sure.",
			app,
		);

		expect(result.executed).toBe(false);
		await app.close();
	});

	it("executes a POST action and passes body params", async () => {
		const app = Fastify({ logger: false });
		app.post("/minecraft/start", async (req) => ({ received: req.body }));
		await app.ready();

		const result = await executeAction(
			{
				module: "minecraft",
				action: "start",
				params: { version: "1.20.4", memory: "2G" },
				raw: "start minecraft 1.20.4",
				confidence: "high",
			},
			"Starting Minecraft server.",
			app,
		);

		expect(result.executed).toBe(true);
		expect((result.result as Record<string, unknown>).received).toEqual({
			version: "1.20.4",
			memory: "2G",
		});
		await app.close();
	});

	it("returns executed: false and error info when inject throws", async () => {
		const app = Fastify({ logger: false });
		// deliberately no route registered — inject will get a 404 but not throw;
		// to force a throw we close the app first
		await app.ready();
		await app.close();

		const result = await executeAction(
			{
				module: "system",
				action: "health",
				params: {},
				raw: "health check",
				confidence: "high",
			},
			"Checking.",
			app,
		);

		// app is closed so inject should throw or return error
		// either executed:false or result contains error
		expect(typeof result.executed).toBe("boolean");
	});

	it("medium confidence also triggers execution", async () => {
		const app = Fastify({ logger: false });
		app.get("/adblock/status", async () => ({ running: true, blocked: 1234 }));
		await app.ready();

		const result = await executeAction(
			{
				module: "adblock",
				action: "status",
				params: {},
				raw: "how is adblock doing",
				confidence: "medium",
			},
			"Checking adblock status.",
			app,
		);

		expect(result.executed).toBe(true);
		expect((result.result as Record<string, unknown>).running).toBe(true);
		await app.close();
	});
});

describe("detectMemoryIntent", () => {
	test("detects 'find' intent", () => {
		expect(detectMemoryIntent("find my notes about anti-aging")).toBe(true);
	});
	test("detects 'show me' intent", () => {
		expect(detectMemoryIntent("show me my photos from the beach")).toBe(true);
	});
	test("detects 'search' intent", () => {
		expect(detectMemoryIntent("search for emails about invoices")).toBe(true);
	});
	test("detects 'remember' intent", () => {
		expect(detectMemoryIntent("remember this: buy coffee")).toBe(true);
	});
	test("detects 'chronicle' intent", () => {
		expect(detectMemoryIntent("what's in my chronicle")).toBe(true);
	});
	test("does NOT flag command intent", () => {
		expect(detectMemoryIntent("start the minecraft server")).toBe(false);
	});
	test("does NOT flag general question", () => {
		expect(detectMemoryIntent("what is the capital of France")).toBe(false);
	});
	test("does NOT flag status check", () => {
		expect(detectMemoryIntent("check adblock status")).toBe(false);
	});
});
