import {
	mkdir as fsMkdir,
	readdir,
	readFile,
	writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";

const STORAGE_DIR = resolve(import.meta.dirname, "../../storage");

function sanitizePath(filePath: string): string {
	if (!filePath) throw new Error(`Invalid path: empty`);
	// Resolve to absolute path and confirm it stays inside STORAGE_DIR
	const resolved = resolve(STORAGE_DIR, filePath);
	if (!resolved.startsWith(`${STORAGE_DIR}/`) && resolved !== STORAGE_DIR) {
		throw new Error(`Path traversal detected: "${filePath}"`);
	}
	const relative = resolved.slice(STORAGE_DIR.length + 1);
	if (!relative || relative === ".gitkeep") {
		throw new Error(`Invalid path: "${filePath}"`);
	}
	return relative;
}

export async function initStorage(): Promise<void> {
	await fsMkdir(STORAGE_DIR, { recursive: true });
}

export async function initModuleStorage(moduleName: string): Promise<void> {
	await fsMkdir(join(STORAGE_DIR, moduleName), { recursive: true });
}

export async function mkdir(dir: string): Promise<void> {
	const safe = sanitizePath(dir);
	await fsMkdir(join(STORAGE_DIR, safe), { recursive: true });
}

export async function saveFile(
	filePath: string,
	data: string | Buffer,
): Promise<string> {
	const safe = sanitizePath(filePath);
	const full = join(STORAGE_DIR, safe);
	await fsMkdir(resolve(full, ".."), { recursive: true });
	await writeFile(full, data);
	return safe;
}

export async function getFile(filePath: string): Promise<Buffer> {
	const safe = sanitizePath(filePath);
	return readFile(join(STORAGE_DIR, safe));
}

export async function listFiles(dir?: string): Promise<string[]> {
	const target = dir ? join(STORAGE_DIR, sanitizePath(dir)) : STORAGE_DIR;
	try {
		const entries = await readdir(target);
		return entries.filter((e) => e !== ".gitkeep");
	} catch {
		return [];
	}
}
