import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getLoadedModules } from "./apps/loader.ts";
import { isOllamaAvailable, listModels, queryAI } from "./services/ai.ts";
import { interpretCommand } from "./services/solomon.ts";
import { getFile, listFiles, saveFile } from "./services/storage.ts";

// ---- Marketplace ----
const REGISTRY_URL =
	"https://raw.githubusercontent.com/ArkNodeOS/ark-registry/main/registry.json";

// ---- Zod schemas ----
const AIQuerySchema = z.object({
	prompt: z.string().min(1, "prompt cannot be empty"),
	model: z.string().optional(),
	context: z.string().optional(),
});

const SolomonSchema = z.object({
	message: z.string().min(1, "message cannot be empty"),
});

// ---- Route registration ----
export function registerRoutes(app: FastifyInstance) {
	app.addContentTypeParser(
		["text/plain", "application/octet-stream"],
		{ parseAs: "buffer" },
		(_req, body, done) => done(null, body),
	);

	// ---- Platform ----
	app.get("/", async () => ({
		message: "Welcome to Ark Node",
		version: "0.3.0",
		codename: "Solomon",
		tagline: "Your data. Your intelligence. Your Ark.",
	}));

	app.get("/apps", async () => ({
		apps: getLoadedModules(),
	}));

	// ---- Storage ----
	app.get("/storage", async () => ({ files: await listFiles() }));

	app.post<{ Params: { filename: string } }>(
		"/storage/:filename",
		async (request, reply) => {
			const saved = await saveFile(
				request.params.filename,
				request.body as string | Buffer,
			);
			reply.code(201);
			return { saved };
		},
	);

	app.get<{ Params: { filename: string } }>(
		"/storage/:filename",
		async (request, reply) => {
			try {
				const data = await getFile(request.params.filename);
				reply.type("application/octet-stream");
				return data;
			} catch {
				reply.code(404);
				return { error: "File not found" };
			}
		},
	);

	// ---- AI ----
	app.get("/ai/health", async () => ({
		available: await isOllamaAvailable(),
		url: process.env.OLLAMA_URL ?? "http://localhost:11434",
	}));

	app.get("/ai/models", async () => ({ models: await listModels() }));

	app.post("/ai/query", async (request, reply) => {
		const result = AIQuerySchema.safeParse(request.body);
		if (!result.success) {
			reply.code(400);
			return { error: result.error.issues[0]?.message ?? "Invalid request" };
		}
		const { prompt, model, context } = result.data;
		try {
			const response = await queryAI(prompt, model, context);
			return {
				response,
				model: model ?? process.env.OLLAMA_MODEL ?? "llama3.2",
			};
		} catch (err) {
			reply.code(503);
			return { error: String(err) };
		}
	});

	// ---- Solomon (natural language command routing) ----
	app.post("/solomon", async (request, reply) => {
		const result = SolomonSchema.safeParse(request.body);
		if (!result.success) {
			reply.code(400);
			return { error: result.error.issues[0]?.message ?? "Invalid request" };
		}
		const modules = getLoadedModules().map((m) => m.name);
		try {
			const response = await interpretCommand(
				result.data.message,
				modules,
				app,
			);
			return response;
		} catch (err) {
			reply.code(503);
			return { error: String(err) };
		}
	});

	// ---- Marketplace ----
	app.get("/marketplace", async (_request, reply) => {
		try {
			const res = await fetch(REGISTRY_URL, {
				signal: AbortSignal.timeout(8000),
			});
			if (!res.ok) throw new Error(`Registry returned ${res.status}`);
			const registry = await res.json();
			return registry;
		} catch (err) {
			reply.code(503);
			return { error: `Could not fetch registry: ${String(err)}` };
		}
	});

	app.get("/marketplace/installed", async () => {
		const installed = getLoadedModules().map((m) => m.name);
		return { installed };
	});

	// ---- 404 ----
	app.setNotFoundHandler(async (_request, reply) => {
		reply.code(404);
		return { error: "Not found" };
	});
}
