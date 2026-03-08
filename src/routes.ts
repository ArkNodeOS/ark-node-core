import type { FastifyInstance } from "fastify";
import { getLoadedModules } from "./apps/loader.ts";
import { isOllamaAvailable, listModels, queryAI } from "./services/ai.ts";
import { getFile, listFiles, saveFile } from "./services/storage.ts";

export function registerRoutes(app: FastifyInstance) {
	app.addContentTypeParser(
		["text/plain", "application/octet-stream"],
		{ parseAs: "buffer" },
		(_req, body, done) => {
			done(null, body);
		},
	);

	// Platform
	app.get("/", async () => ({
		message: "Welcome to Ark Node",
		version: "0.2.0",
	}));

	app.get("/apps", async () => ({
		apps: getLoadedModules(),
	}));

	// Storage
	app.get("/storage", async () => ({
		files: await listFiles(),
	}));

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

	// AI
	app.get("/ai/health", async () => ({
		available: await isOllamaAvailable(),
		url: process.env.OLLAMA_URL ?? "http://localhost:11434",
	}));

	app.get("/ai/models", async () => ({
		models: await listModels(),
	}));

	app.post<{ Body: { prompt: string; model?: string; context?: string } }>(
		"/ai/query",
		async (request, reply) => {
			const { prompt, model, context } = request.body;
			if (!prompt) {
				reply.code(400);
				return { error: "prompt is required" };
			}
			try {
				const response = await queryAI(prompt, model, context);
				return { response, model: model ?? process.env.OLLAMA_MODEL ?? "llama3.2" };
			} catch (err) {
				reply.code(503);
				return { error: String(err) };
			}
		},
	);

	app.setNotFoundHandler(async (_request, reply) => {
		reply.code(404);
		return { error: "Not found" };
	});
}
