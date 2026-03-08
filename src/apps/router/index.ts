/**
 * Router Module — network control center.
 * Manages DNS, firewall (iptables), port forwarding, and device discovery.
 * Requires NET_ADMIN capability or sudo access for iptables/ip commands.
 */
import "reflect-metadata";
import { execSync } from "node:child_process";
import { z } from "zod";
import { Module, OnInit, Route } from "../../decorators/index.ts";
import type { ArkAPI } from "../../types/module.ts";

// ---- Zod schemas ----
const SetDNSSchema = z.object({
	primary: z.ipv4(),
	secondary: z.ipv4().optional(),
	interface: z.string().optional(),
});

const FirewallRuleSchema = z.object({
	action: z.enum(["ACCEPT", "DROP", "REJECT"]),
	direction: z.enum(["INPUT", "OUTPUT", "FORWARD"]),
	protocol: z.enum(["tcp", "udp", "icmp", "all"]).default("all"),
	port: z.number().int().min(1).max(65535).optional(),
	source: z.ipv4().optional(),
	comment: z.string().optional(),
});

const PortForwardSchema = z.object({
	externalPort: z.number().int().min(1).max(65535),
	internalIp: z.ipv4(),
	internalPort: z.number().int().min(1).max(65535),
	protocol: z.enum(["tcp", "udp"]).default("tcp"),
	comment: z.string().optional(),
});

function run(cmd: string): string {
	return execSync(cmd, { encoding: "utf8" }).trim();
}

function tryRun(cmd: string): string {
	try {
		return run(cmd);
	} catch {
		return "";
	}
}

@Module({
	name: "router",
	version: "1.0.0",
	description:
		"Network control center — DNS, firewall rules, port forwarding, device discovery",
	icon: "🌐",
	permissions: ["network", "system"],
})
export default class RouterModule {
	declare _api: ArkAPI;

	@OnInit()
	async setup() {
		this._api.log("Router module initialised");
	}

