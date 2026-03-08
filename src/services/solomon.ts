/**
 * Solomon — the intelligence layer.
 * Routes natural language commands to the correct module APIs.
 * Named after the biblical king renowned for wisdom.
 */
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

// Known module capabilities for grounding the AI
const MODULE_CAPABILITIES = `
Available Ark Node modules and their actions:

minecraft:
- start: Start/deploy the Minecraft server (params: version, memory, gamemode, difficulty)
- stop: Stop the Minecraft server
- status: Get server status
- logs: Get server logs

email:
- list_accounts: List configured email accounts
- add_account: Add email account (params: label, username, password, provider)
- inbox: Get unified inbox across all accounts
- inbox_account: Get inbox for a specific account (params: id)

adblock:
- start: Start Pi-hole ad blocker (params: password, timezone)
- stop: Stop Pi-hole
- status: Get ad blocker status and stats
- whitelist: Whitelist a domain (params: domain)
- blacklist: Blacklist a domain (params: domain)
- update_lists: Update blocklists

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

	return {
		interpretation: parsed,
		reply: aiReply,
		executed: false,
	};
}
