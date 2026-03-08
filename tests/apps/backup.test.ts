import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import type { FastifyInstance } from "fastify";

const mockSpawn = mock((_cmd: string, _args: string[], _opts: any) => {
	const proc = {
		pid: 99999,
		stdout: { on: mock((_evt: string, _cb: any) => {}) },
		stderr: { on: mock((_evt: string, _cb: any) => {}) },
		on: mock((evt: string, cb: any) => {
			if (evt === "close") setTimeout(() => cb(0), 10);
		}),
	};
	return proc;
});

const mockExecSync = mock((cmd: string): string => {
	if (cmd.includes("which rsync")) return "/usr/bin/rsync";
	if (cmd.includes("which ssh")) return "/usr/bin/ssh";
	return "";
});

mock.module("node:child_process", () => ({
	execSync: mockExecSync,
	spawn: mockSpawn,
}));

import { buildTestServer } from "../helpers/server.ts";

let app: FastifyInstance;
let jobId = "";

beforeAll(async () => {
	app = await buildTestServer();
});
afterAll(async () => {
	await app.close();
});

describe("backup module", () => {
	it("GET /backup/status — returns health info", async () => {
		const res = await app.inject({ method: "GET", url: "/backup/status" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(typeof body.totalJobs).toBe("number");
		expect(typeof body.rsyncAvailable).toBe("boolean");
	});

	it("GET /backup/jobs — returns empty array initially", async () => {
		const res = await app.inject({ method: "GET", url: "/backup/jobs" });
		expect(res.statusCode).toBe(200);
		expect(Array.isArray(res.json().jobs)).toBe(true);
	});

	it("POST /backup/jobs — creates a local backup job", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/backup/jobs",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				name: "Test Local Backup",
				type: "local",
				source: "/home/test/documents",
				compress: true,
				deleteOrphans: false,
				excludes: ["*.tmp", "node_modules"],
			}),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.ok).toBe(true);
		expect(body.job.id).toBeDefined();
		jobId = body.job.id;
	});

	it("POST /backup/jobs — creates an SSH backup job", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/backup/jobs",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				name: "Phone Backup",
				type: "ssh",
				source: "user@192.168.1.50:/storage/emulated/0/DCIM",
				port: 2222,
				compress: true,
				excludes: [".thumbnails"],
			}),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("POST /backup/jobs — 400 when name is missing", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/backup/jobs",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ type: "local", source: "/tmp" }),
		});
		expect(res.statusCode).toBe(400);
	});

	it("GET /backup/jobs/:id — returns job details", async () => {
		if (!jobId) return;
		const res = await app.inject({
			method: "GET",
			url: `/backup/jobs/${jobId}`,
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.job.name).toBe("Test Local Backup");
		expect(body.job.lastStatus).toBe("never");
	});

	it("GET /backup/jobs/:id — 404 for nonexistent job", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/backup/jobs/nonexistent-xyz",
		});
		expect(res.statusCode).toBe(404);
	});

	it("POST /backup/jobs/:id/run — triggers manual run", async () => {
		if (!jobId) return;
		const res = await app.inject({
			method: "POST",
			url: `/backup/jobs/${jobId}/run`,
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("GET /backup/jobs/:id/logs — returns log array", async () => {
		if (!jobId) return;
		const res = await app.inject({
			method: "GET",
			url: `/backup/jobs/${jobId}/logs`,
		});
		expect(res.statusCode).toBe(200);
		expect(Array.isArray(res.json().log)).toBe(true);
	});

	it("DELETE /backup/jobs/:id — removes the job", async () => {
		if (!jobId) return;
		const res = await app.inject({
			method: "DELETE",
			url: `/backup/jobs/${jobId}`,
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("GET /backup/jobs — job no longer listed after deletion", async () => {
		const res = await app.inject({ method: "GET", url: "/backup/jobs" });
		const { jobs } = res.json() as { jobs: { id: string }[] };
		expect(jobs.find((j) => j.id === jobId)).toBeUndefined();
	});

	it("is in /apps with storage + network + system permissions", async () => {
		const res = await app.inject({ method: "GET", url: "/apps" });
		const apps = res.json().apps as { name: string; permissions: string[] }[];
		const backup = apps.find((a) => a.name === "backup");
		expect(backup).toBeDefined();
		expect(backup!.permissions).toContain("storage");
		expect(backup!.permissions).toContain("network");
		expect(backup!.permissions).toContain("system");
	});
});