	// ---- GET /router/network — interface info, gateway, public IP ----
	@Route("GET", "/network")
	async network() {
		const gateway = tryRun(
			"ip route show default | awk '/default/ {print $3}' | head -1",
		);
		const iface = tryRun(
			"ip route show default | awk '/default/ {print $5}' | head -1",
		);
		const localIP = tryRun(
			`ip -4 addr show ${iface} | grep -oP '(?<=inet\\s)\\d+\\.\\d+\\.\\d+\\.\\d+' | head -1`,
		);
		const publicIP = await fetch("https://api.ipify.org?format=text")
			.then((r) => r.text())
			.catch(() => "unavailable");

		const interfaces = tryRun(
			"ip -4 addr | grep -E '^[0-9]+:|inet ' | paste - -",
		)
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const iMatch = line.match(/^\d+:\s+(\S+)/);
				const ipMatch = line.match(/inet\s+(\S+)/);
				return { name: iMatch?.[1], ip: ipMatch?.[1] };
			})
			.filter((i) => i.name && i.ip);

		return { gateway, interface: iface, localIP, publicIP, interfaces };
	}

	// ---- GET /router/dns — current DNS servers ----
	@Route("GET", "/dns")
	async getDNS() {
		const resolv = tryRun(
			"cat /etc/resolv.conf | grep nameserver | awk '{print $2}'",
		);
		const servers = resolv.split("\n").filter(Boolean);

		// Check if we're using systemd-resolved
		const resolved = tryRun("systemctl is-active systemd-resolved 2>/dev/null");
		const systemdDNS =
			resolved === "active"
				? tryRun("resolvectl status 2>/dev/null | grep 'DNS Servers' | head -3")
				: null;

		return {
			servers,
			systemdResolved: resolved === "active",
			systemdDNS,
			usingArk: servers.some((s) => s === "127.0.0.1" || s === "::1"),
			note: "To use Ark as DNS, set DNS to 127.0.0.1 (Pi-hole must be running)",
		};
	}

	// ---- POST /router/dns — set DNS servers ----
	@Route("POST", "/dns")
	async setDNS(req: any, reply: any) {
		const result = SetDNSSchema.safeParse(req.body);
		if (!result.success) {
			reply.code(400);
			return { error: result.error.issues[0]?.message ?? "Invalid request" };
		}

		const { primary, secondary, interface: iface } = result.data;
		const servers = [primary, ...(secondary ? [secondary] : [])];

		// Try systemd-resolved first
		const resolved = tryRun("systemctl is-active systemd-resolved 2>/dev/null");
		if (resolved === "active") {
			const targetIface =
				iface ??
				tryRun("ip route show default | awk '/default/ {print $5}' | head -1");
			for (const server of servers) {
				tryRun(`resolvectl dns ${targetIface} ${server} 2>/dev/null`);
			}
			return {
				ok: true,
				method: "systemd-resolved",
				servers,
				note: "DNS updated via systemd-resolved. Restart resolved to persist.",
			};
		}

		// Fall back to /etc/resolv.conf (direct write)
		const lines = [
			"# Managed by Ark Node",
			...servers.map((s) => `nameserver ${s}`),
		].join("\n");

		try {
			execSync(`echo '${lines}' | sudo tee /etc/resolv.conf`, {
				encoding: "utf8",
			});
			return { ok: true, method: "resolv.conf", servers };
		} catch {
			// Can't write without sudo — return instructions
			reply.code(403);
			return {
				error: "Insufficient permissions to write /etc/resolv.conf",
				manual: `Run: echo '${lines}' | sudo tee /etc/resolv.conf`,
				servers,
			};
		}
	}

	// ---- POST /router/dns/use-ark — point DNS at local Pi-hole ----
	@Route("POST", "/dns/use-ark")
	async useArkDNS(req: any, reply: any) {
		// Verify Pi-hole is running
		const pihole = tryRun(
			"docker inspect --format='{{.State.Status}}' ark-pihole 2>/dev/null",
		).replace(/'/g, "");
		if (pihole !== "running") {
			reply.code(503);
			return {
				error: "Pi-hole is not running. Start it first via POST /adblock/start",
			};
		}
		// Pi-hole listens on port 5353 by default in our setup
		return this.setDNS(
			{ ...req, body: { primary: "127.0.0.1", secondary: "1.1.1.1" } },
			reply,
		);
	}

	// ---- GET /router/firewall — list iptables rules ----
	@Route("GET", "/firewall")
	async getFirewall() {
		const input = tryRun(
			"sudo iptables -L INPUT -n --line-numbers 2>/dev/null || iptables -L INPUT -n --line-numbers 2>/dev/null",
		);
		const output = tryRun(
			"sudo iptables -L OUTPUT -n --line-numbers 2>/dev/null || iptables -L OUTPUT -n --line-numbers 2>/dev/null",
		);
		const fwd = tryRun(
			"sudo iptables -L FORWARD -n --line-numbers 2>/dev/null || iptables -L FORWARD -n --line-numbers 2>/dev/null",
		);
		const nat = tryRun(
			"sudo iptables -t nat -L PREROUTING -n --line-numbers 2>/dev/null",
		);

		const parseRules = (raw: string) =>
			raw
				.split("\n")
				.filter((l) => /^\d+/.test(l))
				.map((l) => l.trim());

		return {
			INPUT: parseRules(input),
			OUTPUT: parseRules(output),
			FORWARD: parseRules(fwd),
			NAT_PREROUTE: parseRules(nat),
			note: "Rules are ephemeral unless persisted with iptables-save",
		};
	}

	// ---- POST /router/firewall — add a firewall rule ----
	@Route("POST", "/firewall")
	async addFirewallRule(req: any, reply: any) {
		const result = FirewallRuleSchema.safeParse(req.body);
		if (!result.success) {
			reply.code(400);
			return { error: result.error.issues[0]?.message ?? "Invalid request" };
		}

		const { action, direction, protocol, port, source, comment } = result.data;
		const parts: string[] = ["iptables", "-A", direction];
		if (source) parts.push("-s", source);
		if (protocol !== "all") parts.push("-p", protocol);
		if (port) parts.push("--dport", String(port));
		if (comment) parts.push("-m", "comment", "--comment", `"ark:${comment}"`);
		parts.push("-j", action);

		const cmd = parts.join(" ");
		try {
			execSync(`sudo ${cmd} 2>/dev/null || ${cmd}`);
			return { ok: true, rule: cmd };
		} catch (err) {
			reply.code(500);
			return { error: String(err), manual: `Run: sudo ${cmd}` };
		}
	}

	// ---- POST /router/ports — add port forward ----
	@Route("POST", "/ports")
	async addPortForward(req: any, reply: any) {
		const result = PortForwardSchema.safeParse(req.body);
		if (!result.success) {
			reply.code(400);
			return { error: result.error.issues[0]?.message ?? "Invalid request" };
		}

		const { externalPort, internalIp, internalPort, protocol, comment } =
			result.data;

		const prerouteCmd = `iptables -t nat -A PREROUTING -p ${protocol} --dport ${externalPort} -j DNAT --to-destination ${internalIp}:${internalPort}`;
		const forwardCmd = `iptables -A FORWARD -p ${protocol} -d ${internalIp} --dport ${internalPort} -j ACCEPT`;
		const masqCmd = `iptables -t nat -A POSTROUTING -j MASQUERADE`;

		try {
			for (const cmd of [prerouteCmd, forwardCmd, masqCmd]) {
				execSync(`sudo ${cmd} 2>/dev/null || ${cmd}`);
			}
			// Also enable IP forwarding
			tryRun(
				"echo 1 | sudo tee /proc/sys/net/ipv4/ip_forward 2>/dev/null || sysctl -w net.ipv4.ip_forward=1",
			);
			return {
				ok: true,
				forward: `${externalPort}/${protocol} → ${internalIp}:${internalPort}`,
				comment,
			};
		} catch (err) {
			reply.code(500);
			return {
				error: String(err),
				manual: [prerouteCmd, forwardCmd, masqCmd]
					.map((c) => `sudo ${c}`)
					.join("\n"),
			};
		}
	}

	// ---- GET /router/devices — scan LAN for connected devices ----
	@Route("GET", "/devices")
	async devices(_req: any, reply: any) {
		// Check for nmap or arp-scan
		const hasNmap = tryRun("which nmap 2>/dev/null");
		const hasArpScan = tryRun("which arp-scan 2>/dev/null");
		const subnet = tryRun(
			"ip -4 addr show $(ip route show default | awk '/default/{print $5}' | head -1) | grep -oP '(?<=inet\\s)\\d+\\.\\d+\\.\\d+\\.\\d+/\\d+'",
		);

		if (!subnet) {
			reply.code(503);
			return { error: "Could not determine local subnet" };
		}

		// Try arp table (no extra tools needed)
		const arpTable = tryRun("arp -n | grep -v incomplete | tail -n +2")
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const parts = line.split(/\s+/);
				return { ip: parts[0] ?? "", mac: parts[2], interface: parts[4] };
			})
			.filter(
				(
					d,
				): d is {
					ip: string;
					mac: string | undefined;
					interface: string | undefined;
				} => Boolean(d.ip) && d.mac !== "(incomplete)",
			);

		let scanResults: { ip: string; hostname?: string; mac?: string }[] =
			arpTable;

		if (hasNmap) {
			try {
				const nmap = execSync(
					`sudo nmap -sn ${subnet} -oG - 2>/dev/null | grep "Host:"`,
					{
						encoding: "utf8",
						timeout: 15_000,
					},
				);
				scanResults = nmap
					.split("\n")
					.filter(Boolean)
					.map((line) => {
						const ipMatch = line.match(/Host:\s+(\S+)/);
						const hostMatch = line.match(/\(([^)]+)\)/);
						return { ip: ipMatch?.[1] ?? "", hostname: hostMatch?.[1] };
					})
					.filter((d) => d.ip);
			} catch {
				/* use arp table */
			}
		}

		return {
			subnet,
			count: scanResults.length,
			devices: scanResults,
			scanner: hasNmap ? "nmap" : hasArpScan ? "arp-scan" : "arp-table",
		};
	}
}
