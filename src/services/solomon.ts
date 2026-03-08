/**
 * Solomon — the intelligence layer.
 * Routes natural language commands to the correct module APIs.
 * Named after the biblical king renowned for wisdom.
 */
import type { FastifyInstance } from "fastify";
import { queryAI, queryAIStructured } from "./ai.ts";
import { type ChronicleEntry, getChronicle } from "./chronicle.ts";

export interface SolomonCommand {
	module: string | null;
	action: string | null;
	params: Record<string, unknown>;
	raw: string;
	confidence: "high" | "medium" | "low";
}

export interface SolomonResponse {
	interpretation: SolomonCommand;
	reply: string;
	executed: boolean;
	result?: unknown;
	memories?: ChronicleEntry[];
}

interface ActionSpec {
	method: "GET" | "POST" | "PUT" | "DELETE";
	path: string | ((params: Record<string, unknown>) => string);
	body?: (params: Record<string, unknown>) => unknown;
}

const ACTION_REGISTRY: Record<string, Record<string, ActionSpec>> = {
	minecraft: {
		start: { method: "POST", path: "/minecraft/start", body: (p) => p },
		stop: { method: "POST", path: "/minecraft/stop" },
		status: { method: "GET", path: "/minecraft/status" },
		logs: { method: "GET", path: "/minecraft/logs" },
		destroy: { method: "DELETE", path: "/minecraft/destroy" },
	},
	email: {
		inbox: { method: "GET", path: "/email/inbox" },
		list_accounts: { method: "GET", path: "/email/accounts" },
		add_account: { method: "POST", path: "/email/accounts", body: (p) => p },
	},
	adblock: {
		start: { method: "POST", path: "/adblock/start", body: (p) => p },
		stop: { method: "POST", path: "/adblock/stop" },
		status: { method: "GET", path: "/adblock/status" },
		whitelist: { method: "POST", path: "/adblock/whitelist", body: (p) => p },
		blacklist: { method: "POST", path: "/adblock/blacklist", body: (p) => p },
		update_lists: { method: "POST", path: "/adblock/update-lists" },
		blocklist: { method: "GET", path: "/adblock/blocklist" },
	},
	vpn: {
		start: { method: "POST", path: "/vpn/start", body: (p) => p },
		stop: { method: "POST", path: "/vpn/stop" },
		status: { method: "GET", path: "/vpn/status" },
		list_peers: { method: "GET", path: "/vpn/peers" },
		add_peer: { method: "POST", path: "/vpn/peers", body: (p) => p },
	},
	backup: {
		list_jobs: { method: "GET", path: "/backup/jobs" },
		add_job: { method: "POST", path: "/backup/jobs", body: (p) => p },
		status: { method: "GET", path: "/backup/status" },
	},
	router: {
		network: { method: "GET", path: "/router/network" },
		devices: { method: "GET", path: "/router/devices" },
		dns: { method: "GET", path: "/router/dns" },
		firewall: { method: "GET", path: "/router/firewall" },
	},
	photos: {
		library: { method: "GET", path: "/photos/library" },
		albums: { method: "GET", path: "/photos/albums" },
		stats: { method: "GET", path: "/photos/stats" },
	},
	system: {
		status: { method: "GET", path: "/status" },
		health: { method: "GET", path: "/health" },
		apps: { method: "GET", path: "/apps" },
	},
	chronicle: {
		search: {
			method: "GET",
			path: (p) =>
				`/chronicle/search?q=${encodeURIComponent(String(p.q ?? p.query ?? ""))}`,
		},
		stats: { method: "GET", path: "/chronicle/stats" },
		add_note: {
			method: "POST",
			path: "/chronicle/entries",
			body: (p) => ({
				source_type: "note",
				title: p.title ?? "Note",
				content: p.content ?? "",
			}),
		},
		recent: { method: "GET", path: "/chronicle/recent" },
	},
};

