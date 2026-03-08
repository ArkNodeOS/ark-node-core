/**
 * Backup Module — automated rsync backups from phones, laptops, and remote machines.
 * Stores job configs in module storage. Executes rsync over SSH.
 * Each job can be triggered manually or run on a cron-like schedule.
 */
import "reflect-metadata";
import { execSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Module, OnInit, Route } from "../../decorators/index.ts";
import type { ArkAPI } from "../../types/module.ts";

// ---- Schemas ----
const CreateJobSchema = z.object({
	name: z.string().min(1).max(100),
	type: z.enum(["ssh", "local"]),
	// For SSH: user@host:/path or just host + separate fields
	source: z.string().min(1),
	// Optional: override with explicit fields
	host: z.string().optional(),
	user: z.string().optional(),
	port: z.number().int().min(1).max(65535).default(22),
	// rsync options
	excludes: z.array(z.string()).default([]),
	deleteOrphans: z.boolean().default(false),
	compress: z.boolean().default(true),
	// Schedule: cron string or interval in minutes (null = manual only)
	schedule: z.string().nullable().default(null),
	// SSH key path (defaults to ~/.ssh/id_rsa)
	identityFile: z.string().optional(),
});

type CreateJobInput = z.infer<typeof CreateJobSchema>;

interface BackupJob extends CreateJobInput {
	id: string;
	createdAt: string;
	lastRun: string | null;
	lastStatus: "success" | "failed" | "running" | "never";
	lastLog: string[];
	nextRun: string | null;
	totalRuns: number;
	destination: string; // abs path inside storage
}

interface RunStatus {
	jobId: string;
	running: boolean;
	pid?: number;
}

const JOBS_FILE = "jobs.json";
const activeRuns = new Map<string, RunStatus>();

@Module({
	name: "backup",
	version: "1.0.0",
	description:
		"Automated rsync backups from phones, laptops, and any SSH-accessible machine",
	icon: "💾",
	permissions: ["storage", "network", "system"],
})
export default class BackupModule {
	declare _api: ArkAPI;
	private jobs: Map<string, BackupJob> = new Map();
	private schedulers: Map<string, ReturnType<typeof setInterval>> = new Map();

	@OnInit()
	async setup() {
		this._api.log("Backup module initialised");
		await this._api.storage.mkdir("archives");
		await this.loadJobs();
		this.startSchedulers();
	}

	private async loadJobs() {
		try {
			const buf = await this._api.storage.get(JOBS_FILE);
			const arr = JSON.parse(buf.toString()) as BackupJob[];
			for (const job of arr) this.jobs.set(job.id, job);
			this._api.log(`Loaded ${this.jobs.size} backup job(s)`);
		} catch {
			this.jobs = new Map();
		}
	}

	private async saveJobs() {
		await this._api.storage.save(
			JOBS_FILE,
			JSON.stringify([...this.jobs.values()], null, 2),
		);
	}

	private startSchedulers() {
		for (const job of this.jobs.values()) {
			if (job.schedule) this.scheduleJob(job);
		}
	}

	private scheduleJob(job: BackupJob) {
		// Support simple "every X minutes" schedules as numbers
		const minutes = Number(job.schedule);
		if (!Number.isNaN(minutes) && minutes > 0) {
			const interval = setInterval(
				() => this.executeJob(job.id),
				minutes * 60_000,
			);
			this.schedulers.set(job.id, interval);
			this._api.log(`Scheduled job "${job.name}" every ${minutes}m`);
		}
	}

	private buildRsyncCmd(job: BackupJob): string[] {
		const flags = ["-avz", "--progress"];
		if (job.compress) flags.push("--compress");
		if (job.deleteOrphans) flags.push("--delete");
		for (const ex of job.excludes) flags.push(`--exclude=${ex}`);

		const destPath = job.destination;

		if (job.type === "local") {
			return ["rsync", ...flags, job.source, destPath];
		}

		// SSH mode
		const sshOpts = [
			`-p ${job.port}`,
			"-o StrictHostKeyChecking=no",
			"-o ConnectTimeout=30",
		];
		if (job.identityFile) sshOpts.push(`-i ${job.identityFile}`);
		flags.push(`-e 'ssh ${sshOpts.join(" ")}'`);

		const src = job.source.includes("@")
			? job.source
			: `${job.user ?? "root"}@${job.host ?? ""}:${job.source}`;
		return ["rsync", ...flags, src, destPath];
	}

