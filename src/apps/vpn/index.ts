/**
 * VPN Module — WireGuard one-click via wg-easy Docker image.
 * Manages peers, generates QR codes for phone setup.
 * wg-easy provides a web UI + REST API on port 51821.
 */
import "reflect-metadata";
import { execSync } from "node:child_process";
import { z } from "zod";
import { Module, OnInit, Route } from "../../decorators/index.ts";
import type { ArkAPI } from "../../types/module.ts";

const CONTAINER_NAME = "ark-wireguard";
const WG_PORT = 51820; // WireGuard UDP
const WG_UI_PORT = 51821; // wg-easy web UI
const WG_API = `http://localhost:${WG_UI_PORT}/api`;

const StartVPNSchema = z.object({
	password: z.string().min(8, "Password must be at least 8 characters"),
	host: z
		.string()
		.min(1, "host is the public IP/domain clients will connect to"),
	timezone: z.string().default("America/Chicago"),
	dns: z.string().default("1.1.1.1"),
	port: z.number().int().min(1).max(65535).default(WG_PORT),
});

const AddPeerSchema = z.object({
	name: z
		.string()
		.min(1)
		.max(64)
		.regex(/^[a-zA-Z0-9_-]+$/, "Name must be alphanumeric"),
});

interface WgClient {
	id: string;
	name: string;
	enabled: boolean;
	address: string;
	publicKey: string;
	createdAt: string;
	updatedAt: string;
	latestHandshakeAt: string | null;
	transferRx: number;
	transferTx: number;
}