// Known module capabilities for grounding the AI
const MODULE_CAPABILITIES = `
Available Ark Node modules and their actions:

minecraft:
- start: Start/deploy the Minecraft server (params: version, memory, gamemode, difficulty)
- stop: Stop the Minecraft server
- status: Get server status
- logs: Get server logs
- destroy: Destroy the Minecraft server

email:
- list_accounts: List configured email accounts
- add_account: Add email account (params: label, username, password, provider)
- inbox: Get unified inbox across all accounts

adblock:
- start: Start Pi-hole ad blocker (params: password, timezone)
- stop: Stop Pi-hole
- status: Get ad blocker status and stats
- whitelist: Whitelist a domain (params: domain)
- blacklist: Blacklist a domain (params: domain)
- update_lists: Update blocklists
- blocklist: Get current blocklist

vpn:
- start: Start VPN (params: peer config)
- stop: Stop VPN
- status: Get VPN status
- list_peers: List VPN peers
- add_peer: Add VPN peer (params: peer details)

backup:
- list_jobs: List backup jobs
- add_job: Add backup job (params: job details)
- status: Get backup status

router:
- network: Get network info
- devices: List connected devices
- dns: Get DNS config
- firewall: Get firewall rules

photos:
- library: Get photo library
- albums: List albums
- stats: Get photo stats

system:
- status: Get CPU, memory, uptime
- apps: List installed modules
- health: Health check

chronicle:
- search: Search memories, notes, emails, files (params: q — search query)
- stats: Get memory statistics
- add_note: Save a new memory/note (params: title, content)
- recent: Get recent entries
`;

const SYSTEM_PROMPT = `You are Solomon, the command router for Ark Node — a personal sovereign server.
Your ONLY job is to classify user commands into JSON. You do NOT answer questions or give advice.
You MUST always return a valid JSON object, nothing else.

${MODULE_CAPABILITIES}

RESPONSE FORMAT — always return exactly this JSON shape:
{"module":"<name or null>","action":"<name or null>","params":{},"reply":"<one sentence>","confidence":"high|medium|low"}

EXAMPLES:
User: "check minecraft status" -> {"module":"minecraft","action":"status","params":{},"reply":"Checking Minecraft server status.","confidence":"high"}
User: "start the VPN" -> {"module":"vpn","action":"start","params":{},"reply":"Starting VPN.","confidence":"high"}
User: "show me connected devices" -> {"module":"router","action":"devices","params":{},"reply":"Fetching connected devices.","confidence":"high"}
User: "is adblock running" -> {"module":"adblock","action":"status","params":{},"reply":"Checking ad blocker status.","confidence":"high"}
User: "what photos do I have" -> {"module":"photos","action":"library","params":{},"reply":"Loading your photo library.","confidence":"high"}
User: "find my notes about anti-aging" -> {"module":"chronicle","action":"search","params":{"q":"anti-aging"},"reply":"Searching your Chronicle for anti-aging notes.","confidence":"high"}
User: "search chronicle for beach photos" -> {"module":"chronicle","action":"search","params":{"q":"beach photos"},"reply":"Searching your memories for beach photos.","confidence":"high"}
User: "remember this: buy more coffee" -> {"module":"chronicle","action":"add_note","params":{"title":"Reminder","content":"buy more coffee"},"reply":"Saving that to your Chronicle.","confidence":"high"}
User: "hello" -> {"module":null,"action":null,"params":{},"reply":"Hello! Ask me to control your Ark Node.","confidence":"low"}

Rules:
- NEVER explain, advise, or answer generally — only classify and route
- If the command matches a module action, use confidence "high"
- If unsure, use "medium" or "low" with null module/action
- params only needed for actions that take inputs (e.g. start minecraft with version "1.20.4")`;

// ─── Memory Intent Detection ──────────────────────────────────────────────────

// Patterns that indicate the user wants to search/recall memories
const MEMORY_PATTERNS = [
	/\b(find|search|look up|lookup|locate)\b/i,
	/\bshow me\b/i,
	/\bdo i have\b/i,
	/\bwhat did i\b/i,
	/\b(remember|recall|remind me)\b/i,
	/\bnotes? about\b/i,
	/\bemails? (about|from|re:)\b/i,
	/\bphotos? (of|from)\b/i,
	/\bfiles? (about|called|named)\b/i,
	/\b(chronicle|my memory|my memories|my notes)\b/i,
];

export function detectMemoryIntent(message: string): boolean {
	return MEMORY_PATTERNS.some((p) => p.test(message));
}