	private async executeJob(jobId: string): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job) return;

		if (activeRuns.get(jobId)?.running) {
			this._api.warn(`Job "${job.name}" is already running, skipping`);
			return;
		}

		this._api.log(`Starting backup: ${job.name}`);
		job.lastRun = new Date().toISOString();
		job.lastStatus = "running";
		job.lastLog = [];

		const cmd = this.buildRsyncCmd(job);
		const proc = spawn(cmd[0]!, cmd.slice(1), { shell: true });

		activeRuns.set(jobId, { jobId, running: true, pid: proc.pid });

		const log: string[] = [];
		proc.stdout?.on("data", (d: Buffer) => {
			log.push(d.toString().trim());
		});
		proc.stderr?.on("data", (d: Buffer) => {
			log.push(`[err] ${d.toString().trim()}`);
		});

		proc.on("close", async (code) => {
			job.lastStatus = code === 0 ? "success" : "failed";
			job.lastLog = log.slice(-100); // keep last 100 lines
			job.totalRuns = (job.totalRuns ?? 0) + 1;
			activeRuns.delete(jobId);
			this._api.log(`Backup "${job.name}" ${job.lastStatus} (exit ${code})`);
			await this.saveJobs();
		});
	}

	// ---- GET /backup/jobs ----
	@Route("GET", "/jobs")
	async listJobs() {
		return {
			jobs: [...this.jobs.values()].map((j) => ({
				id: j.id,
				name: j.name,
				type: j.type,
				source: j.source,
				schedule: j.schedule,
				lastRun: j.lastRun,
				lastStatus: j.lastStatus,
				totalRuns: j.totalRuns,
				running: activeRuns.get(j.id)?.running ?? false,
			})),
		};
	}

	// ---- POST /backup/jobs — create a job ----
	@Route("POST", "/jobs")
	async createJob(req: any, reply: any) {
		const result = CreateJobSchema.safeParse(req.body);
		if (!result.success) {
			reply.code(400);
			return { error: result.error.issues[0]?.message ?? "Invalid request" };
		}

		const input = result.data;
		const id = createHash("sha256")
			.update(`${input.name}:${input.source}:${Date.now()}`)
			.digest("hex")
			.slice(0, 10);

		const destDir = `archives/${id}`;
		await this._api.storage.mkdir(destDir);

		// Get absolute path for rsync dest
		const { resolve: pathResolve } = await import("node:path");
		const { resolve: appResolve } = await import("node:path");
		const storageBase = pathResolve(
			import.meta.dirname,
			"../../../storage/backup",
		);
		const destination = `${storageBase}/${destDir}`;

		const job: BackupJob = {
			...input,
			id,
			createdAt: new Date().toISOString(),
			lastRun: null,
			lastStatus: "never",
			lastLog: [],
			nextRun: null,
			totalRuns: 0,
			destination,
		};

		this.jobs.set(id, job);
		await this.saveJobs();

		if (job.schedule) this.scheduleJob(job);

		return {
			ok: true,
			job: { id, name: job.name, source: job.source, destination },
		};
	}

	// ---- GET /backup/jobs/:id ----
	@Route("GET", "/jobs/:id")
	async getJob(req: any, reply: any) {
		const job = this.jobs.get((req.params as { id: string }).id);
		if (!job) {
			reply.code(404);
			return { error: "Job not found" };
		}
		return { job, running: activeRuns.get(job.id)?.running ?? false };
	}

	// ---- POST /backup/jobs/:id/run — trigger manual run ----
	@Route("POST", "/jobs/:id/run")
	async runJob(req: any, reply: any) {
		const job = this.jobs.get((req.params as { id: string }).id);
		if (!job) {
			reply.code(404);
			return { error: "Job not found" };
		}
		if (activeRuns.get(job.id)?.running) {
			return { ok: false, message: "Job is already running" };
		}
		// Fire and forget — don't await
		this.executeJob(job.id);
		return { ok: true, message: `Backup "${job.name}" started`, jobId: job.id };
	}

	// ---- GET /backup/jobs/:id/logs ----
	@Route("GET", "/jobs/:id/logs")
	async jobLogs(req: any, reply: any) {
		const job = this.jobs.get((req.params as { id: string }).id);
		if (!job) {
			reply.code(404);
			return { error: "Job not found" };
		}
		return {
			jobId: job.id,
			name: job.name,
			status: job.lastStatus,
			log: job.lastLog,
		};
	}

	// ---- DELETE /backup/jobs/:id ----
	@Route("DELETE", "/jobs/:id")
	async deleteJob(req: any, reply: any) {
		const { id } = req.params as { id: string };
		if (!this.jobs.has(id)) {
			reply.code(404);
			return { error: "Job not found" };
		}

		// Stop scheduler if running
		const timer = this.schedulers.get(id);
		if (timer) {
			clearInterval(timer);
			this.schedulers.delete(id);
		}

		this.jobs.delete(id);
		await this.saveJobs();
		return { ok: true, message: "Job deleted" };
	}

	// ---- GET /backup/status — overall health ----
	@Route("GET", "/status")
	async status() {
		const jobs = [...this.jobs.values()];
		return {
			totalJobs: jobs.length,
			running: [...activeRuns.values()].filter((r) => r.running).length,
			lastSuccesses: jobs.filter((j) => j.lastStatus === "success").length,
			lastFailures: jobs.filter((j) => j.lastStatus === "failed").length,
			rsyncAvailable: !!tryCommand("which rsync"),
			sshAvailable: !!tryCommand("which ssh"),
		};
	}
}

function tryCommand(cmd: string): string {
	try {
		return execSync(cmd, { encoding: "utf8" }).trim();
	} catch {
		return "";
	}
}
