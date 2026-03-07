import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

interface AppModule {
	name: string;
	run: () => void;
}

interface LoadedApp {
	name: string;
}

const APPS_DIR = resolve(import.meta.dirname, ".");

export async function loadApps(): Promise<LoadedApp[]> {
	const loaded: LoadedApp[] = [];

	const entries = await readdir(APPS_DIR, { withFileTypes: true });
	const dirs = entries.filter((e) => e.isDirectory());

	for (const dir of dirs) {
		const modulePath = join(APPS_DIR, dir.name, "index.ts");

		try {
			const mod = (await import(modulePath)) as Partial<AppModule>;

			if (typeof mod.name !== "string" || typeof mod.run !== "function") {
				console.warn(
					`[loader] Skipping app "${dir.name}": missing "name" or "run" export`,
				);
				continue;
			}

			mod.run();
			loaded.push({ name: mod.name });
			console.log(`[loader] Loaded app: ${mod.name}`);
		} catch (err) {
			console.error(`[loader] Failed to load app "${dir.name}":`, err);
		}
	}

	console.log(`[loader] ${loaded.length} app(s) loaded`);
	return loaded;
}
