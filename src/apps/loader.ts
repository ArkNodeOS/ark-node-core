import "reflect-metadata";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import {
	getInitMethod,
	getManifest,
	getRoutes,
	MANIFEST_KEY,
} from "../decorators/index.ts";
import { queryAI } from "../services/ai.ts";
import {
	getFile,
	initModuleStorage,
	listFiles,
	mkdir,
	saveFile,
} from "../services/storage.ts";
import type {
	ArkAPI,
	ArkManifest,
	ArkModule,
	ArkModuleClass,
} from "../types/module.ts";

const APPS_DIR = resolve(import.meta.dirname, ".");
const loadedManifests: ArkManifest[] = [];

function buildAPI(app: FastifyInstance, moduleName: string): ArkAPI {
	return {
		registerRoute(method, path, handler) {
			const fullPath = `/${moduleName}${path}`;
			app.route({ method, url: fullPath, handler });
		},
		storage: {
			save: (p, data) => saveFile(`${moduleName}/${p}`, data),
			get: (p) => getFile(`${moduleName}/${p}`),
			list: (dir) => listFiles(dir ? `${moduleName}/${dir}` : moduleName),
			mkdir: (dir) => mkdir(`${moduleName}/${dir}`),
		},
		ai: {
			query: (prompt, context) => queryAI(prompt, undefined, context),
		},
		log: (msg) => console.log(`[${moduleName}] ${msg}`),
		warn: (msg) => console.warn(`[${moduleName}] ⚠ ${msg}`),
	};
}

// ---- Class-based module loader (decorator-driven) ----
function isClassModule(mod: unknown): mod is { default: ArkModuleClass } {
	if (!mod || typeof mod !== "object") return false;
	const def = (mod as any).default;
	if (typeof def !== "function") return false;
	return Reflect.hasMetadata(MANIFEST_KEY, def);
}

async function loadClassModule(
	ModClass: ArkModuleClass,
	app: FastifyInstance,
): Promise<ArkManifest | null> {
	const manifest = getManifest(ModClass);
	if (!manifest) return null;

	const instance = new ModClass();
	const routes = getRoutes(ModClass);
	const api = buildAPI(app, manifest.name);

	await initModuleStorage(manifest.name);

	for (const { method, path, handlerKey } of routes) {
		const handler = instance[handlerKey]?.bind(instance);
		if (typeof handler === "function") {
			api.registerRoute(method, path, handler);
		}
	}

	// Inject api into instance for use in @OnInit and handlers
	instance._api = api;

	const initKey = getInitMethod(ModClass);
	if (initKey && typeof instance[initKey] === "function") {
		await instance[initKey]();
	}

	api.log(`Loaded (class) v${manifest.version}`);
	return manifest;
}

// ---- Functional module loader (legacy, backward-compatible) ----
function isFunctionalModule(mod: unknown): mod is ArkModule {
	if (!mod || typeof mod !== "object") return false;
	return (
		"manifest" in (mod as object) &&
		"run" in (mod as object) &&
		typeof (mod as any).run === "function"
	);
}

async function loadFunctionalModule(
	mod: ArkModule,
	app: FastifyInstance,
): Promise<ArkManifest | null> {
	const { manifest } = mod;
	await initModuleStorage(manifest.name);
	const api = buildAPI(app, manifest.name);
	await mod.run(api);
	api.log(`Loaded v${manifest.version}`);
	return manifest;
}

// ---- Main loader ----
export async function loadApps(app: FastifyInstance): Promise<ArkManifest[]> {
	loadedManifests.length = 0;

	const entries = await readdir(APPS_DIR, { withFileTypes: true });
	const dirs = entries.filter((e) => e.isDirectory());

	for (const dir of dirs) {
		const modulePath = join(APPS_DIR, dir.name, "index.ts");
		try {
			const mod = await import(modulePath);
			let manifest: ArkManifest | null = null;

			if (isClassModule(mod)) {
				manifest = await loadClassModule(mod.default, app);
			} else if (isFunctionalModule(mod)) {
				manifest = await loadFunctionalModule(mod as ArkModule, app);
			} else {
				console.warn(
					`[loader] Skipping "${dir.name}": no valid module export found`,
				);
				continue;
			}

			if (manifest) loadedManifests.push(manifest);
		} catch (err) {
			console.error(`[loader] Failed to load "${dir.name}":`, err);
		}
	}

	console.log(`[loader] ${loadedManifests.length} module(s) loaded`);
	return loadedManifests;
}

export function getLoadedModules(): ArkManifest[] {
	return [...loadedManifests];
}