// ---- Docker helpers ----
function dockerAvailable(): boolean {
	try {
		execSync("docker info", { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function containerStatus(): "running" | "stopped" | "missing" {
	try {
		const s = execSync(
			`docker inspect --format='{{.State.Status}}' ${CONTAINER_NAME} 2>/dev/null`,
			{ encoding: "utf8" },
		)
			.trim()
			.replace(/'/g, "");
		return s === "running" ? "running" : "stopped";
	} catch {
		return "missing";
	}
}

// ---- wg-easy API helpers ----
let sessionCookie = "";

async function wgLogin(password: string): Promise<boolean> {
	try {
		const res = await fetch(`${WG_API}/session`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password }),
		});
		const cookie = res.headers.get("set-cookie");
		if (cookie) sessionCookie = cookie.split(";")[0] ?? "";
		return res.ok;
	} catch {
		return false;
	}
}

async function wgGet(path: string): Promise<any> {
	const res = await fetch(`${WG_API}${path}`, {
		headers: { Cookie: sessionCookie },
	});
	if (!res.ok) throw new Error(`wg-easy API ${path} → ${res.status}`);
	return res.json();
}

async function wgPost(path: string, body?: unknown): Promise<any> {
	const res = await fetch(`${WG_API}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: sessionCookie },
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) throw new Error(`wg-easy API ${path} → ${res.status}`);
	return res.json();
}

async function wgDelete(path: string): Promise<any> {
	const res = await fetch(`${WG_API}${path}`, {
		method: "DELETE",
		headers: { Cookie: sessionCookie },
	});
	if (!res.ok) throw new Error(`wg-easy API ${path} → ${res.status}`);
	return res.json();
}

@Module({
	name: "vpn",
	version: "1.0.0",
	description:
		"WireGuard VPN — one-click deploy, peer management, and QR codes for every device",
	icon: "🔒",
	permissions: ["docker", "network", "system"],
})
export default class VPNModule {
	declare _api: ArkAPI;
	private vpnPassword = "";

	@OnInit()
	async setup() {
		this._api.log("VPN module initialised");
		// Load saved password if any
		try {
			const buf = await this._api.storage.get("vpn-config.json");
			const cfg = JSON.parse(buf.toString()) as { password?: string };
			this.vpnPassword = cfg.password ?? "";
		} catch {
			/* no config yet */
		}
	}

	// ---- GET /vpn/status ----
	@Route("GET", "/status")
	async status(_req: any, reply: any) {
		if (!dockerAvailable()) {
			reply.code(503);
			return { error: "Docker is not available" };
		}

		const containerState = containerStatus();
		let clients: WgClient[] = [];
		let apiReachable = false;

		if (containerState === "running" && this.vpnPassword) {
			try {
				await wgLogin(this.vpnPassword);
				clients = (await wgGet("/wireguard/client")) as WgClient[];
				apiReachable = true;
			} catch {
				/* API not ready yet */
			}
		}

		return {
			status: containerState,
			container: CONTAINER_NAME,
			wgPort: WG_PORT,
			webUI:
				containerState === "running"
					? `http://<your-ark-ip>:${WG_UI_PORT}`
					: null,
			apiReachable,
			peers: clients.length,
			activePeers: clients.filter((c) => c.latestHandshakeAt).length,
		};
	}

	// ---- POST /vpn/start — deploy WireGuard ----
	@Route("POST", "/start")
	async start(req: any, reply: any) {
		if (!dockerAvailable()) {
			reply.code(503);
			return { error: "Docker is not available" };
		}

		const result = StartVPNSchema.safeParse(req.body);
		if (!result.success) {
			reply.code(400);
			return { error: result.error.issues[0]?.message ?? "Invalid request" };
		}

		const { password, host, timezone, dns, port } = result.data;

		const state = containerStatus();
		if (state === "running")
			return { ok: true, message: "WireGuard is already running" };

		if (state === "stopped") {
			execSync(`docker start ${CONTAINER_NAME}`);
			this.vpnPassword = password;
			await this._api.storage.save(
				"vpn-config.json",
				JSON.stringify({ password }),
			);
			return {
				ok: true,
				message: "WireGuard restarted",
				webUI: `http://<your-ark-ip>:${WG_UI_PORT}`,
			};
		}

		const cmd = [
			"docker",
			"run",
			"-d",
			"--name",
			CONTAINER_NAME,
			"-e",
			`WG_HOST=${host}`,
			"-e",
			`PASSWORD_HASH=$(echo '${password}' | docker run --rm -i ghcr.io/wg-easy/wg-easy wgpw 2>/dev/null || echo '${password}')`,
			"-e",
			`TZ=${timezone}`,
			"-e",
			`WG_DEFAULT_DNS=${dns}`,
			"-e",
			`WG_PORT=${port}`,
			"-p",
			`${port}:51820/udp`,
			"-p",
			`${WG_UI_PORT}:51821/tcp`,
			"-v",
			`${CONTAINER_NAME}-data:/etc/wireguard`,
			"--cap-add=NET_ADMIN",
			"--cap-add=SYS_MODULE",
			"--sysctl=net.ipv4.ip_forward=1",
			"--sysctl=net.ipv4.conf.all.src_valid_mark=1",
			"--restart",
			"unless-stopped",
			"ghcr.io/wg-easy/wg-easy",
		].join(" ");

		try {
			execSync(cmd);
			this.vpnPassword = password;
			await this._api.storage.save(
				"vpn-config.json",
				JSON.stringify({ password, host }),
			);
			return {
				ok: true,
				message: "WireGuard VPN deployed",
				webUI: `http://<your-ark-ip>:${WG_UI_PORT}`,
				password,
				note: "Web UI may take ~15s to be ready on first start",
				next: "POST /vpn/peers with { name } to add your first device",
			};
		} catch (err) {
			reply.code(500);
			return { error: String(err) };
		}
	}

	// ---- POST /vpn/stop ----
	@Route("POST", "/stop")
	async stop(_req: any, reply: any) {
		if (!dockerAvailable()) {
			reply.code(503);
			return { error: "Docker not available" };
		}
		const state = containerStatus();
		if (state !== "running") return { ok: true, message: "VPN is not running" };
		execSync(`docker stop ${CONTAINER_NAME}`);
		return { ok: true, message: "WireGuard stopped" };
	}

	// ---- DELETE /vpn/destroy ----
	@Route("DELETE", "/destroy")
	async destroy(_req: any, reply: any) {
		if (!dockerAvailable()) {
			reply.code(503);
			return { error: "Docker not available" };
		}
		execSync(`docker rm -f ${CONTAINER_NAME} 2>/dev/null || true`);
		execSync(`docker volume rm ${CONTAINER_NAME}-data 2>/dev/null || true`);
		return { ok: true, message: "WireGuard container and data destroyed" };
	}

	// ---- GET /vpn/peers — list all peers ----
	@Route("GET", "/peers")
	async listPeers(_req: any, reply: any) {
		if (containerStatus() !== "running") {
			reply.code(503);
			return { error: "WireGuard is not running" };
		}
		try {
			await wgLogin(this.vpnPassword);
			const clients = (await wgGet("/wireguard/client")) as WgClient[];
			return {
				peers: clients.map((c) => ({
					id: c.id,
					name: c.name,
					enabled: c.enabled,
					address: c.address,
					connected: !!c.latestHandshakeAt,
					lastSeen: c.latestHandshakeAt,
					transferRx: formatBytes(c.transferRx),
					transferTx: formatBytes(c.transferTx),
				})),
			};
		} catch (err) {
			reply.code(502);
			return { error: `wg-easy API error: ${String(err)}` };
		}
	}

	// ---- POST /vpn/peers — add a peer ----
	@Route("POST", "/peers")
	async addPeer(req: any, reply: any) {
		const result = AddPeerSchema.safeParse(req.body);
		if (!result.success) {
			reply.code(400);
			return { error: result.error.issues[0]?.message ?? "Invalid request" };
		}

		if (containerStatus() !== "running") {
			reply.code(503);
			return { error: "WireGuard is not running" };
		}

		try {
			await wgLogin(this.vpnPassword);
			const client = (await wgPost("/wireguard/client", {
				name: result.data.name,
			})) as WgClient;
			return {
				ok: true,
				peer: {
					id: client.id,
					name: client.name,
					address: client.address,
					publicKey: client.publicKey,
				},
				next: `GET /vpn/peers/${client.id}/qr to get the QR code for phone setup`,
			};
		} catch (err) {
			reply.code(502);
			return { error: String(err) };
		}
	}

	// ---- DELETE /vpn/peers/:id — remove peer ----
	@Route("DELETE", "/peers/:id")
	async removePeer(req: any, reply: any) {
		const { id } = req.params as { id: string };
		if (containerStatus() !== "running") {
			reply.code(503);
			return { error: "WireGuard is not running" };
		}
		try {
			await wgLogin(this.vpnPassword);
			await wgDelete(`/wireguard/client/${id}`);
			return { ok: true, message: "Peer removed" };
		} catch (err) {
			reply.code(502);
			return { error: String(err) };
		}
	}

	// ---- GET /vpn/peers/:id/config — download .conf file ----
	@Route("GET", "/peers/:id/config")
	async peerConfig(req: any, reply: any) {
		const { id } = req.params as { id: string };
		if (containerStatus() !== "running") {
			reply.code(503);
			return { error: "WireGuard is not running" };
		}
		try {
			await wgLogin(this.vpnPassword);
			const res = await fetch(
				`${WG_API}/wireguard/client/${id}/configuration`,
				{
					headers: { Cookie: sessionCookie },
				},
			);
			if (!res.ok) throw new Error(`API ${res.status}`);
			const conf = await res.text();
			reply.type("text/plain");
			reply.header(
				"Content-Disposition",
				`attachment; filename="ark-vpn-${id}.conf"`,
			);
			return conf;
		} catch (err) {
			reply.code(502);
			return { error: String(err) };
		}
	}

	// ---- GET /vpn/peers/:id/qr — QR code as SVG ----
	@Route("GET", "/peers/:id/qr")
	async peerQR(req: any, reply: any) {
		const { id } = req.params as { id: string };
		if (containerStatus() !== "running") {
			reply.code(503);
			return { error: "WireGuard is not running" };
		}
		try {
			await wgLogin(this.vpnPassword);
			const res = await fetch(`${WG_API}/wireguard/client/${id}/qrcode.svg`, {
				headers: { Cookie: sessionCookie },
			});
			if (!res.ok) throw new Error(`API ${res.status}`);
			const svg = await res.text();
			reply.type("image/svg+xml");
			return svg;
		} catch (err) {
			reply.code(502);
			return { error: String(err) };
		}
	}

	// ---- POST /vpn/peers/:id/enable|disable ----
	@Route("POST", "/peers/:id/enable")
	async enablePeer(req: any, reply: any) {
		return this.togglePeer((req.params as { id: string }).id, true, reply);
	}

	@Route("POST", "/peers/:id/disable")
	async disablePeer(req: any, reply: any) {
		return this.togglePeer((req.params as { id: string }).id, false, reply);
	}

	private async togglePeer(id: string, enable: boolean, reply: any) {
		if (containerStatus() !== "running") {
			reply.code(503);
			return { error: "WireGuard is not running" };
		}
		try {
			await wgLogin(this.vpnPassword);
			await wgPost(`/wireguard/client/${id}/${enable ? "enable" : "disable"}`);
			return { ok: true, message: `Peer ${enable ? "enabled" : "disabled"}` };
		} catch (err) {
			reply.code(502);
			return { error: String(err) };
		}
	}
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
