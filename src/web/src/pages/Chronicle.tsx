import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icons.tsx";
import { useApi } from "../hooks/useApi.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceType =
	| "email"
	| "photo"
	| "file"
	| "note"
	| "discord"
	| "bookmark"
	| "message";

interface ChronicleEntry {
	id: string;
	source_type: SourceType;
	title: string;
	content: string;
	snippet?: string;
	metadata: Record<string, unknown>;
	created_at?: number;
	indexed_at: number;
	score?: number;
}

interface SearchResponse {
	query: string;
	results: ChronicleEntry[];
	count: number;
}

interface Stats {
	total: number;
	by_source: Record<string, number>;
	last_indexed?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_META: Record<
	SourceType,
	{
		label: string;
		icon: "envelope" | "camera" | "diamond" | "eye" | "globe" | "circle-dot";
		color: string;
	}
> = {
	email: {
		label: "Email",
		icon: "envelope",
		color: "text-[#C9A84C] bg-[#C9A84C]/10 border-[#C9A84C]/20",
	},
	photo: {
		label: "Photo",
		icon: "camera",
		color: "text-[#8B6FD4] bg-[#8B6FD4]/10 border-[#8B6FD4]/20",
	},
	file: {
		label: "File",
		icon: "diamond",
		color: "text-[#4FA3A3] bg-[#4FA3A3]/10 border-[#4FA3A3]/20",
	},
	note: {
		label: "Note",
		icon: "eye",
		color: "text-[#C9A84C] bg-[#C9A84C]/10 border-[#C9A84C]/20",
	},
	discord: {
		label: "Discord",
		icon: "globe",
		color: "text-[#5865F2] bg-[#5865F2]/10 border-[#5865F2]/20",
	},
	bookmark: {
		label: "Bookmark",
		icon: "globe",
		color: "text-[#4FA3A3] bg-[#4FA3A3]/10 border-[#4FA3A3]/20",
	},
	message: {
		label: "Message",
		icon: "circle-dot",
		color: "text-[#3DBE7A] bg-[#3DBE7A]/10 border-[#3DBE7A]/20",
	},
};

function fmtDate(ms?: number): string {
	if (!ms) return "";
	const d = new Date(ms);
	const now = Date.now();
	const diff = now - ms;
	if (diff < 60_000) return "just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

// ─── Components ───────────────────────────────────────────────────────────────

function SourceBadge({ type }: { type: SourceType }) {
	const meta = SOURCE_META[type] ?? SOURCE_META.note;
	return (
		<span
			className={`inline-flex items-center gap-1 text-[10px] tracking-widest uppercase font-sans px-2 py-0.5 rounded-full border ${meta.color}`}
		>
			<Icon name={meta.icon} className="w-3 h-3" />
			{meta.label}
		</span>
	);
}

function ResultCard({
	entry,
	onDelete,
}: {
	entry: ChronicleEntry;
	onDelete: (id: string) => void;
}) {
	const [confirming, setConfirming] = useState(false);

	const handleDelete = async () => {
		if (!confirming) {
			setConfirming(true);
			return;
		}
		await fetch(`/chronicle/entries/${entry.id}`, { method: "DELETE" });
		onDelete(entry.id);
	};

	return (
		<div className="ark-card p-4 md:p-5 group hover:border-[#C9A84C]/30 transition-all duration-200">
			<div className="flex items-start justify-between gap-3 mb-2">
				<div className="flex items-center gap-2 flex-wrap min-w-0">
					<SourceBadge type={entry.source_type} />
					<span className="text-[10px] text-[#6A5A3A] font-sans">
						{fmtDate(entry.created_at ?? entry.indexed_at)}
					</span>
				</div>
				<button
					type="button"
					onClick={handleDelete}
					onBlur={() => setConfirming(false)}
					className={`text-[10px] font-sans tracking-wider uppercase shrink-0 transition-colors ${
						confirming
							? "text-[#8B1A1A]"
							: "text-[#3A2A10] hover:text-[#6A5A3A] opacity-0 group-hover:opacity-100"
					}`}
				>
					{confirming ? "confirm?" : "remove"}
				</button>
			</div>

			<h3 className="font-serif text-base text-[#F5F0E0] mb-1.5 leading-snug">
				{entry.title}
			</h3>
			<p className="text-sm text-[#9A8A6A] font-sans leading-relaxed line-clamp-3">
				{entry.snippet ?? entry.content}
			</p>
		</div>
	);
}

function AddNoteModal({
	onClose,
	onAdd,
}: {
	onClose: () => void;
	onAdd: () => void;
}) {
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [saving, setSaving] = useState(false);

	const save = async () => {
		if (!title.trim() || !content.trim()) return;
		setSaving(true);
		await fetch("/chronicle/entries", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				title: title.trim(),
				content: content.trim(),
				source_type: "note",
			}),
		});
		setSaving(false);
		onAdd();
		onClose();
	};

	return (
		<div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
			<div className="bg-[#130D06] border border-[#3A2A10] rounded-2xl w-full max-w-lg p-6">
				<div className="flex items-center justify-between mb-5">
					<h2 className="font-serif text-lg text-[#C9A84C] tracking-widest">
						NEW MEMORIA
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-[#6A5A3A] hover:text-[#9A8A6A]"
					>
						✕
					</button>
				</div>
				<input
					type="text"
					placeholder="Title…"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className="w-full bg-[#1A1108] border border-[#3A2A10] rounded-xl px-4 py-3 text-sm text-[#F5F0E0] placeholder-[#6A5A3A] focus:outline-none focus:border-[#C9A84C]/40 mb-3"
				/>
				<textarea
					placeholder="Write anything — thoughts, quotes, links, observations…"
					value={content}
					onChange={(e) => setContent(e.target.value)}
					rows={5}
					className="w-full bg-[#1A1108] border border-[#3A2A10] rounded-xl px-4 py-3 text-sm text-[#F5F0E0] placeholder-[#6A5A3A] resize-none focus:outline-none focus:border-[#C9A84C]/40 mb-4"
				/>
				<div className="flex gap-3">
					<button
						type="button"
						onClick={onClose}
						className="flex-1 py-2.5 rounded-xl border border-[#3A2A10] text-[#6A5A3A] text-sm hover:text-[#9A8A6A] transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={save}
						disabled={saving || !title.trim() || !content.trim()}
						className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-[#060402] text-sm font-sans tracking-wider uppercase disabled:opacity-40 transition-opacity"
					>
						{saving ? "Saving…" : "Save"}
					</button>
				</div>
			</div>
		</div>
	);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const FILTERS: Array<{ label: string; value: SourceType | "all" }> = [
	{ label: "All", value: "all" },
	{ label: "Notes", value: "note" },
	{ label: "Email", value: "email" },
	{ label: "Photos", value: "photo" },
	{ label: "Files", value: "file" },
];

export default function Chronicle() {
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [filter, setFilter] = useState<SourceType | "all">("all");
	const [results, setResults] = useState<ChronicleEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [addingNote, setAddingNote] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const { data: stats } = useApi<Stats>(`/chronicle/stats?_k=${refreshKey}`);

	// Debounce search input
	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => setDebouncedQuery(query), 350);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [query]);

	// Fetch results whenever query or filter changes
	useEffect(() => {
		let cancelled = false;
		setLoading(true);

		const params = new URLSearchParams();
		if (debouncedQuery) params.set("q", debouncedQuery);
		if (filter !== "all") params.set("source", filter);
		params.set("limit", "40");
		params.set("_k", String(refreshKey)); // cache-bust on add/delete

		const url = debouncedQuery
			? `/chronicle/search?${params}`
			: `/chronicle/recent?${params}`;

		fetch(url)
			.then((r) => r.json())
			.then((data: SearchResponse | { entries: ChronicleEntry[] }) => {
				if (cancelled) return;
				setResults(
					"results" in data
						? data.results
						: (data as { entries: ChronicleEntry[] }).entries,
				);
			})
			.catch(() => {
				if (!cancelled) setResults([]);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [debouncedQuery, filter, refreshKey]);

	const handleDelete = (id: string) => {
		setResults((prev) => prev.filter((r) => r.id !== id));
		setRefreshKey((k) => k + 1);
	};

	return (
		<div className="relative min-h-full px-4 py-4 md:px-8 md:py-8 max-w-4xl mx-auto">
			{/* Header */}
			<div className="mb-6 md:mb-8">
				<p className="text-[#C9A84C]/60 text-xs font-sans tracking-[0.3em] uppercase mb-1">
					Memoria · Chronicle
				</p>
				<h1 className="font-serif text-3xl md:text-5xl text-[#F5F0E0] font-light mb-3">
					The <span className="text-[#C9A84C]">Chronicle</span>
				</h1>
				<div className="h-px bg-gradient-to-r from-[#C9A84C]/40 to-transparent w-32 mb-3" />
				<p className="text-sm text-[#9A8A6A] font-sans">
					{stats
						? `${stats.total.toLocaleString()} memories indexed`
						: "Your sovereign memory engine"}
				</p>
			</div>

			{/* Search bar */}
			<div className="relative mb-4">
				<Icon
					name="eye"
					className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6A5A3A]"
				/>
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search memories — emails, photos, files, notes…"
					className="w-full bg-[#1A1108] border border-[#3A2A10] rounded-xl pl-11 pr-4 py-3.5 text-sm text-[#F5F0E0] placeholder-[#6A5A3A] focus:outline-none focus:border-[#C9A84C]/40 transition-colors"
				/>
				{query && (
					<button
						type="button"
						onClick={() => setQuery("")}
						className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6A5A3A] hover:text-[#9A8A6A] text-lg leading-none"
					>
						×
					</button>
				)}
			</div>

			{/* Filter tabs + add note */}
			<div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
				<div className="flex gap-1.5 flex-1">
					{FILTERS.map((f) => (
						<button
							key={f.value}
							type="button"
							onClick={() => setFilter(f.value)}
							className={`px-3 py-1.5 rounded-lg text-xs font-sans tracking-wider uppercase transition-colors whitespace-nowrap ${
								filter === f.value
									? "bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/25"
									: "text-[#6A5A3A] hover:text-[#9A8A6A] border border-transparent"
							}`}
						>
							{f.label}
							{stats?.by_source[f.value] !== undefined && f.value !== "all" && (
								<span className="ml-1.5 opacity-50">
									{stats.by_source[f.value]}
								</span>
							)}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => setAddingNote(true)}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C] text-[#060402] text-xs font-sans tracking-wider uppercase shrink-0"
				>
					<Icon name="cross" className="w-3.5 h-3.5" />
					Note
				</button>
			</div>

			{/* Results */}
			{loading ? (
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="ark-card p-5 animate-pulse">
							<div className="h-3 bg-[#3A2A10] rounded w-24 mb-3" />
							<div className="h-4 bg-[#3A2A10] rounded w-3/4 mb-2" />
							<div className="h-3 bg-[#3A2A10] rounded w-full mb-1" />
							<div className="h-3 bg-[#3A2A10] rounded w-5/6" />
						</div>
					))}
				</div>
			) : results.length === 0 ? (
				<div className="text-center py-16 text-[#6A5A3A]">
					<Icon name="eye" className="w-12 h-12 mx-auto mb-4 opacity-30" />
					<p className="font-serif text-xl text-[#9A8A6A] mb-2">
						{query ? "No memories found" : "Nothing indexed yet"}
					</p>
					<p className="text-sm font-sans">
						{query
							? "Try different keywords or clear the filter"
							: "Add a note or connect a data source"}
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{results.map((entry) => (
						<ResultCard key={entry.id} entry={entry} onDelete={handleDelete} />
					))}
					{results.length === 40 && (
						<p className="text-center text-xs text-[#6A5A3A] font-sans py-2">
							Showing top 40 results — refine your search
						</p>
					)}
				</div>
			)}

			{/* Add note modal */}
			{addingNote && (
				<AddNoteModal
					onClose={() => setAddingNote(false)}
					onAdd={() => setRefreshKey((k) => k + 1)}
				/>
			)}
		</div>
	);
}
