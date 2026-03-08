import type { ArkAPI, ArkManifest } from "../../types/module.ts";

export const manifest: ArkManifest = {
	name: "hello-world",
	version: "1.0.0",
	description: "Example module — demonstrates the Ark module API",
	icon: "👋",
	permissions: ["storage"],
};

export const run = (api: ArkAPI) => {
	api.log("Hello from hello-world module!");

	api.registerRoute("GET", "/ping", async (_req, _reply) => ({
		message: "pong",
		module: manifest.name,
		version: manifest.version,
	}));

	api.registerRoute("POST", "/echo", async (req, _reply) => ({
		echo: req.body,
	}));
};