function formatEntriesForContext(entries: ChronicleEntry[]): string {
	if (entries.length === 0) return "No matching entries found.";
	return entries
		.map((e, i) => {
			const snippet = ((e as { snippet?: string }).snippet ?? e.content).slice(
				0,
				200,
			);
			const date = e.created_at
				? new Date(e.created_at).toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
						year: "numeric",
					})
				: "unknown date";
			return `[${i + 1}] ${e.source_type.toUpperCase()} — "${e.title}" (${date})\n    ${snippet}`;
		})
		.join("\n\n");
}

const MEMORY_SYSTEM_PROMPT = `You are Solomon, the intelligence of Ark Node — a personal sovereign server. The user has asked you to recall or find information from their personal Chronicle (their indexed emails, photos, files, and notes).

Answer conversationally and concisely. Reference specific entries by title when relevant. If no entries were found, say so clearly. Keep your reply under 80 words.`;

// ─── Main interpreter ─────────────────────────────────────────────────────────

export async function interpretCommand(
	userMessage: string,
	availableModules: string[],
	app: FastifyInstance,
): Promise<SolomonResponse> {
	// Memory/search intent — query Chronicle first, then respond with context
	if (detectMemoryIntent(userMessage)) {
		const entries = getChronicle().search(userMessage, { limit: 5 });
		const context = formatEntriesForContext(entries);
		const prompt = `Chronicle search results for "${userMessage}":\n\n${context}\n\nUser asked: "${userMessage}"`;

		let memReply: string;
		try {
			memReply = await queryAI(prompt, MEMORY_SYSTEM_PROMPT);
		} catch {
			memReply =
				entries.length > 0
					? `Found ${entries.length} matching ${entries.length === 1 ? "entry" : "entries"} in your Chronicle.`
					: "No matching entries found in your Chronicle.";
		}

		return {
			interpretation: {
				module: "chronicle",
				action: "search",
				params: { q: userMessage },
				raw: userMessage,
				confidence: "high",
			},
			reply: memReply,
			executed: true,
			memories: entries,
		};
	}

	const context = `Available modules on this system: ${availableModules.join(", ")}`;

	let parsed: SolomonCommand & { reply?: string };
	let aiReply = "";

	try {
		const raw = await queryAIStructured(
			`${SYSTEM_PROMPT}\n\n${context}`,
			`User command: "${userMessage}"`,
		);

		// Extract JSON from response (AI may wrap it in markdown)
		const jsonMatch = raw.match(/\{[\s\S]*\}/);
		if (!jsonMatch) throw new Error("No JSON in response");

		const json = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
		aiReply = (json.reply as string) ?? "Understood.";

		parsed = {
			module: (json.module as string | null) ?? null,
			action: (json.action as string | null) ?? null,
			params: (json.params as Record<string, unknown>) ?? {},
			raw: userMessage,
			confidence: (json.confidence as "high" | "medium" | "low") ?? "medium",
		};
	} catch {
		// Fallback: return as general conversation
		parsed = {
			module: null,
			action: null,
			params: {},
			raw: userMessage,
			confidence: "low",
		};
		aiReply = await queryAI(userMessage).catch(
			() => "I'm having trouble reaching the AI right now. Please try again.",
		);
	}

	return executeAction(parsed, aiReply, app);
}

/**
 * Execute a parsed SolomonCommand against the live Fastify app.
 * Exported separately so tests can call this without mocking the AI layer.
 */
export async function executeAction(
	command: SolomonCommand,
	aiReply: string,
	app: FastifyInstance,
): Promise<SolomonResponse> {
	if (command.module && command.action && command.confidence !== "low") {
		const spec = ACTION_REGISTRY[command.module]?.[command.action];
		if (spec) {
			try {
				const resolvedPath =
					typeof spec.path === "function"
						? spec.path(command.params)
						: spec.path;
				const injectOpts = spec.body
					? {
							method: spec.method,
							url: resolvedPath,
							payload: spec.body(command.params) as Record<string, unknown>,
							headers: { "content-type": "application/json" } as Record<
								string,
								string
							>,
						}
					: { method: spec.method, url: resolvedPath };
				const injected = await app.inject(injectOpts);
				return {
					interpretation: command,
					reply: aiReply,
					executed: true,
					result: JSON.parse(injected.body) as unknown,
				};
			} catch (execErr) {
				return {
					interpretation: command,
					reply: aiReply,
					executed: false,
					result: { error: String(execErr) },
				};
			}
		}
	}

	return { interpretation: command, reply: aiReply, executed: false };
}
