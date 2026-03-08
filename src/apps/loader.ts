import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { getFile, initModuleStorage, listFiles, mkdir, saveFile } from "../services/storage.ts";
import type { ArkAPI, ArkManifest, ArkModule } from "../types/module.ts";

const APPS_DIR = resolve(import.meta.dirname, ".");
const loadedManifests: ArkManifest[] = [];

function buildAPI(app: FastifyInstance, moduleName: string): ArkAPI {
	return {
		registerRoute(method, path, handler) {
			const fullPath = `/${moduleName}${path}`;
			app.route({ method, url: fullPath, handler });
			console.log(`[${moduleName}] Registered route: ${method} ${fullPath}`);
		},
		storage: {
			save: (filePath, data) => saveFile(`${moduleName}/${filePath}`, data),
			get: (filePath) => getFile(`${moduleName}/${filePath}`),
			list: (dir) => listFiles(dir ? `${moduleName}/${dir}` : moduleName),
			mkdir: (dir) => mkdir(`${moduleName}/${dir}`),
		},
		log: (msg) => console.log(`[${moduleName}] ${msg}`),
	};
}

export async function loadApps(app: FastifyInstance): Promise<ArkManifest[]> {
	loadedManifests.length = 0;

	const entries = await readdir(APPS_DIR, { withFileTypes: true });
	const dirs = entries.filter((e) => e.isDirectory());

	for (const dir of dirs) {
		const modulePath = join(APPS_DIR, dir.name, "index.ts");

		try {
			const mod = (await import(modulePath)) as Partial<ArkModule>;

			if (
				!mod.manifest ||
				typeof mod.manifest.name !== "string" ||
				typeof mod.run !== "function"
			) {
				console.warn(
					`[loader] Skipping "${dir.name}": missing manifest or run export`,
				);
				continue;
			}

			await initModuleStorage(mod.manifest.name);
			const api = buildAPI(app, mod.manifest.name);
			await mod.run(api);

			loadedManifests.push(mod.manifest);
			console.log(
				`[loader] Loaded: ${mod.manifest.name} v${mod.manifest.version}`,
			);
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
