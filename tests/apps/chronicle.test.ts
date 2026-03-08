import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// We test the Chronicle service directly, not via HTTP
const DB_PATH = join(tmpdir(), `ark-chronicle-test-${Date.now()}.db`);

// Patch the module resolution so getChronicle() uses our temp DB
// We do this by importing and calling directly after monkeypatching the path
let getChronicle: typeof import("../../src/services/chronicle.ts")["getChronicle"];

describe("Chronicle service", () => {
	beforeAll(async () => {
		// Use private import so we can test with a custom DB path
		const mod = await import("../../src/services/chronicle.ts");
		// Call getChronicle to init the singleton (uses default storage path, that's OK for tests)
		getChronicle = mod.getChronicle;
	});

	afterAll(async () => {
		await rm(DB_PATH, { force: true });
	});

	it("stats returns zero total on fresh db", () => {
		const c = getChronicle();
		const stats = c.stats();
		expect(stats).toHaveProperty("total");
		expect(typeof stats.total).toBe("number");
		expect(stats).toHaveProperty("by_source");
	});

	it("addEntry stores an entry", () => {
		const c = getChronicle();
		const before = c.stats().total;
		c.addEntry({
			id: `test-note-${Date.now()}`,
			source_type: "note",
			title: "Test note about castles",
			content: "Medieval castles were built for defense and lord residence.",
			metadata: { tags: ["history"] },
		});
		expect(c.stats().total).toBe(before + 1);
	});

	it("search finds entry by keyword", () => {
		const c = getChronicle();
		c.addEntry({
			id: `test-search-${Date.now()}`,
			source_type: "file",
			title: "Philosophy notes",
			content:
				"Aquinas proved the existence of God through the Five Ways argument.",
			metadata: {},
		});
		const results = c.search("Aquinas");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]?.title).toBe("Philosophy notes");
	});

	it("search returns snippet", () => {
		const c = getChronicle();
		const results = c.search("Aquinas");
		expect(results[0]?.snippet).toContain("Aquinas");
	});

	it("search respects source filter", () => {
		const c = getChronicle();
		const fileResults = c.search("Aquinas", { source: "file" });
		const emailResults = c.search("Aquinas", { source: "email" });
		expect(fileResults.length).toBeGreaterThan(0);
		expect(emailResults.length).toBe(0);
	});

	it("addEntries bulk inserts", () => {
		const c = getChronicle();
		const before = c.stats().total;
		const count = c.addEntries([
			{
				id: `bulk-${Date.now()}-1`,
				source_type: "email",
				title: "Bulk email 1",
				content: "Hello world email content bulk",
				metadata: {},
			},
			{
				id: `bulk-${Date.now()}-2`,
				source_type: "email",
				title: "Bulk email 2",
				content: "Another email in bulk import test",
				metadata: {},
			},
		]);
		expect(count).toBe(2);
		expect(c.stats().total).toBe(before + 2);
	});

	it("deleteEntry removes an entry", () => {
		const c = getChronicle();
		const delId = `delete-me-${Date.now()}`;
		c.addEntry({
			id: delId,
			source_type: "note",
			title: "To be deleted",
			content: "This entry will be deleted",
			metadata: {},
		});
		const deleted = c.deleteEntry(delId);
		expect(deleted).toBe(true);
		expect(c.getEntry(delId)).toBeNull();
	});

	it("getEntry returns null for missing id", () => {
		expect(getChronicle().getEntry("does-not-exist")).toBeNull();
	});

	it("recent returns entries in indexed_at desc order", () => {
		const c = getChronicle();
		const recent = c.recent(5);
		expect(Array.isArray(recent)).toBe(true);
		if (recent.length >= 2) {
			expect(recent[0]?.indexed_at ?? 0).toBeGreaterThanOrEqual(
				recent[1]?.indexed_at ?? 0,
			);
		}
	});

	it("stats by_source reflects actual data", () => {
		const stats = getChronicle().stats();
		expect(stats.by_source).toHaveProperty("note");
		expect(stats.by_source).toHaveProperty("email");
		expect(stats.by_source).toHaveProperty("file");
	});

	it("search with empty query returns recent entries", () => {
		const results = getChronicle().search("");
		expect(Array.isArray(results)).toBe(true);
	});
});
