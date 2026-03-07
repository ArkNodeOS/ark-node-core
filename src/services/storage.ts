import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const STORAGE_DIR = resolve(import.meta.dirname, "../../storage");

function sanitizeFilename(filename: string): string {
	const sanitized = filename.replace(/[/\\]/g, "").replace(/\.\./g, "");
	if (!sanitized || sanitized === "." || sanitized === ".gitkeep") {
		throw new Error(`Invalid filename: "${filename}"`);
	}
	return sanitized;
}

export async function initStorage(): Promise<void> {
	await mkdir(STORAGE_DIR, { recursive: true });
}

export async function saveFile(
	filename: string,
	data: string | Buffer,
): Promise<string> {
	const safe = sanitizeFilename(filename);
	await writeFile(join(STORAGE_DIR, safe), data);
	return safe;
}

export async function getFile(filename: string): Promise<Buffer> {
	const safe = sanitizeFilename(filename);
	return readFile(join(STORAGE_DIR, safe));
}

export async function listFiles(): Promise<string[]> {
	const entries = await readdir(STORAGE_DIR);
	return entries.filter((e) => e !== ".gitkeep");
}
