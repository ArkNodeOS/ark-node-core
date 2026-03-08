import { useState } from "react";
import { apiPost, useApi } from "../hooks/useApi.ts";

interface EmailAccount {
	id: string;
	label: string;
	provider: string;
	username: string;
	unread: number;
}

interface EmailMessage {
	id: string;
	from: string;
	subject: string;
	date: string;
	account: string;
	accountLabel: string;
	preview?: string;
}

interface AccountsResponse {
	accounts: EmailAccount[];
}

interface InboxResponse {
	messages: EmailMessage[];
}

const PROVIDERS = [
	{ value: "gmail", label: "Gmail" },
	{ value: "yahoo", label: "Yahoo Mail" },
	{ value: "outlook", label: "Outlook / Hotmail" },
	{ value: "icloud", label: "iCloud Mail" },
	{ value: "hotmail", label: "Hotmail" },
	{ value: "aol", label: "AOL Mail" },
];

function formatDate(dateStr: string) {
	try {
		const d = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		if (diff < 60_000) return "just now";
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		return d.toLocaleDateString();
	} catch {
		return dateStr;
	}
}

export default function EmailInbox() {
	const {
		data: accountsData,
		loading: acctLoading,
		refetch: refetchAccounts,
	} = useApi<AccountsResponse>("/email/accounts");
	const {
		data: inboxData,
		loading: inboxLoading,
		refetch: refetchInbox,
	} = useApi<InboxResponse>("/email/inbox");

	const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
	const [showAddAccount, setShowAddAccount] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Add account form
	const [acctLabel, setAcctLabel] = useState("");
	const [acctProvider, setAcctProvider] = useState("gmail");
	const [acctUsername, setAcctUsername] = useState("");
	const [acctPassword, setAcctPassword] = useState("");
	const [adding, setAdding] = useState(false);

	const accounts = accountsData?.accounts ?? [];
	const allMessages = inboxData?.messages ?? [];
	const messages = selectedAccount
		? allMessages.filter((m) => m.account === selectedAccount)
		: allMessages;

	const handleAddAccount = async () => {
		if (!acctLabel.trim() || !acctUsername.trim() || !acctPassword) return;
		setAdding(true);
		setError(null);
		try {
			await apiPost("/email/accounts", {
				label: acctLabel.trim(),
				provider: acctProvider,
				username: acctUsername.trim(),
				password: acctPassword,
			});
			setAcctLabel("");
			setAcctProvider("gmail");
			setAcctUsername("");
			setAcctPassword("");
			setShowAddAccount(false);
			await refetchAccounts();
			await refetchInbox();
		} catch (e) {
			setError(String(e));
		} finally {
			setAdding(false);
		}
	};

	return (
		<div className="p-6 space-y-6 animate-fade-in">
			{/* Header */}
			<div>
				<h1 className="font-serif text-3xl text-gold-gradient mb-1">
					Epistulae
				</h1>
				<p className="text-ark-muted text-sm font-sans tracking-wide">
					Nuntius · Unified Inbox
				</p>
				<div className="divider-gold mt-3" />
			</div>

			{error && (
				<div className="bg-red-900/20 border border-red-500/30 rounded-ark px-4 py-3 text-red-400 text-sm font-sans">
					{error}
				</div>
			)}

			<div className="flex flex-col lg:flex-row gap-6">
				{/* Account Sidebar */}
				<div className="lg:w-64 shrink-0 space-y-3">
					<div className="flex items-center justify-between">
						<h2 className="font-serif text-lg text-ark-ivory">Accounts</h2>
						<button
							onClick={() => setShowAddAccount(true)}
							className="btn-gold text-xs px-3 py-1.5"
						>
							+ Add
						</button>
					</div>

					{acctLoading ? (
						<p className="text-ark-muted text-sm font-sans">Loading…</p>
					) : (
						<div className="space-y-1">
							{/* All accounts option */}
							<button
								onClick={() => setSelectedAccount(null)}
								className={`w-full flex items-center justify-between px-3 py-2.5 rounded-ark text-left border transition-all ${
									selectedAccount === null
										? "bg-ark-gold/10 border-ark-gold/30 text-ark-gold"
										: "border-transparent text-ark-muted hover:bg-ark-card hover:border-ark-border"
								}`}
							>
								<div className="flex items-center gap-2">
									<span className="text-base">✉</span>
									<span className="font-sans text-sm">All Accounts</span>
								</div>
								{allMessages.length > 0 && (
									<span className="text-xs bg-ark-gold/20 text-ark-gold rounded-full px-2 py-0.5">
										{allMessages.length}
									</span>
								)}
							</button>

							{accounts.map((acct) => (
								<button
									key={acct.id}
									onClick={() => setSelectedAccount(acct.id)}
									className={`w-full flex items-center justify-between px-3 py-2.5 rounded-ark text-left border transition-all ${
										selectedAccount === acct.id
											? "bg-ark-gold/10 border-ark-gold/30 text-ark-gold"
											: "border-transparent text-ark-muted hover:bg-ark-card hover:border-ark-border"
									}`}
								>
									<div className="min-w-0">
										<div className="font-sans text-sm text-ark-ivory truncate">
											{acct.label}
										</div>
										<div className="text-[10px] text-ark-muted truncate">
											{acct.username}
										</div>
									</div>
									{acct.unread > 0 && (
										<span className="ml-2 shrink-0 text-xs bg-ark-gold text-ark-bg rounded-full px-2 py-0.5 font-sans font-semibold">
											{acct.unread}
										</span>
									)}
								</button>
							))}

							{accounts.length === 0 && !acctLoading && (
								<p className="text-ark-muted text-xs font-sans text-center py-4">
									No accounts yet.
								</p>
							)}
						</div>
					)}
				</div>

				{/* Main Inbox Panel */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between mb-4">
						<h2 className="font-serif text-lg text-ark-ivory">
							{selectedAccount
								? (accounts.find((a) => a.id === selectedAccount)?.label ??
									"Inbox")
								: "All Messages"}
						</h2>
						<button
							onClick={() => {
								refetchInbox();
								refetchAccounts();
							}}
							className="btn-ghost text-xs px-3 py-1.5"
						>
							↻ Refresh
						</button>
					</div>

					{inboxLoading ? (
						<div className="text-center py-16 text-ark-muted font-sans">
							Loading messages…
						</div>
					) : messages.length === 0 ? (
						<div className="text-center py-16 space-y-3 animate-fade-in">
							<div className="text-6xl opacity-40">✉</div>
							<p className="font-serif text-2xl text-ark-ivory">
								Omnia Silentia
							</p>
							<p className="text-ark-muted font-sans text-sm">
								All is quiet. No messages here.
							</p>
							{accounts.length === 0 && (
								<button
									onClick={() => setShowAddAccount(true)}
									className="btn-gold mt-4"
								>
									Add an Account
								</button>
							)}
						</div>
					) : (
						<div className="space-y-2">
							{messages.map((msg) => (
								<div
									key={msg.id}
									className="ark-card p-4 hover:border-ark-gold/20 transition-all cursor-pointer animate-fade-in"
								>
									<div className="flex items-start justify-between gap-3 flex-wrap">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<span className="font-sans font-semibold text-ark-ivory text-sm truncate">
													{msg.from}
												</span>
												<span className="text-[10px] font-sans bg-ark-gold/10 text-ark-gold border border-ark-gold/20 rounded px-1.5 py-0.5 shrink-0">
													{msg.accountLabel}
												</span>
											</div>
											<p className="text-ark-ivory text-sm mt-0.5 truncate">
												{msg.subject}
											</p>
											{msg.preview && (
												<p className="text-ark-muted text-xs mt-0.5 truncate">
													{msg.preview}
												</p>
											)}
										</div>
										<span className="text-ark-muted text-xs font-sans shrink-0 mt-0.5">
											{formatDate(msg.date)}
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Add Account Modal */}
			{showAddAccount && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
					onClick={(e) => {
						if (e.target === e.currentTarget) setShowAddAccount(false);
					}}
				>
					<div className="ark-card p-6 w-full max-w-md space-y-4 animate-slide-up">
						<h3 className="font-serif text-xl text-ark-ivory">
							Add Email Account
						</h3>
						<div className="space-y-3">
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
									Label
								</label>
								<input
									type="text"
									value={acctLabel}
									onChange={(e) => setAcctLabel(e.target.value)}
									placeholder="e.g. Personal, Work"
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
								/>
							</div>
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
									Provider
								</label>
								<select
									value={acctProvider}
									onChange={(e) => setAcctProvider(e.target.value)}
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
								>
									{PROVIDERS.map((p) => (
										<option key={p.value} value={p.value}>
											{p.label}
										</option>
									))}
								</select>
							</div>
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
									Username / Email
								</label>
								<input
									type="email"
									value={acctUsername}
									onChange={(e) => setAcctUsername(e.target.value)}
									placeholder="you@example.com"
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
								/>
							</div>
							<div>
								<label className="text-[10px] text-ark-muted font-sans uppercase tracking-widest block mb-1">
									Password / App Password
								</label>
								<input
									type="password"
									value={acctPassword}
									onChange={(e) => setAcctPassword(e.target.value)}
									placeholder="••••••••"
									className="w-full bg-ark-bg border border-ark-border rounded-ark px-3 py-2 text-ark-ivory font-sans text-sm focus:outline-none focus:border-ark-gold/50"
								/>
							</div>
						</div>
						<div className="flex gap-3">
							<button
								onClick={handleAddAccount}
								disabled={
									adding ||
									!acctLabel.trim() ||
									!acctUsername.trim() ||
									!acctPassword
								}
								className="btn-gold flex-1 disabled:opacity-50"
							>
								{adding ? "Adding…" : "Add Account"}
							</button>
							<button
								onClick={() => setShowAddAccount(false)}
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
