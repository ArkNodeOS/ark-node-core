/**
 * AdBlock Module — Pi-hole style DNS ad blocking
 * Runs a lightweight DNS sinkhole in Docker (pihole/pihole).
 * Can optionally integrate with your router as upstream DNS.
 */
import { execSync } from "node:child_process";
import type { ArkAPI, ArkManifest } from "../../types/module.ts";

export const manifest: ArkManifest = {
	name: "adblock",
	version: "1.0.0",
	description: "Network-wide ad blocking via Pi-hole DNS sinkhole — kills YouTube ads, trackers, and malware domains",
	icon: "🛡️",
	permissions: ["docker", "network", "system"],
};

const CONTAINER_NAME = "ark-pihole";
const DNS_PORT = 5353; // Avoid conflict with system resolver on 53
const WEB_PORT = 8080;

function dockerRunning(): boolean {
	try {
		execSync("docker info", { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function containerStatus(): "running" | "stopped" | "missing" {
	try {
		const out = execSync(
			`docker inspect --format='{{.State.Status}}' ${CONTAINER_NAME} 2>/dev/null`,
			{ encoding: "utf8" },
		).trim().replace(/'/g, "");
		return out === "running" ? "running" : "stopped";
	} catch {
		return "missing";
	}
}

function getBlockStats(): { domains_being_blocked: number; dns_queries_today: number; ads_blocked_today: number; ads_percentage_today: number } | null {
	try {
		// Query Pi-hole's local API
		const raw = execSync(
			`docker exec ${CONTAINER_NAME} curl -s "http://localhost/admin/api.php?summary" 2>/dev/null`,
			{ encoding: "utf8", timeout: 5000 },
		);
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export const run = (api: ArkAPI) => {
	api.log("AdBlock module loaded");

	// GET /adblock/status
	api.registerRoute("GET", "/status", async (_req, reply) => {
		if (!dockerRunning()) {
			reply.code(503);
			return { error: "Docker is not available" };
		}
		const status = containerStatus();
		const stats = status === "running" ? getBlockStats() : null;
		return {
			status,
			container: CONTAINER_NAME,
			dns_port: DNS_PORT,
			web_ui: status === "running" ? `http://<your-ark-ip>:${WEB_PORT}/admin` : null,
			stats,
			setup_hint: status === "running"
				? `Set your router's DNS server to <your-ark-ip>:${DNS_PORT} to block ads network-wide`
				: "Start Pi-hole first",
		};
	});

	// POST /adblock/start  body: { password?, timezone? }
	api.registerRoute("POST", "/start", async (req, reply) => {
		if (!dockerRunning()) {
			reply.code(503);
			return { error: "Docker is not available" };
		}

		const status = containerStatus();
		if (status === "running") return { ok: true, message: "Pi-hole is already running" };

		if (status === "stopped") {
			execSync(`docker start ${CONTAINER_NAME}`);
			return { ok: true, message: "Pi-hole restarted", dns_port: DNS_PORT, web_port: WEB_PORT };
		}

		const body = (req.body ?? {}) as { password?: string; timezone?: string };
		const password = body.password ?? "ark-admin";
		const tz = body.timezone ?? "America/Chicago";

		const cmd = [
			"docker", "run", "-d",
			"--name", CONTAINER_NAME,
			"-p", `${DNS_PORT}:53/tcp`,
			"-p", `${DNS_PORT}:53/udp`,
			"-p", `${WEB_PORT}:80`,
			"-e", `TZ=${tz}`,
			"-e", `WEBPASSWORD=${password}`,
			"-e", "DNSMASQ_LISTENING=all",
			"-v", `${CONTAINER_NAME}-etc:/etc/pihole`,
			"-v", `${CONTAINER_NAME}-dnsmasq:/etc/dnsmasq.d`,
			"--dns", "127.0.0.1",
			"--dns", "1.1.1.1",
			"--restart", "unless-stopped",
			"--cap-add", "NET_ADMIN",
			"pihole/pihole:latest",
		];

		try {
			execSync(cmd.join(" "));
			return {
				ok: true,
				message: "Pi-hole deployed",
				dns_port: DNS_PORT,
				web_port: WEB_PORT,
				web_ui: `http://<your-ark-ip>:${WEB_PORT}/admin`,
				password,
				next_step: `Point your router's primary DNS to this machine on port ${DNS_PORT}`,
			};
		} catch (err) {
			reply.code(500);
			return { error: String(err) };
		}
	});

	// POST /adblock/stop
	api.registerRoute("POST", "/stop", async (_req, reply) => {
		if (!dockerRunning()) {
			reply.code(503);
			return { error: "Docker is not available" };
		}
		if (containerStatus() !== "running") return { ok: true, message: "Pi-hole is not running" };
		execSync(`docker stop ${CONTAINER_NAME}`);
		return { ok: true, message: "Pi-hole stopped" };
	});

	// GET /adblock/blocklist — show top blocked domains
	api.registerRoute("GET", "/blocklist", async (_req, reply) => {
		if (containerStatus() !== "running") {
			reply.code(503);
			return { error: "Pi-hole is not running" };
		}
		try {
			const raw = execSync(
				`docker exec ${CONTAINER_NAME} curl -s "http://localhost/admin/api.php?topItems=20" 2>/dev/null`,
				{ encoding: "utf8", timeout: 5000 },
			);
			const data = JSON.parse(raw);
			return { top_blocked: data.top_ads ?? {}, top_queries: data.top_queries ?? {} };
		} catch (err) {
			reply.code(502);
			return { error: String(err) };
		}
	});

	// POST /adblock/whitelist  body: { domain }
	api.registerRoute("POST", "/whitelist", async (req, reply) => {
		if (containerStatus() !== "running") {
			reply.code(503);
			return { error: "Pi-hole is not running" };
		}
		const { domain } = req.body as { domain: string };
		if (!domain) {
			reply.code(400);
			return { error: "domain is required" };
		}
		try {
			execSync(`docker exec ${CONTAINER_NAME} pihole -w ${domain}`);
			return { ok: true, message: `${domain} whitelisted` };
		} catch (err) {
			reply.code(500);
			return { error: String(err) };
		}
	});

	// POST /adblock/blacklist  body: { domain }
	api.registerRoute("POST", "/blacklist", async (req, reply) => {
		if (containerStatus() !== "running") {
			reply.code(503);
			return { error: "Pi-hole is not running" };
		}
		const { domain } = req.body as { domain: string };
		if (!domain) {
			reply.code(400);
			return { error: "domain is required" };
		}
		try {
			execSync(`docker exec ${CONTAINER_NAME} pihole -b ${domain}`);
			return { ok: true, message: `${domain} blacklisted` };
		} catch (err) {
			reply.code(500);
			return { error: String(err) };
		}
	});

	// POST /adblock/update-lists — pull latest blocklists
	api.registerRoute("POST", "/update-lists", async (_req, reply) => {
		if (containerStatus() !== "running") {
			reply.code(503);
			return { error: "Pi-hole is not running" };
		}
		try {
			execSync(`docker exec ${CONTAINER_NAME} pihole -g`, { timeout: 120_000 });
			return { ok: true, message: "Blocklists updated" };
		} catch (err) {
			reply.code(500);
			return { error: String(err) };
		}
	});
};
