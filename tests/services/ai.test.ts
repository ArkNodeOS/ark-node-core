import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

// We mock global fetch before importing the module
const mockFetch = mock(async (url: string, opts?: RequestInit): Promise<Response> => {
	const u = url.toString();

	if (u.includes("/api/tags")) {
		return new Response(
			JSON.stringify({
				models: [
					{ name: "llama3.2:latest", modified_at: "2024-01-01", size: 1000 },
					{ name: "mistral:7b", modified_at: "2024-01-01", size: 2000 },
				],
			}),
			{ status: 200 },
		);
	}

	if (u.includes("/api/generate")) {
		const body = JSON.parse((opts?.body as string) ?? "{}");
		return new Response(
			JSON.stringify({ response: `Echo: ${body.prompt}`, done: true, model: body.model }),
			{ status: 200 },
		);
	}

	return new Response("Not found", { status: 404 });
});

// Patch global fetch
(globalThis as any).fetch = mockFetch;

import { isOllamaAvailable, listModels, queryAI } from "../../src/services/ai.ts";

describe("ai service", () => {
	beforeEach(() => mockFetch.mockClear());

	describe("isOllamaAvailable", () => {
		it("returns true when Ollama responds with 200", async () => {
			const result = await isOllamaAvailable();
			expect(result).toBe(true);
		});

		it("returns false when fetch throws (no server)", async () => {
			const failFetch = mock(async () => { throw new Error("ECONNREFUSED"); });
			(globalThis as any).fetch = failFetch;
			const result = await isOllamaAvailable();
			expect(result).toBe(false);
			(globalThis as any).fetch = mockFetch;
		});
	});

	describe("listModels", () => {
		it("returns an array of model name strings", async () => {
			const models = await listModels();
			expect(Array.isArray(models)).toBe(true);
			expect(models).toContain("llama3.2:latest");
			expect(models).toContain("mistral:7b");
		});

		it("returns empty array when fetch fails", async () => {
			const failFetch = mock(async () => { throw new Error("network"); });
			(globalThis as any).fetch = failFetch;
			const models = await listModels();
			expect(models).toEqual([]);
			(globalThis as any).fetch = mockFetch;
		});
	});

	describe("queryAI", () => {
		it("returns a response string", async () => {
			const response = await queryAI("Hello world");
			expect(typeof response).toBe("string");
			expect(response).toContain("Hello world");
		});

		it("prepends context when provided", async () => {
			const response = await queryAI("question", undefined, "You are a pirate.");
			expect(typeof response).toBe("string");
		});

		it("uses the provided model", async () => {
			await queryAI("test", "mistral:7b");
			const call = mockFetch.mock.calls.find((c) => c[0].toString().includes("/api/generate"));
			expect(call).toBeDefined();
			const body = JSON.parse(call![1]?.body as string);
			expect(body.model).toBe("mistral:7b");
		});

		it("throws on non-200 response", async () => {
			const errorFetch = mock(async (url: string) => {
				if (url.toString().includes("/api/generate")) {
					return new Response("model not found", { status: 404 });
				}
				return new Response("{}", { status: 200 });
			});
			(globalThis as any).fetch = errorFetch;
			await expect(queryAI("test")).rejects.toThrow("404");
			(globalThis as any).fetch = mockFetch;
		});
	});
});
