/**
 * Solomon — the intelligence layer.
 * Routes natural language commands to the correct module APIs.
 * Named after the biblical king renowned for wisdom.
 */
import type { FastifyInstance } from "fastify";
import { queryAI } from "./ai.ts";

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
}

interface ActionSpec {
	method: "GET" | "POST" | "PUT" | "DELETE";
	path: string;
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
`;

const SYSTEM_PROMPT = `You are Solomon, the AI assistant for Ark Node — a personal sovereign server.
You interpret user commands and map them to module actions.

${MODULE_CAPABILITIES}

When given a user command, respond with ONLY a JSON object in this exact format:
{
  "module": "<module name or null if general conversation>",
  "action": "<action name or null>",
  "params": {},
  "reply": "<friendly response to user>",
  "confidence": "high|medium|low"
}

Be decisive. Map commands accurately. Keep replies concise and direct.`;

export async function interpretCommand(
	userMessage: string,
	availableModules: string[],
	app: FastifyInstance,
): Promise<SolomonResponse> {
	const context = `Available modules on this system: ${availableModules.join(", ")}`;

	let parsed: SolomonCommand & { reply?: string };
	let aiReply = "";

	try {
		const raw = await queryAI(
			`User command: "${userMessage}"`,
			undefined,
			`${SYSTEM_PROMPT}\n\n${context}`,
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
				const injected = await app.inject({
					method: spec.method,
					url: spec.path,
					...(spec.body
						? {
								payload: spec.body(command.params),
								headers: { "content-type": "application/json" },
							}
						: {}),
				});
				return {
					interpretation: command,
					reply: aiReply,
					executed: true,
					result: injected.json() as unknown,
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
