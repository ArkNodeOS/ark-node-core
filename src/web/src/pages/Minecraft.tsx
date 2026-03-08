import { useEffect, useRef, useState } from "react";
import { apiPost, useApi } from "../hooks/useApi.ts";

interface MinecraftStatus {
	running: boolean;
	version?: string;
	memory?: string;
	gamemode?: string;
	difficulty?: string;
	ip?: string;
	uptime?: string;
}

interface MinecraftLogs {
	lines: string[];
}

export default function Minecraft() {
	const {
		data: status,
		loading,
		refetch,
	} = useApi<MinecraftStatus>("/minecraft/status");
	const [actionLoading, setActionLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [logs, setLogs] = useState<string[]>([]);
	const logsRef = useRef<HTMLDivElement>(null);

	// Config form state
	const [version, setVersion] = useState("LATEST");
	const [memory, setMemory] = useState("2G");
	const [gamemode, setGamemode] = useState("survival");
	const [difficulty, setDifficulty] = useState("normal");

	// Auto-refresh logs when running
	useEffect(() => {
		if (!status?.running) return;
		const fetchLogs = async () => {
			try {
				const BASE = import.meta.env.DEV ? "/api" : "";
				const res = await fetch(`${BASE}/minecraft/logs`);
				if (res.ok) {
					const d: MinecraftLogs = await res.json();
					setLogs(d.lines ?? []);
					setTimeout(() => {
						logsRef.current?.scrollTo({
							top: logsRef.current.scrollHeight,
							behavior: "smooth",
						});
					}, 50);
				}
			} catch {}
		};
		fetchLogs();
		const interval = setInterval(fetchLogs, 5000);
		return () => clearInterval(interval);
	}, [status?.running]);

	const handleStart = async () => {
		setActionLoading(true);
		setError(null);
		try {
			await apiPost("/minecraft/start", {
				version,
				memory,
				gamemode,
				difficulty,
			});
			await refetch();
		} catch (e) {
			setError(String(e));
		} finally {
			setActionLoading(false);
		}
	};

	const handleStop = async () => {
		setActionLoading(true);
		setError(null);
		try {
			await apiPost("/minecraft/stop", {});
			setLogs([]);
			await refetch();
		} catch (e) {
			setError(String(e));
		} finally {
			setActionLoading(false);
		}
	};

	return (
		<div className="p-6 space-y-6 animate-fade-in">
			{/* Header */}
			<div>
				<h1 className="font-serif text-3xl text-gold-gradient mb-1">
					Minecraft
				</h1>
				<p className="text-ark-muted text-sm font-sans tracking-wide">
					Ludus · Server Control
				</p>
				<div className="divider-gold mt-3" />
			</div>

			{error && (
				<div className="bg-red-900/20 border border-red-500/30 rounded-ark px-4 py-3 text-red-400 text-sm font-sans">
					{error}
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Status Card */}
				<div className="ark-card p-6 space-y-4 animate-slide-up">
					<div className="flex items-center justify-between">
						<h2 className="font-serif text-xl text-ark-ivory">Server Status</h2>
						{loading && (
							<span className="text-ark-muted text-xs font-sans">
								refreshing…
							</span>
						)}
					</div>

					<div className="flex items-center gap-4">
						<div
							className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all ${
								status?.running
									? "border-green-500 bg-green-500/10 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
									: "border-ark-border bg-ark-card"
							}`}
						>
							<span className="text-2xl">{status?.running ? "▶" : "■"}</span>
						</div>
						<div>
							<div
								className={`font-serif text-2xl ${status?.running ? "text-green-400" : "text-ark-muted"}`}
							>
								{loading ? "—" : status?.running ? "Running" : "Stopped"}
							</div>
							{status?.running && status.uptime && (
								<div className="text-ark-muted text-xs font-sans mt-0.5">
									Up {status.uptime}
								</div>
							)}
						</div>
					</div>

					{status?.running && (
						<div className="grid grid-cols-2 gap-3 pt-2">
							{[
								["Version", status.version ?? "—"],
								["Memory", status.memory ?? "—"],
								["Gamemode", status.gamemode ?? "—"],
								["Difficulty", status.difficulty ?? "—"],
							].map(([k, v]) => (
								<div
									key={k}
									className="bg-ark-bg/50 rounded-ark px-3 py-2 border border-ark-border"
								>
									<div className="text-[10px] text-ark-muted font-sans uppercase tracking-widest">
										{k}
									</div>
									<div className="text-ark-ivory font-sans text-sm capitalize">
										{v}
									</div>
								</div>
							))}
						</div>
					)}

					<div className="flex gap-3 pt-2">
						{!status?.running ? (
							<button
								onClick={handleStart}
								disabled={actionLoading}
								className="btn-gold flex-1 disabled:opacity-50"
							>
								{actionLoading ? "Starting…" : "▶ Start Server"}
							</button>
						) : (
							<button
								onClick={handleStop}
								disabled={actionLoading}
								className="btn-ghost flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
							>
								{actionLoading ? "Stopping…" : "■ Stop Server"}
							</button>
						)}
					</div>
				</div>

				{/* Config Card */}
				<div
					className="ark-card p-6 space-y-4 animate-slide-up"
					style={{ animationDelay: "0.1s" }}
				>
					<h2 className="font-serif text-xl text-ark-ivory">Configuration</h2>
					<p className="text-ark-muted text-xs font-sans">
						Applied on next start
					</p>

					<div className="space-y-3">
						<div>
							<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
								Version
							</label>
							<input
								type="text"
								value={version}
								onChange={(e) => setVersion(e.target.value)}
								placeholder="LATEST or e.g. 1.21.1"
								className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
							/>
						</div>
						<div>
							<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
								Memory
							</label>
							<select
								value={memory}
								onChange={(e) => setMemory(e.target.value)}
								className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
							>
								{["1G", "2G", "4G", "8G"].map((m) => (
									<option key={m} value={m}>
										{m}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
								Gamemode
							</label>
							<select
								value={gamemode}
								onChange={(e) => setGamemode(e.target.value)}
								className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
							>
								{["survival", "creative", "adventure"].map((m) => (
									<option key={m} value={m} className="capitalize">
										{m}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
								Difficulty
							</label>
							<select
								value={difficulty}
								onChange={(e) => setDifficulty(e.target.value)}
								className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
							>
								{["peaceful", "easy", "normal", "hard"].map((m) => (
									<option key={m} value={m} className="capitalize">
										{m}
									</option>
								))}
							</select>
						</div>
					</div>
				</div>
			</div>

			{/* Connection Info */}
			{status?.running && status.ip && (
				<div className="ark-card p-5 border-ark-gold/20 animate-slide-up">
					<div className="flex items-center gap-3">
						<span className="text-2xl">🌐</span>
						<div>
							<div className="text-[10px] text-ark-muted font-sans uppercase tracking-widest">
								Connect
							</div>
							<div className="font-mono text-ark-gold text-lg">
								{status.ip}:25565
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Live Logs */}
			<div
				className="ark-card p-5 space-y-3 animate-slide-up"
				style={{ animationDelay: "0.2s" }}
			>
				<div className="flex items-center justify-between">
					<h2 className="font-serif text-xl text-ark-ivory">Live Logs</h2>
					{status?.running && (
						<span className="flex items-center gap-1.5 text-xs text-green-400 font-sans">
							<span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
							Live · refresh 5s
						</span>
					)}
				</div>
				<div
					ref={logsRef}
					className="bg-black/60 border border-ark-border rounded-ark p-4 h-64 overflow-y-auto font-mono text-xs text-green-300 space-y-0.5"
					style={{ scrollbarWidth: "thin" }}
				>
					{logs.length === 0 ? (
						<span className="text-ark-muted italic">
							{status?.running ? "Waiting for logs…" : "Server is not running."}
						</span>
					) : (
						logs.map((line, i) => (
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
	);
}
