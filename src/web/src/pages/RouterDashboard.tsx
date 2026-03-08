import { useState } from "react";
import { apiPost, useApi } from "../hooks/useApi.ts";

interface NetworkInfo {
	gateway: string;
	localIp: string;
	publicIp: string;
	dnsServers: string[];
}

interface Device {
	ip: string;
	mac: string;
	hostname?: string;
}

interface DevicesResponse {
	devices: Device[];
}

const FIREWALL_PRESETS = [
	{ label: "Block Telnet", rule: { type: "block", port: 23, protocol: "tcp", desc: "Block Telnet (port 23)" } },
	{ label: "Block SSH from WAN", rule: { type: "block-wan", port: 22, protocol: "tcp", desc: "Block SSH from WAN" } },
	{ label: "Allow HTTP/HTTPS", rule: { type: "allow", port: "80,443", protocol: "tcp", desc: "Allow HTTP/HTTPS" } },
];

export default function RouterDashboard() {
	const { data: netInfo, loading: netLoading, refetch: refetchNet } = useApi<NetworkInfo>("/router/network");
	const { data: devicesData, loading: devLoading } = useApi<DevicesResponse>("/router/devices");

	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	// DNS form
	const [dnsManual, setDnsManual] = useState("");
	const [dnsLoading, setDnsLoading] = useState(false);

	// Port forward form
	const [pfExtPort, setPfExtPort] = useState("");
	const [pfIntIp, setPfIntIp] = useState("");
	const [pfIntPort, setPfIntPort] = useState("");
	const [pfProto, setPfProto] = useState("tcp");
	const [pfLoading, setPfLoading] = useState(false);

	// Firewall
	const [fwLoading, setFwLoading] = useState(false);

	const flash = (msg: string) => {
		setSuccessMsg(msg);
		setTimeout(() => setSuccessMsg(null), 3000);
	};

	const handleUseArkDns = async () => {
		setDnsLoading(true);
		setError(null);
		try {
			await apiPost("/router/dns/use-ark", {});
			flash("Ark DNS applied");
			await refetchNet();
		} catch (e) {
			setError(String(e));
		} finally {
			setDnsLoading(false);
		}
	};

	const handleSetManualDns = async () => {
		if (!dnsManual.trim()) return;
		setDnsLoading(true);
		setError(null);
		try {
			await apiPost("/router/dns/set", { servers: dnsManual.split(",").map((s) => s.trim()).filter(Boolean) });
			setDnsManual("");
			flash("DNS updated");
			await refetchNet();
		} catch (e) {
			setError(String(e));
		} finally {
			setDnsLoading(false);
		}
	};

	const handleFirewallPreset = async (preset: typeof FIREWALL_PRESETS[0]) => {
		setFwLoading(true);
		setError(null);
		try {
			await apiPost("/router/firewall/rule", preset.rule);
			flash(`Rule applied: ${preset.rule.desc}`);
		} catch (e) {
			setError(String(e));
		} finally {
			setFwLoading(false);
		}
	};

	const handlePortForward = async () => {
		if (!pfExtPort || !pfIntIp || !pfIntPort) return;
		setPfLoading(true);
		setError(null);
		try {
			await apiPost("/router/portforward", {
				externalPort: parseInt(pfExtPort, 10),
				internalIp: pfIntIp,
				internalPort: parseInt(pfIntPort, 10),
				protocol: pfProto,
			});
			setPfExtPort(""); setPfIntIp(""); setPfIntPort(""); setPfProto("tcp");
			flash("Port forward created");
		} catch (e) {
			setError(String(e));
		} finally {
			setPfLoading(false);
		}
	};

	const devices = devicesData?.devices ?? [];

	return (
		<div className="p-6 space-y-6 animate-fade-in">
			{/* Header */}
			<div>
				<h1 className="font-serif text-3xl text-gold-gradient mb-1">Router</h1>
				<p className="text-ark-muted text-sm font-sans tracking-wide">Retis · Network Control Center</p>
				<div className="divider-gold mt-3" />
			</div>

			{error && (
				<div className="bg-red-900/20 border border-red-500/30 rounded-ark px-4 py-3 text-red-400 text-sm font-sans">
					{error}
				</div>
			)}
			{successMsg && (
				<div className="bg-green-900/20 border border-green-500/30 rounded-ark px-4 py-3 text-green-400 text-sm font-sans animate-fade-in">
					✓ {successMsg}
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Network Info */}
				<div className="ark-card p-6 space-y-4 animate-slide-up">
					<h2 className="font-serif text-xl text-ark-ivory">Network</h2>
					{netLoading ? (
						<p className="text-ark-muted font-sans text-sm">Loading…</p>
					) : (
						<div className="space-y-2">
							{[
								["Gateway", netInfo?.gateway ?? "—"],
								["Local IP", netInfo?.localIp ?? "—"],
								["Public IP", netInfo?.publicIp ?? "—"],
							].map(([k, v]) => (
								<div key={k} className="flex justify-between items-center py-2 border-b border-ark-border/40 last:border-0">
									<span className="text-ark-muted text-xs font-sans uppercase tracking-wider">{k}</span>
									<span className="font-mono text-sm text-ark-ivory">{v}</span>
								</div>
							))}
						</div>
					)}
				</div>

				{/* DNS */}
				<div className="ark-card p-6 space-y-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
					<h2 className="font-serif text-xl text-ark-ivory">DNS</h2>
					{!netLoading && netInfo?.dnsServers && (
						<div className="flex flex-wrap gap-2">
							{netInfo.dnsServers.map((s) => (
								<span key={s} className="font-mono text-xs bg-ark-bg border border-ark-border rounded px-2 py-1 text-ark-ivory">
									{s}
								</span>
							))}
						</div>
					)}
					<button
						onClick={handleUseArkDns}
						disabled={dnsLoading}
						className="btn-gold w-full disabled:opacity-50"
					>
						{dnsLoading ? "Applying…" : "✝ Use Ark DNS"}
					</button>
					<div className="divider-gold" />
					<div>
						<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">Manual DNS (comma-separated)</label>
						<div className="flex gap-2">
							<input
								type="text"
								value={dnsManual}
								onChange={(e) => setDnsManual(e.target.value)}
								placeholder="1.1.1.1, 8.8.8.8"
								className="flex-1 bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-mono text-sm focus:outline-none focus:border-ark-gold/50"
							/>
							<button
								onClick={handleSetManualDns}
								disabled={dnsLoading || !dnsManual.trim()}
								className="btn-ghost disabled:opacity-50"
							>
								Set
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Connected Devices */}
			<div className="ark-card p-6 space-y-4 animate-slide-up" style={{ animationDelay: "0.15s" }}>
				<h2 className="font-serif text-xl text-ark-ivory">
					Connected Devices
					{!devLoading && <span className="text-ark-muted text-base ml-2">({devices.length})</span>}
				</h2>
				{devLoading ? (
					<p className="text-ark-muted font-sans text-sm">Scanning…</p>
				) : devices.length === 0 ? (
					<p className="text-ark-muted font-sans text-sm text-center py-6">No devices found.</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm font-sans">
							<thead>
								<tr className="border-b border-ark-border text-left">
									<th className="pb-2 text-[10px] text-ark-muted uppercase tracking-widest font-normal pr-6">IP</th>
									<th className="pb-2 text-[10px] text-ark-muted uppercase tracking-widest font-normal pr-6">MAC</th>
									<th className="pb-2 text-[10px] text-ark-muted uppercase tracking-widest font-normal">Hostname</th>
								</tr>
							</thead>
							<tbody>
								{devices.map((d) => (
									<tr key={d.mac} className="border-b border-ark-border/30 hover:bg-ark-bg/50 transition-colors">
										<td className="py-2.5 pr-6 font-mono text-ark-gold">{d.ip}</td>
										<td className="py-2.5 pr-6 font-mono text-ark-muted text-xs">{d.mac}</td>
										<td className="py-2.5 text-ark-ivory">{d.hostname ?? "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Firewall Presets */}
				<div className="ark-card p-6 space-y-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
					<h2 className="font-serif text-xl text-ark-ivory">Quick Firewall Rules</h2>
					<div className="space-y-2">
						{FIREWALL_PRESETS.map((preset) => (
							<button
								key={preset.label}
								onClick={() => handleFirewallPreset(preset)}
								disabled={fwLoading}
								className="w-full btn-ghost text-left flex justify-between items-center disabled:opacity-50"
							>
								<span>{preset.label}</span>
								<span className="text-ark-gold text-xs">Apply →</span>
							</button>
						))}
					</div>
				</div>

				{/* Port Forward */}
				<div className="ark-card p-6 space-y-4 animate-slide-up" style={{ animationDelay: "0.25s" }}>
					<h2 className="font-serif text-xl text-ark-ivory">Port Forward</h2>
					<div className="space-y-3">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">Ext. Port</label>
								<input
									type="number"
									value={pfExtPort}
									onChange={(e) => setPfExtPort(e.target.value)}
									placeholder="8080"
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-mono text-sm focus:outline-none focus:border-ark-gold/50"
								/>
							</div>
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">Int. Port</label>
								<input
									type="number"
									value={pfIntPort}
									onChange={(e) => setPfIntPort(e.target.value)}
									placeholder="80"
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-mono text-sm focus:outline-none focus:border-ark-gold/50"
								/>
							</div>
						</div>
						<div>
							<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">Internal IP</label>
							<input
								type="text"
								value={pfIntIp}
								onChange={(e) => setPfIntIp(e.target.value)}
								placeholder="192.168.1.100"
								className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-mono text-sm focus:outline-none focus:border-ark-gold/50"
							/>
						</div>
						<div>
							<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">Protocol</label>
							<select
								value={pfProto}
								onChange={(e) => setPfProto(e.target.value)}
								className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
							>
								<option value="tcp">TCP</option>
								<option value="udp">UDP</option>
								<option value="both">Both</option>
							</select>
						</div>
						<button
							onClick={handlePortForward}
							disabled={pfLoading || !pfExtPort || !pfIntIp || !pfIntPort}
							className="btn-gold w-full disabled:opacity-50"
						>
							{pfLoading ? "Adding…" : "Add Port Forward"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
