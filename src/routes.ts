import type { FastifyInstance } from "fastify";
import { getFile, listFiles, saveFile } from "./services/storage.ts";

interface LoadedApp {
	name: string;
}

export function registerRoutes(app: FastifyInstance, loadedApps: LoadedApp[]) {
	app.addContentTypeParser(
		["text/plain", "application/octet-stream"],
		{ parseAs: "buffer" },
		(_req, body, done) => {
			done(null, body);
		},
	);

	app.get("/", async () => {
		return { message: "Welcome to Ark Node", version: "0.1.0" };
	});

	app.get("/apps", async () => {
		return { apps: loadedApps };
	});

	app.get("/storage", async () => {
		const files = await listFiles();
		return { files };
	});

	app.post<{ Params: { filename: string } }>(
		"/storage/:filename",
		async (request, reply) => {
			const { filename } = request.params;
			const body = request.body;
			const saved = await saveFile(filename, body as string | Buffer);
			reply.code(201);
			return { saved };
		},
	);

	app.get<{ Params: { filename: string } }>(
		"/storage/:filename",
		async (request, reply) => {
			const { filename } = request.params;
			try {
				const data = await getFile(filename);
				reply.type("application/octet-stream");
				return data;
			} catch {
				reply.code(404);
				return { error: "File not found" };
			}
		},
	);

	app.setNotFoundHandler(async (_request, reply) => {
		reply.code(404);
		return { error: "Not found" };
	});
}
