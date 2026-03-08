import { execSync, spawn } from "node:child_process";
import type { ArkAPI, ArkManifest } from "../../types/module.ts";

export const manifest: ArkManifest = {
	name: "minecraft",
	version: "1.0.0",
	description: "One-click Minecraft Java server — deploy, start, stop, and monitor",
	icon: "⛏️",
	permissions: ["docker", "storage", "network"],
};

const CONTAINER_NAME = "ark-minecraft";
const DEFAULT_IMAGE = "itzg/minecraft-server";

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
		if (out === "running") return "running";
		return "stopped";
	} catch {
		return "missing";
	}
}

function getContainerIP(): string | null {
	try {
		return execSync(
			`docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${CONTAINER_NAME}`,
			{ encoding: "utf8" },
		).trim().replace(/'/g, "") || null;
	} catch {
		return null;
	}
}

export const run = (api: ArkAPI) => {
	api.log("Minecraft module loaded");

	// GET /minecraft/status
	api.registerRoute("GET", "/status", async (_req, reply) => {
		if (!dockerRunning()) {
			reply.code(503);
			return { error: "Docker is not available on this host" };
		}
		const status = containerStatus();
		return {
			status,
			container: CONTAINER_NAME,
			image: DEFAULT_IMAGE,
			ip: status === "running" ? getContainerIP() : null,
			port: 25565,
			connect: status === "running" ? `<your-ark-ip>:25565` : null,
		};
	});

	// POST /minecraft/start   body: { version?, memory?, gamemode?, difficulty? }
	api.registerRoute("POST", "/start", async (req, reply) => {
		if (!dockerRunning()) {
			reply.code(503);
			return { error: "Docker is not available on this host" };
		}

		const status = containerStatus();
		if (status === "running") {
			return { ok: true, message: "Server is already running" };
		}

		const body = (req.body ?? {}) as {
			version?: string;
			memory?: string;
			gamemode?: string;
			difficulty?: string;
		};

		const version = body.version ?? "LATEST";
		const memory = body.memory ?? "2G";
		const gamemode = body.gamemode ?? "survival";
		const difficulty = body.difficulty ?? "normal";

		// If container exists but stopped, just restart it
		if (status === "stopped") {
			execSync(`docker start ${CONTAINER_NAME}`);
			return { ok: true, message: "Server restarted", container: CONTAINER_NAME };
		}

		// Fresh deploy
		const cmd = [
			"docker", "run", "-d",
			"--name", CONTAINER_NAME,
			"-p", "25565:25565",
			"-e", "EULA=TRUE",
			"-e", `VERSION=${version}`,
			"-e", `MEMORY=${memory}`,
			"-e", `GAMEMODE=${gamemode}`,
			"-e", `DIFFICULTY=${difficulty}`,
			"-e", "ONLINE_MODE=FALSE",
			"-v", `${CONTAINER_NAME}-data:/data`,
			"--restart", "unless-stopped",
			DEFAULT_IMAGE,
		];

		try {
			execSync(cmd.join(" "));
			return {
				ok: true,
				message: "Minecraft server deployed",
				container: CONTAINER_NAME,
				port: 25565,
				note: "Server is starting, allow ~60s for world generation on first run",
			};
		} catch (err) {
			reply.code(500);
			return { error: String(err) };
		}
	});

	// POST /minecraft/stop
	api.registerRoute("POST", "/stop", async (_req, reply) => {
		if (!dockerRunning()) {
			reply.code(503);
			return { error: "Docker is not available" };
		}
		const status = containerStatus();
		if (status === "missing") return { ok: true, message: "No server to stop" };
		if (status === "stopped") return { ok: true, message: "Server already stopped" };
		execSync(`docker stop ${CONTAINER_NAME}`);
		return { ok: true, message: "Server stopped" };
	});

	// DELETE /minecraft/destroy  — removes container + data volume
	api.registerRoute("DELETE", "/destroy", async (_req, reply) => {
		if (!dockerRunning()) {
			reply.code(503);
			return { error: "Docker is not available" };
		}
		try {
			execSync(`docker rm -f ${CONTAINER_NAME} 2>/dev/null || true`);
			execSync(`docker volume rm ${CONTAINER_NAME}-data 2>/dev/null || true`);
			return { ok: true, message: "Server and data destroyed" };
		} catch (err) {
			reply.code(500);
			return { error: String(err) };
		}
	});

	// GET /minecraft/logs?lines=50
	api.registerRoute("GET", "/logs", async (req, reply) => {
		if (!dockerRunning()) {
			reply.code(503);
			return { error: "Docker is not available" };
		}
		const query = req.query as { lines?: string };
		const lines = Number(query.lines ?? 50);
		try {
			const logs = execSync(`docker logs --tail ${lines} ${CONTAINER_NAME} 2>&1`, {
				encoding: "utf8",
			});
			return { logs: logs.split("\n").filter(Boolean) };
		} catch {
			return { logs: [] };
		}
	});
};
