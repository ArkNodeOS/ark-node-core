import { useState } from "react";
import { apiPost, useApi } from "../hooks/useApi.ts";

interface BackupJob {
	id: string;
	name: string;
	source: string;
	type: "local" | "ssh";
	scheduleMinutes?: number;
	lastRun?: string;
	status: "never" | "success" | "failed" | "running";
	excludes?: string;
}

interface BackupJobsResponse {
	jobs: BackupJob[];
}

function StatusBadge({ status }: { status: BackupJob["status"] }) {
	const styles: Record<BackupJob["status"], string> = {
		never: "text-ark-muted border-ark-border bg-ark-border/20",
		success: "text-green-400 border-green-500/40 bg-green-500/10",
		failed: "text-red-400 border-red-500/40 bg-red-500/10",
		running: "text-ark-gold border-ark-gold/40 bg-ark-gold/10 animate-pulse",
	};
	return (
		<span
			className={`text-[10px] font-sans uppercase tracking-widest border rounded px-2 py-0.5 ${styles[status]}`}
		>
			{status}
		</span>
	);
}

export default function BackupManager() {
	const { data, loading, refetch } = useApi<BackupJobsResponse>("/backup/jobs");
	const [error, setError] = useState<string | null>(null);

	// New job form
	const [showNewJob, setShowNewJob] = useState(false);
	const [jobName, setJobName] = useState("");
	const [jobType, setJobType] = useState<"local" | "ssh">("local");
	const [jobSource, setJobSource] = useState("");
	const [jobSchedule, setJobSchedule] = useState("");
	const [jobExcludes, setJobExcludes] = useState("");
	const [creating, setCreating] = useState(false);

	// Logs modal
	const [logsJobId, setLogsJobId] = useState<string | null>(null);
	const [logsJobName, setLogsJobName] = useState("");
	const [logsContent, setLogsContent] = useState<string[]>([]);
	const [logsLoading, setLogsLoading] = useState(false);

	const handleCreateJob = async () => {
		if (!jobName.trim() || !jobSource.trim()) return;
		setCreating(true);
		setError(null);
		try {
			await apiPost("/backup/jobs", {
				name: jobName.trim(),
				type: jobType,
				source: jobSource.trim(),
				scheduleMinutes: jobSchedule ? parseInt(jobSchedule, 10) : undefined,
				excludes: jobExcludes.trim() || undefined,
			});
			setJobName("");
			setJobType("local");
			setJobSource("");
			setJobSchedule("");
			setJobExcludes("");
			setShowNewJob(false);
			await refetch();
		} catch (e) {
			setError(String(e));
		} finally {
			setCreating(false);
		}
	};

	const handleRunNow = async (jobId: string) => {
		setError(null);
		try {
			await apiPost(`/backup/jobs/${jobId}/run`, {});
			await refetch();
		} catch (e) {
			setError(String(e));
		}
	};

	const handleDeleteJob = async (job: BackupJob) => {
		if (!confirm(`Delete backup job "${job.name}"?`)) return;
		setError(null);
		try {
			const BASE = import.meta.env.DEV ? "/api" : "";
			await fetch(`${BASE}/backup/jobs/${job.id}`, { method: "DELETE" });
			await refetch();
		} catch (e) {
			setError(String(e));
		}
	};

	const handleViewLogs = async (job: BackupJob) => {
		setLogsJobId(job.id);
		setLogsJobName(job.name);
		setLogsContent([]);
		setLogsLoading(true);
		try {
			const BASE = import.meta.env.DEV ? "/api" : "";
			const res = await fetch(`${BASE}/backup/jobs/${job.id}/logs`);
			if (res.ok) {
				const d = await res.json();
				setLogsContent(d.lines ?? []);
			}
		} catch (e) {
			setLogsContent([`Error: ${String(e)}`]);
		} finally {
			setLogsLoading(false);
		}
	};

	const jobs = data?.jobs ?? [];

	return (
		<div className="p-6 space-y-6 animate-fade-in">
			{/* Header */}
			<div>
				<h1 className="font-serif text-3xl text-gold-gradient mb-1">Backup</h1>
				<p className="text-ark-muted text-sm font-sans tracking-wide">
					Custodia · Job Manager
				</p>
				<div className="divider-gold mt-3" />
			</div>

			{error && (
				<div className="bg-red-900/20 border border-red-500/30 rounded-ark px-4 py-3 text-red-400 text-sm font-sans">
					{error}
				</div>
			)}

			{/* Jobs Header */}
			<div className="flex items-center justify-between">
				<h2 className="font-serif text-xl text-ark-ivory">
					Jobs{" "}
					{!loading && (
						<span className="text-ark-muted text-base">({jobs.length})</span>
					)}
				</h2>
				<button onClick={() => setShowNewJob(true)} className="btn-gold">
					+ New Job
				</button>
			</div>

			{/* Jobs List */}
			{loading ? (
				<div className="text-ark-muted font-sans text-sm py-6 text-center">
					Loading…
				</div>
			) : jobs.length === 0 ? (
				<div className="ark-card p-10 text-center space-y-2">
					<div className="text-5xl">💾</div>
					<p className="font-serif text-xl text-ark-ivory">No backup jobs</p>
					<p className="text-ark-muted text-sm font-sans">
						Create your first job to protect your data.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{jobs.map((job) => (
						<div key={job.id} className="ark-card p-5 animate-slide-up">
							<div className="flex items-start justify-between flex-wrap gap-3">
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-3 flex-wrap">
										<span className="font-serif text-lg text-ark-ivory">
											{job.name}
										</span>
										<StatusBadge status={job.status} />
										<span className="text-[10px] font-sans text-ark-muted uppercase border border-ark-border/50 rounded px-1.5 py-0.5">
											{job.type}
										</span>
									</div>
									<div className="mt-1 font-mono text-xs text-ark-muted truncate">
										{job.source}
									</div>
									<div className="flex gap-4 mt-1.5 text-[11px] text-ark-muted font-sans flex-wrap">
										{job.scheduleMinutes != null && (
											<span>Every {job.scheduleMinutes}m</span>
										)}
										{job.lastRun && <span>Last run: {job.lastRun}</span>}
										{!job.lastRun && <span>Never run</span>}
									</div>
								</div>
								<div className="flex items-center gap-2 flex-wrap shrink-0">
									<button
										onClick={() => handleRunNow(job.id)}
										disabled={job.status === "running"}
										className="btn-gold text-xs px-3 py-1.5 disabled:opacity-50"
									>
										▶ Run Now
									</button>
									<button
										onClick={() => handleViewLogs(job)}
										className="btn-ghost text-xs px-3 py-1.5"
									>
										Logs
									</button>
									<button
										onClick={() => handleDeleteJob(job)}
										className="btn-ghost text-xs px-3 py-1.5 text-red-400 hover:bg-red-500/10 border-red-500/20"
									>
										✕
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* New Job Modal */}
			{showNewJob && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
					onClick={(e) => {
						if (e.target === e.currentTarget) setShowNewJob(false);
					}}
				>
					<div className="ark-card p-6 w-full max-w-md space-y-4 animate-slide-up overflow-y-auto max-h-[90vh]">
						<h3 className="font-serif text-xl text-ark-ivory">
							New Backup Job
						</h3>
						<div className="space-y-3">
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
									Job Name
								</label>
								<input
									type="text"
									value={jobName}
									onChange={(e) => setJobName(e.target.value)}
									placeholder="e.g. Home Directory"
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
								/>
							</div>
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
									Type
								</label>
								<select
									value={jobType}
									onChange={(e) =>
										setJobType(e.target.value as "local" | "ssh")
									}
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
								>
									<option value="local">Local</option>
									<option value="ssh">SSH / Remote</option>
								</select>
							</div>
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
									Source Path
								</label>
								<input
									type="text"
									value={jobSource}
									onChange={(e) => setJobSource(e.target.value)}
									placeholder="/home/user or user@host:/path"
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-mono text-sm focus:outline-none focus:border-ark-gold/50"
								/>
							</div>
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
									Schedule (minutes, optional)
								</label>
								<input
									type="number"
									value={jobSchedule}
									onChange={(e) => setJobSchedule(e.target.value)}
									placeholder="e.g. 1440 for daily"
									min="1"
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
								/>
							</div>
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
									Excludes (one per line)
								</label>
								<textarea
									value={jobExcludes}
									onChange={(e) => setJobExcludes(e.target.value)}
									placeholder="node_modules&#10;.git&#10;*.log"
									rows={3}
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-mono text-sm focus:outline-none focus:border-ark-gold/50 resize-none"
								/>
							</div>
						</div>
						<div className="flex gap-3">
							<button
								onClick={handleCreateJob}
								disabled={creating || !jobName.trim() || !jobSource.trim()}
								className="btn-gold flex-1 disabled:opacity-50"
							>
								{creating ? "Creating…" : "Create Job"}
							</button>
							<button
								onClick={() => setShowNewJob(false)}
								className="btn-ghost flex-1"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Logs Modal */}
			{logsJobId && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
					onClick={(e) => {
						if (e.target === e.currentTarget) setLogsJobId(null);
					}}
				>
					<div className="ark-card p-6 w-full max-w-2xl space-y-4 animate-slide-up">
						<div className="flex items-center justify-between">
							<h3 className="font-serif text-xl text-ark-ivory">
								Logs — {logsJobName}
							</h3>
							<button
								onClick={() => setLogsJobId(null)}
								className="text-ark-muted hover:text-ark-ivory text-lg"
							>
								✕
							</button>
						</div>
						<div className="bg-black/60 border border-ark-border rounded-ark p-4 h-72 overflow-y-auto font-mono text-xs text-green-300 space-y-0.5">
							{logsLoading ? (
								<span className="text-ark-muted italic">Loading…</span>
							) : logsContent.length === 0 ? (
								<span className="text-ark-muted italic">
									No logs available.
								</span>
							) : (
								logsContent.map((line, i) => (
									<div
										key={i}
										className="leading-relaxed whitespace-pre-wrap break-all"
									>
										{line}
									</div>
								))
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
