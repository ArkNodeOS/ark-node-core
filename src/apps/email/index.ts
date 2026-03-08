/**
 * Email Aggregator Module
 * Connects to multiple IMAP accounts, indexes messages, and provides a unified inbox.
 * Stores account configs in module storage (never logs credentials).
 */
import { createHash } from "node:crypto";
import type { ArkAPI, ArkManifest } from "../../types/module.ts";

export const manifest: ArkManifest = {
	name: "email",
	version: "1.0.0",
	description:
		"Unified inbox — aggregate Gmail, Yahoo, Outlook and any IMAP account",
	icon: "✉️",
	permissions: ["network", "storage"],
};

interface EmailAccount {
	id: string;
	label: string;
	host: string;
	port: number;
	tls: boolean;
	username: string;
	// password stored separately, never returned in API responses
}

interface AccountWithPassword extends EmailAccount {
	password: string;
}

interface EmailMessage {
	uid: number;
	from: string;
	subject: string;
	date: string;
	seen: boolean;
	snippet: string;
}

// ---- Preset IMAP configs for common providers ----
const IMAP_PRESETS: Record<
	string,
	{ host: string; port: number; tls: boolean }
> = {
	gmail: { host: "imap.gmail.com", port: 993, tls: true },
	outlook: { host: "outlook.office365.com", port: 993, tls: true },
	yahoo: { host: "imap.mail.yahoo.com", port: 993, tls: true },
	hotmail: { host: "outlook.office365.com", port: 993, tls: true },
	icloud: { host: "imap.mail.me.com", port: 993, tls: true },
	aol: { host: "imap.aol.com", port: 993, tls: true },
	"163.com": { host: "imap.163.com", port: 993, tls: true },
	"126.com": { host: "imap.126.com", port: 993, tls: true },
};

let api_: ArkAPI;
const ACCOUNTS_FILE = "accounts.json";
const CREDS_FILE = "credentials.json";

async function loadAccounts(): Promise<EmailAccount[]> {
	try {
		const buf = await api_.storage.get(ACCOUNTS_FILE);
		return JSON.parse(buf.toString()) as EmailAccount[];
	} catch {
		return [];
	}
}

async function loadCreds(): Promise<Record<string, string>> {
	try {
		const buf = await api_.storage.get(CREDS_FILE);
		return JSON.parse(buf.toString()) as Record<string, string>;
	} catch {
		return {};
	}
}

