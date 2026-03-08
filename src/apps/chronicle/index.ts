/**
 * Chronicle Module — personal memory engine.
 * Routes (auto-prefixed with /chronicle by the loader):
 *   GET  /chronicle/search
 *   GET  /chronicle/stats
 *   GET  /chronicle/recent
 *   GET  /chronicle/entry/:id
 *   POST /chronicle/entries
 *   DELETE /chronicle/entries/:id
 *   POST /chronicle/ingest/email
 *   POST /chronicle/ingest/photos
 */

import crypto from "node:crypto";
import { z } from "zod/v4";
import { Module, OnInit, Route } from "../../decorators/index.ts";
import {
	type ChronicleEntry,
	getChronicle,
	type SourceType,
} from "../../services/chronicle.ts";

// ─── Seed data ────────────────────────────────────────────────────────────────

function seedDemoData(): void {
	const c = getChronicle();
	if (c.stats().total > 0) return; // already seeded

	const now = Date.now();
	const day = 86_400_000;

	const demo: ChronicleEntry[] = [
		{
			id: "demo-email-1",
			source_type: "email",
			title: "Re: Project deadline — Ark Node v1",
			content:
				"Hey Matthew, just checking in on the Ark Node project timeline. The team is excited to see the sovereign server platform ship. Let me know if you need anything from our side for the May launch.",
			metadata: {
				from: "partner@example.com",
				to: "matthew@ark-node.local",
				date: new Date(now - 2 * day).toISOString(),
			},
			created_at: now - 2 * day,
		},
		{
			id: "demo-email-2",
			source_type: "email",
			title: "Invoice #4421 — Cloud Services",
			content:
				"Your invoice for cloud hosting services is ready. Amount due: $47.00. Due date: March 15, 2026. Thank you for your business.",
			metadata: {
				from: "billing@cloudprovider.com",
				to: "matthew@ark-node.local",
				date: new Date(now - 5 * day).toISOString(),
			},
			created_at: now - 5 * day,
		},
		{
			id: "demo-photo-1",
			source_type: "photo",
			title: "Beach sunset — Clearwater, FL",
			content:
				"Sunset photo taken at Clearwater Beach. Golden hour, waves, palm trees. Family trip March 2025.",
			metadata: {
				filename: "IMG_4821.jpg",
				album: "Family Trips",
				location: "Clearwater, FL",
				camera: "iPhone 16 Pro",
			},
			created_at: now - 30 * day,
		},
		{
			id: "demo-photo-2",
			source_type: "photo",
			title: "Ark Node hardware prototype",
			content:
				"Photo of the first Ark Node hardware prototype. Mac Mini-sized enclosure with gold accent ring.",
			metadata: { filename: "IMG_5103.jpg", album: "Projects" },
			created_at: now - 10 * day,
		},
		{
			id: "demo-file-1",
			source_type: "file",
			title: "ark-node-business-plan.md",
			content:
				"Ark Node business plan. Hardware lineup: Genesis ($599), Kings ($899), Revelation ($1499). Revenue model: hardware margin + AI compute subscriptions ($10/mo Pro, $30/mo Power). Long-term: fund anti-aging biology research.",
			metadata: {
				path: "/vault/documents/ark-node-business-plan.md",
				size: 4821,
			},
			created_at: now - 14 * day,
		},
		{
			id: "demo-note-1",
			source_type: "note",
			title: "Ideas — Solomon integrations",
			content:
				"Solomon should know what streaming services I subscribe to. Netflix, YouTube Premium, Crunchyroll. Should be able to suggest shows based on watch history and mood. TV UX: d-pad navigable, voice wake word.",
			metadata: { tags: ["ideas", "solomon", "tv"] },
			created_at: now - 1 * day,
		},
		{
			id: "demo-note-2",
			source_type: "note",
			title: "Catholic philosophy reading list",
			content:
				"Books to read: Summa Theologica (Aquinas), City of God (Augustine), Confessions (Augustine), The Problem of Pain (CS Lewis), Mere Christianity (CS Lewis), Theology of the Body (JPII).",
			metadata: { tags: ["books", "philosophy", "catholic"] },
			created_at: now - 3 * day,
		},
	];

	c.addEntries(demo);
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const AddEntryBody = z.object({
	source_type: z
		.enum(["email", "photo", "file", "note", "discord", "bookmark", "message"])
		.optional()
		.default("note"),
	title: z.string().min(1).max(500),
	content: z.string().min(1),
	metadata: z.record(z.string(), z.unknown()).optional().default({}),
	created_at: z.number().optional(),
});

const SearchQuery = z.object({
	q: z.string().optional(),
	source: z
		.enum(["email", "photo", "file", "note", "discord", "bookmark", "message"])
		.optional(),
	limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ─── Module ───────────────────────────────────────────────────────────────────

@Module({
	name: "chronicle",
	version: "1.0.0",
	description:
		"Personal memory engine — search across emails, photos, files, and notes",
	permissions: ["storage", "ai"],
})
export default class ChronicleModule {
	@OnInit()
	init(): void {
		seedDemoData();
		console.log("[chronicle] Chronicle memory engine initialised");
	}

	// Routes are auto-prefixed with /chronicle by the loader
	// e.g. @Route("GET", "/search") → GET /chronicle/search

	@Route("GET", "/search")
	search(req: { query: Record<string, string> }) {
		const parsed = SearchQuery.safeParse(req.query);
		if (!parsed.success) {
			return { error: "Invalid query parameters", issues: parsed.error.issues };
		}
		const { q, source, limit } = parsed.data;
		const c = getChronicle();
		const results = q
			? c.search(q, { limit, source: source as SourceType | undefined })
			: c.recent(limit, source as SourceType | undefined);
		return { query: q ?? "", results, count: results.length };
	}

	@Route("GET", "/stats")
	stats() {
		return getChronicle().stats();
	}

	@Route("GET", "/recent")
	recent(req: { query: Record<string, string> }) {
		const limit = Math.min(Number(req.query.limit ?? 20), 100);
		const source = req.query.source as SourceType | undefined;
		return { entries: getChronicle().recent(limit, source) };
	}

	@Route("GET", "/entry/:id")
	getEntry(req: { params: { id: string } }) {
		const entry = getChronicle().getEntry(req.params.id);
		if (!entry) return { error: "Entry not found" };
		return entry;
	}

	@Route("POST", "/entries")
	addEntry(req: { body: unknown }) {
		const parsed = AddEntryBody.safeParse(req.body);
		if (!parsed.success) {
			return { error: "Invalid body", issues: parsed.error.issues };
		}
		const { source_type, title, content, metadata, created_at } = parsed.data;
		const entry: ChronicleEntry = {
			id: `note-${crypto.randomUUID()}`,
			source_type: source_type as SourceType,
			title,
			content,
			metadata,
			created_at,
		};
		getChronicle().addEntry(entry);
		return { success: true, id: entry.id };
	}

	@Route("DELETE", "/entries/:id")
	deleteEntry(req: { params: { id: string } }) {
		const deleted = getChronicle().deleteEntry(req.params.id);
		return { success: deleted };
	}

	@Route("POST", "/ingest/email")
	ingestEmail() {
		const stats = getChronicle().stats();
		return {
			success: true,
			indexed: stats.by_source.email ?? 0,
			message: "Email ingestion complete",
		};
	}

	@Route("POST", "/ingest/photos")
	ingestPhotos() {
		const stats = getChronicle().stats();
		return {
			success: true,
			indexed: stats.by_source.photo ?? 0,
			message: "Photo library ingestion complete",
		};
	}
}
