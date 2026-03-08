import { mkdir as fsMkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

// We test the storage logic directly by setting STORAGE_DIR via the module.
// Since Bun caches modules, we re-implement the logic against a temp dir here.
import { mkdtemp } from "node:fs/promises";
import {
	getFile,
	initStorage,
	listFiles,
	mkdir,
	saveFile,
} from "../../src/services/storage.ts";

// Storage module uses a resolved path at import time, so we work with what's there.
// These tests validate real behavior against the real storage dir.

describe("storage service", () => {
	describe("saveFile / getFile", () => {
		it("saves and retrieves a text file", async () => {
			const filename = `test-${Date.now()}.txt`;
			await saveFile(filename, "hello ark");
			const buf = await getFile(filename);
			expect(buf.toString()).toBe("hello ark");
		});

		it("saves and retrieves binary data", async () => {
			const filename = `test-${Date.now()}.bin`;
			const data = Buffer.from([0x01, 0x02, 0x03, 0xff]);
			await saveFile(filename, data);
			const result = await getFile(filename);
			expect(result).toEqual(data);
		});

		it("overwrites an existing file", async () => {
			const filename = `test-overwrite-${Date.now()}.txt`;
			await saveFile(filename, "v1");
			await saveFile(filename, "v2");
			const buf = await getFile(filename);
			expect(buf.toString()).toBe("v2");
		});

		it("throws when getting a nonexistent file", async () => {
			await expect(getFile("does-not-exist-xyz.txt")).rejects.toThrow();
		});
	});

	describe("saveFile path sanitization", () => {
		it("rejects path traversal attempts with ..", async () => {
			await expect(saveFile("../../etc/passwd", "evil")).rejects.toThrow();
		});

		it("rejects empty filename", async () => {
			await expect(saveFile("", "data")).rejects.toThrow();
		});

		it("rejects .gitkeep", async () => {
			await expect(saveFile(".gitkeep", "data")).rejects.toThrow();
		});

		it("allows nested paths within storage", async () => {
			const path = `subdir-${Date.now()}/file.txt`;
			const saved = await saveFile(path, "nested");
			expect(saved).toContain("subdir");
			const buf = await getFile(path);
			expect(buf.toString()).toBe("nested");
		});
	});

	describe("listFiles", () => {
		it("returns an array", async () => {
			const files = await listFiles();
			expect(Array.isArray(files)).toBe(true);
		});

		it("does not include .gitkeep", async () => {
			const files = await listFiles();
			expect(files).not.toContain(".gitkeep");
		});

		it("includes files that were saved", async () => {
			const filename = `list-test-${Date.now()}.txt`;
			await saveFile(filename, "present");
			const files = await listFiles();
			expect(files).toContain(filename);
		});

		it("returns empty array for missing subdirectory", async () => {
			const files = await listFiles("no-such-subdir-xyz");
			expect(files).toEqual([]);
		});
	});

	describe("mkdir", () => {
		it("creates a subdirectory without error", async () => {
			await expect(mkdir(`newdir-${Date.now()}`)).resolves.toBeUndefined();
		});

		it("is idempotent — creating twice does not throw", async () => {
			const dir = `idempotent-${Date.now()}`;
			await mkdir(dir);
			await expect(mkdir(dir)).resolves.toBeUndefined();
		});
	});

	describe("initStorage", () => {
		it("resolves without error", async () => {
			await expect(initStorage()).resolves.toBeUndefined();
		});
	});
});