async function saveAccounts(accounts: EmailAccount[]) {
	await api_.storage.save(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

async function saveCreds(creds: Record<string, string>) {
	await api_.storage.save(CREDS_FILE, JSON.stringify(creds, null, 2));
}

export const run = (api: ArkAPI) => {
	api_ = api;
	api.log("Email aggregator loaded");

	// GET /email/presets — list supported providers
	api.registerRoute("GET", "/presets", async () => ({
		presets: Object.keys(IMAP_PRESETS).map((k) => ({
			provider: k,
			...IMAP_PRESETS[k],
		})),
	}));

	// GET /email/accounts — list configured accounts (no passwords)
	api.registerRoute("GET", "/accounts", async () => ({
		accounts: await loadAccounts(),
	}));

	// POST /email/accounts — add account
	// body: { label, username, password, provider? } OR { label, host, port, tls, username, password }
	api.registerRoute("POST", "/accounts", async (req, reply) => {
		const body = req.body as {
			label: string;
			username: string;
			password: string;
			provider?: string;
			host?: string;
			port?: number;
			tls?: boolean;
		};

		if (!body.username || !body.password || !body.label) {
			reply.code(400);
			return { error: "label, username, and password are required" };
		}

		let host = body.host;
		let port = body.port ?? 993;
		let tls = body.tls ?? true;

		if (body.provider) {
			const preset = IMAP_PRESETS[body.provider.toLowerCase()];
			if (!preset) {
				reply.code(400);
				return {
					error: `Unknown provider. Use one of: ${Object.keys(IMAP_PRESETS).join(", ")}`,
				};
			}
			host = preset.host;
			port = preset.port;
			tls = preset.tls;
		}

		if (!host) {
			reply.code(400);
			return { error: "host is required when not using a provider preset" };
		}

		const id = createHash("sha256")
			.update(`${body.username}:${host}`)
			.digest("hex")
			.slice(0, 12);

		const accounts = await loadAccounts();
		if (accounts.find((a) => a.id === id)) {
			reply.code(409);
			return { error: "Account already exists" };
		}

		const account: EmailAccount = {
			id,
			label: body.label,
			host,
			port,
			tls,
			username: body.username,
		};
		accounts.push(account);
		await saveAccounts(accounts);

		const creds = await loadCreds();
		creds[id] = body.password;
		await saveCreds(creds);

		api.log(`Added account: ${body.label} (${body.username})`);
		return { ok: true, account };
	});

	// DELETE /email/accounts/:id
	api.registerRoute("DELETE", "/accounts/:id", async (req, reply) => {
		const { id } = req.params as { id: string };
		const accounts = await loadAccounts();
		const idx = accounts.findIndex((a) => a.id === id);
		if (idx === -1) {
			reply.code(404);
			return { error: "Account not found" };
		}
		accounts.splice(idx, 1);
		await saveAccounts(accounts);

		const creds = await loadCreds();
		delete creds[id];
		await saveCreds(creds);

		return { ok: true, message: "Account removed" };
	});

	// GET /email/inbox/:id?limit=50&unseen=false — fetch messages via IMAP
	api.registerRoute("GET", "/inbox/:id", async (req, reply) => {
		const { id } = req.params as { id: string };
		const query = req.query as { limit?: string; unseen?: string };
		const limit = Number(query.limit ?? 50);
		const unseenOnly = query.unseen === "true";

		const accounts = await loadAccounts();
		const account = accounts.find((a) => a.id === id);
		if (!account) {
			reply.code(404);
			return { error: "Account not found" };
		}

		const creds = await loadCreds();
		const password = creds[id];
		if (!password) {
			reply.code(500);
			return { error: "Credentials missing for this account" };
		}

		// Fetch via IMAP using built-in net/tls
		try {
			const messages = await fetchImapMessages(
				account,
				password,
				limit,
				unseenOnly,
			);
			return { account: account.label, count: messages.length, messages };
		} catch (err) {
			reply.code(502);
			return { error: `IMAP fetch failed: ${String(err)}` };
		}
	});

	// GET /email/inbox?limit=20&unseen=true — unified inbox across all accounts
	api.registerRoute("GET", "/inbox", async (req) => {
		const query = req.query as { limit?: string; unseen?: string };
		const limit = Number(query.limit ?? 20);
		const unseenOnly = query.unseen === "true";

		const accounts = await loadAccounts();
		const creds = await loadCreds();

		const results = await Promise.allSettled(
			accounts.map(async (account) => {
				const password = creds[account.id];
				if (!password)
					return {
						account: account.label,
						messages: [],
						error: "No credentials",
					};
				try {
					const messages = await fetchImapMessages(
						account,
						password,
						limit,
						unseenOnly,
					);
					return { account: account.label, accountId: account.id, messages };
				} catch (err) {
					return {
						account: account.label,
						accountId: account.id,
						messages: [],
						error: String(err),
					};
				}
			}),
		);

		const combined = results
			.filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
			.map((r) => r.value);

		// Merge and sort by date
		const allMessages = combined.flatMap((r) =>
			r.messages.map((m: EmailMessage) => ({ ...m, source: r.account })),
		);
		allMessages.sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
		);

		return {
			total: allMessages.length,
			messages: allMessages.slice(0, limit),
			accounts: combined.map((r) => ({
				label: r.account,
				count: r.messages.length,
				error: r.error,
			})),
		};
	});
};

// ---- Minimal IMAP client (no external deps) ----
async function fetchImapMessages(
	account: EmailAccount,
	password: string,
	limit: number,
	unseenOnly: boolean,
): Promise<EmailMessage[]> {
	const net = await import("node:net");
	const tls = await import("node:tls");

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new Error("IMAP connection timed out")),
			15_000,
		);
		const messages: EmailMessage[] = [];
		let buffer = "";
		let tag = 1;
		let phase: "greeting" | "login" | "select" | "search" | "fetch" | "done" =
			"greeting";
		let uids: number[] = [];

		const socket = account.tls
			? tls.connect({
					host: account.host,
					port: account.port,
					rejectUnauthorized: false,
				})
			: net.connect({ host: account.host, port: account.port });

		const send = (cmd: string) => socket.write(`A${tag++} ${cmd}\r\n`);

		socket.on("data", (chunk: Buffer) => {
			buffer += chunk.toString();
			const lines = buffer.split("\r\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				if (phase === "greeting" && line.startsWith("* OK")) {
					phase = "login";
					send(`LOGIN "${account.username}" "${password}"`);
				} else if (phase === "login" && /^A\d+ OK/.test(line)) {
					phase = "select";
					send("SELECT INBOX");
				} else if (phase === "select" && /^A\d+ OK/.test(line)) {
					phase = "search";
					send(unseenOnly ? "UID SEARCH UNSEEN" : "UID SEARCH ALL");
				} else if (phase === "search" && line.startsWith("* SEARCH")) {
					const parts = line
						.replace("* SEARCH", "")
						.trim()
						.split(" ")
						.filter(Boolean);
					uids = parts.map(Number).filter(Boolean).slice(-limit).reverse();
					if (uids.length === 0) {
						phase = "done";
						send("LOGOUT");
					} else {
						phase = "fetch";
						send(
							`UID FETCH ${uids.join(",")} (FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`,
						);
					}
				} else if (phase === "fetch") {
					// Parse FETCH responses
					if (line.startsWith("* ") && line.includes("FETCH")) {
						// Start of a message block — reset current
					} else if (line.startsWith("From:")) {
						const last = messages[messages.length - 1];
						if (last && !last.from) last.from = line.slice(5).trim();
						else
							messages.push({
								uid: 0,
								from: line.slice(5).trim(),
								subject: "",
								date: "",
								seen: false,
								snippet: "",
							});
					} else if (line.startsWith("Subject:")) {
						const last = messages[messages.length - 1];
						if (last) last.subject = line.slice(8).trim();
					} else if (line.startsWith("Date:")) {
						const last = messages[messages.length - 1];
						if (last) last.date = line.slice(5).trim();
					} else if (/^A\d+ OK/.test(line)) {
						phase = "done";
						send("LOGOUT");
					}
				} else if (phase === "done" && /BYE/.test(line)) {
					clearTimeout(timeout);
					socket.destroy();
					resolve(messages.filter((m) => m.from || m.subject));
				}
			}
		});

		socket.on("error", (err: Error) => {
			clearTimeout(timeout);
			reject(err);
		});
	});
}
