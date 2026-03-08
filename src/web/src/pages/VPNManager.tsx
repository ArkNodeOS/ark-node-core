import { useState } from "react";
import { apiPost, useApi } from "../hooks/useApi.ts";

interface VPNPeer {
	id: string;
	name: string;
	ip: string;
	connected: boolean;
	enabled: boolean;
	rxBytes?: number;
	txBytes?: number;
	lastHandshake?: string;
}

interface VPNStatus {
	running: boolean;
	peerCount: number;
	activePeers: number;
	peers: VPNPeer[];
}

function formatBytes(b?: number) {
	if (b == null) return "—";
	if (b < 1024) return `${b} B`;
	if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
	return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function VPNManager() {
	const { data: status, loading, refetch } = useApi<VPNStatus>("/vpn/status");
	const [actionLoading, setActionLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Start form
	const [password, setPassword] = useState("");
	const [host, setHost] = useState("");

	// Add peer modal
	const [showAddPeer, setShowAddPeer] = useState(false);
	const [newPeerName, setNewPeerName] = useState("");
	const [addingPeer, setAddingPeer] = useState(false);

	const handleStart = async () => {
		setActionLoading(true);
		setError(null);
		try {
			await apiPost("/vpn/start", { password, host });
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
			await apiPost("/vpn/stop", {});
			await refetch();
		} catch (e) {
			setError(String(e));
		} finally {
			setActionLoading(false);
		}
	};

	const handleAddPeer = async () => {
		if (!newPeerName.trim()) return;
		setAddingPeer(true);
		setError(null);
		try {
			await apiPost("/vpn/peers", { name: newPeerName.trim() });
			setNewPeerName("");
			setShowAddPeer(false);
			await refetch();
		} catch (e) {
			setError(String(e));
		} finally {
			setAddingPeer(false);
		}
	};

	const handleTogglePeer = async (peer: VPNPeer) => {
		try {
			await apiPost(
				`/vpn/peers/${peer.id}/${peer.enabled ? "disable" : "enable"}`,
				{},
			);
			await refetch();
		} catch (e) {
			setError(String(e));
		}
	};

	const handleDeletePeer = async (peer: VPNPeer) => {
		if (!confirm(`Delete peer "${peer.name}"?`)) return;
		try {
			const BASE = import.meta.env.DEV ? "/api" : "";
			await fetch(`${BASE}/vpn/peers/${peer.id}`, { method: "DELETE" });
			await refetch();
		} catch (e) {
			setError(String(e));
		}
	};

	const BASE = import.meta.env.DEV ? "/api" : "";

	return (
		<div className="p-6 space-y-6 animate-fade-in">
			{/* Header */}
			<div>
				<h1 className="font-serif text-3xl text-gold-gradient mb-1">VPN</h1>
				<p className="text-ark-muted text-sm font-sans tracking-wide">
					Tutela · WireGuard Peer Manager
				</p>
				<div className="divider-gold mt-3" />
			</div>

			{error && (
				<div className="bg-red-900/20 border border-red-500/30 rounded-ark px-4 py-3 text-red-400 text-sm font-sans">
					{error}
				</div>
			)}

			{/* Status Card */}
			<div className="ark-card p-6 animate-slide-up">
				<div className="flex items-start justify-between flex-wrap gap-4">
					<div className="flex items-center gap-4">
						<div
							className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all ${
								status?.running
									? "border-green-500 bg-green-500/10 shadow-[0_0_16px_rgba(34,197,94,0.25)]"
									: "border-ark-border bg-ark-card"
							}`}
						>
							<span className="text-xl">🔒</span>
						</div>
						<div>
							<div
								className={`font-serif text-2xl ${status?.running ? "text-green-400" : "text-ark-muted"}`}
							>
								{loading ? "—" : status?.running ? "Active" : "Stopped"}
							</div>
							{status?.running && (
								<div className="flex gap-4 mt-1">
									<span className="text-ark-muted text-xs font-sans">
										{status.peerCount} peers
									</span>
									<span className="text-green-400 text-xs font-sans">
										{status.activePeers} connected
									</span>
								</div>
							)}
						</div>
					</div>
					<div className="flex gap-3">
						{status?.running ? (
							<button
								onClick={handleStop}
								disabled={actionLoading}
								className="btn-ghost border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
							>
								{actionLoading ? "Stopping…" : "Stop VPN"}
							</button>
						) : null}
					</div>
				</div>

				{/* Start form (only when stopped) */}
				{!status?.running && (
					<div className="mt-5 pt-5 border-t border-ark-border space-y-3">
						<p className="text-ark-muted text-xs font-sans uppercase tracking-widest">
							Start VPN
						</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
									Host / Interface
								</label>
								<input
									type="text"
									value={host}
									onChange={(e) => setHost(e.target.value)}
									placeholder="wg0 or 0.0.0.0"
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
								/>
							</div>
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
									Password
								</label>
								<input
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="sudo password"
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
								/>
							</div>
						</div>
						<button
							onClick={handleStart}
							disabled={actionLoading}
							className="btn-gold disabled:opacity-50"
						>
							{actionLoading ? "Starting…" : "▶ Start VPN"}
						</button>
					</div>
				)}
			</div>

			{/* Peers */}
			<div
				className="ark-card p-6 space-y-4 animate-slide-up"
				style={{ animationDelay: "0.1s" }}
			>
				<div className="flex items-center justify-between">
					<h2 className="font-serif text-xl text-ark-ivory">Peers</h2>
					<button
						onClick={() => setShowAddPeer(true)}
						className="btn-gold text-sm"
					>
						+ Add Peer
					</button>
				</div>

				{!status?.peers || status.peers.length === 0 ? (
					<div className="text-center py-10 text-ark-muted font-sans text-sm">
						<div className="text-4xl mb-3">🔑</div>
						<p>No peers configured.</p>
						<p className="text-xs mt-1 opacity-60">
							Add a peer to get started.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{status.peers.map((peer) => (
							<div
								key={peer.id}
								className={`bg-ark-bg/50 border rounded-ark px-4 py-4 transition-all ${
									peer.enabled
										? "border-ark-border"
										: "border-ark-border/40 opacity-60"
								}`}
							>
								<div className="flex items-start justify-between flex-wrap gap-3">
									<div className="flex items-center gap-3">
										<div
											className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${
												peer.connected
													? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]"
													: "bg-ark-border"
											}`}
										/>
										<div>
											<div className="font-serif text-ark-ivory">
												{peer.name}
											</div>
											<div className="font-mono text-xs text-ark-muted mt-0.5">
												{peer.ip}
											</div>
											{peer.connected && (
												<div className="flex gap-3 mt-1 text-[10px] text-ark-muted font-sans">
													<span>↓ {formatBytes(peer.rxBytes)}</span>
													<span>↑ {formatBytes(peer.txBytes)}</span>
													{peer.lastHandshake && (
														<span>last {peer.lastHandshake}</span>
													)}
												</div>
											)}
										</div>
									</div>
									<div className="flex items-center gap-2 flex-wrap">
										{/* QR Code */}
										<a
											href={`${BASE}/vpn/peers/${peer.id}/qr`}
											target="_blank"
											rel="noopener noreferrer"
											className="btn-ghost text-xs px-3 py-1.5"
											title="QR Code"
										>
											⬡ QR
										</a>
										{/* Config download */}
										<a
											href={`${BASE}/vpn/peers/${peer.id}/config`}
											download
											className="btn-ghost text-xs px-3 py-1.5"
											title="Download config"
										>
											⬇ Config
										</a>
										{/* Enable/Disable toggle */}
										<button
											onClick={() => handleTogglePeer(peer)}
											className={`btn-ghost text-xs px-3 py-1.5 ${peer.enabled ? "text-ark-muted" : "text-ark-gold"}`}
										>
											{peer.enabled ? "Disable" : "Enable"}
										</button>
										{/* Delete */}
										<button
											onClick={() => handleDeletePeer(peer)}
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
			</div>

			{/* Add Peer Modal */}
			{showAddPeer && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
					onClick={(e) => {
						if (e.target === e.currentTarget) setShowAddPeer(false);
					}}
				>
					<div className="ark-card p-6 w-full max-w-sm space-y-4 animate-slide-up">
						<h3 className="font-serif text-xl text-ark-ivory">New Peer</h3>
						<div>
							<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
								Peer Name
							</label>
							<input
								type="text"
								value={newPeerName}
								onChange={(e) => setNewPeerName(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleAddPeer()}
								placeholder="e.g. phone, laptop"
								className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
							/>
						</div>
						<div className="flex gap-3">
							<button
								onClick={handleAddPeer}
								disabled={addingPeer || !newPeerName.trim()}
								className="btn-gold flex-1 disabled:opacity-50"
							>
								{addingPeer ? "Creating…" : "Create"}
							</button>
							<button
								onClick={() => setShowAddPeer(false)}
								className="btn-ghost flex-1"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
