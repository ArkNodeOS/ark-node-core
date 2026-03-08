/**
 * The Chronicle — Ark Node's personal memory engine.
 *
 * Indexes emails, photos, files, notes, and any connected source into a
 * local SQLite database with FTS5 full-text search.  Optionally generates
 * vector embeddings via Ollama for semantic search.
 *
 * Named after the biblical Books of Chronicles — a record of all things.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SourceType =
	| "email"
	| "photo"
	| "file"
	| "note"
	| "discord"
	| "bookmark"
	| "message";

export interface ChronicleEntry {
	id: string;
	source_type: SourceType;
	source_id?: string;
	title: string;
	content: string;
	metadata: Record<string, unknown>;
	created_at?: number; // unix ms (original creation time)
}

export interface SearchResult extends ChronicleEntry {
	score: number;
	snippet: string;
	indexed_at: number;
}

export interface ChronicleStats {
	total: number;
	by_source: Record<string, number>;
	last_indexed?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class ChronicleService {
	private db: Database;

	constructor(dbPath: string) {
		mkdirSync(dirname(dbPath), { recursive: true });
		this.db = new Database(dbPath, { create: true });
		this.db.exec("PRAGMA journal_mode=WAL");
		this.db.exec("PRAGMA synchronous=NORMAL");
		this.init();
	}

	private init(): void {
		// Main entries table
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS chronicle_entries (
        id          TEXT    PRIMARY KEY,
        source_type TEXT    NOT NULL,
        source_id   TEXT,
        title       TEXT    NOT NULL DEFAULT '',
        content     TEXT    NOT NULL DEFAULT '',
        metadata    TEXT    NOT NULL DEFAULT '{}',
        embedding   TEXT,
        indexed_at  INTEGER NOT NULL,
        created_at  INTEGER
      );

      -- FTS5 full-text index (porter stemmer for English)
      CREATE VIRTUAL TABLE IF NOT EXISTS chronicle_fts
        USING fts5(
          id        UNINDEXED,
          title,
          content,
          source_type UNINDEXED,
          content='chronicle_entries',
          content_rowid='rowid',
          tokenize='porter ascii'
        );

      -- Keep FTS in sync automatically
      CREATE TRIGGER IF NOT EXISTS chronicle_ai
        AFTER INSERT ON chronicle_entries BEGIN
          INSERT INTO chronicle_fts(rowid, id, title, content, source_type)
            VALUES (new.rowid, new.id, new.title, new.content, new.source_type);
        END;

      CREATE TRIGGER IF NOT EXISTS chronicle_ad
        AFTER DELETE ON chronicle_entries BEGIN
          INSERT INTO chronicle_fts(chronicle_fts, rowid, id, title, content, source_type)
            VALUES ('delete', old.rowid, old.id, old.title, old.content, old.source_type);
        END;

      CREATE TRIGGER IF NOT EXISTS chronicle_au
        AFTER UPDATE ON chronicle_entries BEGIN
          INSERT INTO chronicle_fts(chronicle_fts, rowid, id, title, content, source_type)
            VALUES ('delete', old.rowid, old.id, old.title, old.content, old.source_type);
          INSERT INTO chronicle_fts(rowid, id, title, content, source_type)
            VALUES (new.rowid, new.id, new.title, new.content, new.source_type);
        END;

      CREATE INDEX IF NOT EXISTS idx_chronicle_source
        ON chronicle_entries(source_type, indexed_at DESC);

      CREATE INDEX IF NOT EXISTS idx_chronicle_created
        ON chronicle_entries(created_at DESC);
    `);
	}

	// ── Write ──────────────────────────────────────────────────────────────────

	addEntry(entry: ChronicleEntry): void {
		this.db
			.prepare(
				`INSERT OR REPLACE INTO chronicle_entries
         (id, source_type, source_id, title, content, metadata, indexed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				entry.id,
				entry.source_type,
				entry.source_id ?? null,
				entry.title,
				entry.content,
				JSON.stringify(entry.metadata),
				Date.now(),
				entry.created_at ?? null,
			);
	}

	addEntries(entries: ChronicleEntry[]): number {
		const stmt = this.db.prepare(
			`INSERT OR REPLACE INTO chronicle_entries
       (id, source_type, source_id, title, content, metadata, indexed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		);
		const ingest = this.db.transaction((rows: ChronicleEntry[]) => {
			for (const e of rows) {
				stmt.run(
					e.id,
					e.source_type,
					e.source_id ?? null,
					e.title,
					e.content,
					JSON.stringify(e.metadata),
					Date.now(),
					e.created_at ?? null,
				);
			}
			return rows.length;
		});
		return ingest(entries) as number;
	}

	deleteEntry(id: string): boolean {
		const res = this.db
			.prepare("DELETE FROM chronicle_entries WHERE id = ?")
			.run(id);
		return res.changes > 0;
	}

	deleteBySource(sourceType: SourceType): number {
		const res = this.db
			.prepare("DELETE FROM chronicle_entries WHERE source_type = ?")
			.run(sourceType);
		return res.changes;
	}

	// ── Search ─────────────────────────────────────────────────────────────────

	search(
		query: string,
		opts: { limit?: number; source?: SourceType } = {},
	): SearchResult[] {
		const { limit = 20, source } = opts;
		if (!query.trim()) return this.recent(limit);

		// FTS5 match query — prefix search on each word
		const ftsQuery = query
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map((w) => `${w.replace(/[^a-zA-Z0-9]/g, "")}*`)
			.join(" ");

		if (!ftsQuery) return [];

		const params: (string | number)[] = [ftsQuery];
		let sql = `
      SELECT e.*, fts.rank
        FROM chronicle_fts fts
        JOIN chronicle_entries e ON e.id = fts.id
       WHERE chronicle_fts MATCH ?
    `;
		if (source) {
			sql += " AND e.source_type = ?";
			params.push(source);
		}
		sql += " ORDER BY fts.rank LIMIT ?";
		params.push(limit);

		try {
			const rows = this.db.prepare(sql).all(...params) as Array<
				Record<string, unknown>
			>;
			return rows.map((row) => this.rowToResult(row, query));
		} catch {
			// FTS5 syntax error — fall back to LIKE search
			return this.fallbackSearch(query, limit, source);
		}
	}

	private fallbackSearch(
		query: string,
		limit: number,
		source?: SourceType,
	): SearchResult[] {
		const pattern = `%${query}%`;
		const params: (string | number)[] = [pattern, pattern];
		let sql =
			"SELECT * FROM chronicle_entries WHERE (title LIKE ? OR content LIKE ?)";
		if (source) {
			sql += " AND source_type = ?";
			params.push(source);
		}
		sql += " ORDER BY indexed_at DESC LIMIT ?";
		params.push(limit);

		const rows = this.db.prepare(sql).all(...params) as Array<
			Record<string, unknown>
		>;
		return rows.map((row) => ({
			...this.rowToEntry(row),
			score: 0.5,
			snippet: this.makeSnippet(String(row.content ?? ""), query),
			indexed_at: Number(row.indexed_at ?? 0),
		}));
	}

	recent(limit = 20, source?: SourceType): SearchResult[] {
		const params: (string | number)[] = [];
		let sql = "SELECT * FROM chronicle_entries";
		if (source) {
			sql += " WHERE source_type = ?";
			params.push(source);
		}
		sql += " ORDER BY indexed_at DESC LIMIT ?";
		params.push(limit);

		const rows = this.db.prepare(sql).all(...params) as Array<
			Record<string, unknown>
		>;
		return rows.map((row) => ({
			...this.rowToEntry(row),
			score: 1,
			snippet: String(row.content ?? "").slice(0, 200),
			indexed_at: Number(row.indexed_at ?? 0),
		}));
	}

	// ── Stats ──────────────────────────────────────────────────────────────────

	stats(): ChronicleStats {
		const total = (
			this.db.prepare("SELECT COUNT(*) as n FROM chronicle_entries").get() as {
				n: number;
			}
		).n;

		const sourceRows = this.db
			.prepare(
				"SELECT source_type, COUNT(*) as n FROM chronicle_entries GROUP BY source_type",
			)
			.all() as Array<{ source_type: string; n: number }>;

		const lastRow = this.db
			.prepare("SELECT MAX(indexed_at) as t FROM chronicle_entries")
			.get() as { t: number | null };

		return {
			total,
			by_source: Object.fromEntries(
				sourceRows.map((r) => [r.source_type, r.n]),
			),
			last_indexed: lastRow.t ?? undefined,
		};
	}

	getEntry(id: string): ChronicleEntry | null {
		const row = this.db
			.prepare("SELECT * FROM chronicle_entries WHERE id = ?")
			.get(id) as Record<string, unknown> | null;
		return row ? this.rowToEntry(row) : null;
	}

	// ── Helpers ────────────────────────────────────────────────────────────────

	private rowToEntry(row: Record<string, unknown>): ChronicleEntry {
		return {
			id: String(row.id ?? ""),
			source_type: String(row.source_type ?? "note") as SourceType,
			source_id: row.source_id ? String(row.source_id) : undefined,
			title: String(row.title ?? ""),
			content: String(row.content ?? ""),
			metadata: JSON.parse(String(row.metadata ?? "{}")),
			created_at: row.created_at ? Number(row.created_at) : undefined,
		};
	}

	private rowToResult(
		row: Record<string, unknown>,
		query: string,
	): SearchResult {
		return {
			...this.rowToEntry(row),
			score: -Number(row.rank ?? 0), // FTS5 rank is negative
			snippet: this.makeSnippet(String(row.content ?? ""), query),
			indexed_at: Number(row.indexed_at ?? 0),
		};
	}

	private makeSnippet(content: string, query: string): string {
		const words = query.toLowerCase().split(/\s+/);
		const lower = content.toLowerCase();
		let best = 0;
		for (const word of words) {
			const idx = lower.indexOf(word);
			if (idx !== -1) {
				best = Math.max(0, idx - 60);
				break;
			}
		}
		const end = Math.min(content.length, best + 200);
		let snip = content.slice(best, end).trim();
		if (best > 0) snip = `…${snip}`;
		if (end < content.length) snip += "…";
		return snip;
	}
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: ChronicleService | null = null;

export function getChronicle(): ChronicleService {
	if (!_instance) {
		const dbPath = resolve(import.meta.dirname, "../../storage/chronicle.db");
		_instance = new ChronicleService(dbPath);
	}
	return _instance;
}
