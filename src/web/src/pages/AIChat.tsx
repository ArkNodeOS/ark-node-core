import { useEffect, useRef, useState } from "react";
import { apiPost } from "../hooks/useApi.ts";

interface Message {
	id: number;
	role: "user" | "assistant";
	content: string;
	loading?: boolean;
}

const GREETINGS = [
	"Speak, and I shall listen.",
	"Ask of me what you will.",
	"How may I serve you today?",
	"Your words are received.",
];

export default function AIChat() {
	const [messages, setMessages] = useState<Message[]>([
		{
			id: 0,
			role: "assistant",
			content: `Pax vobiscum. I am Solomon — your private AI, running wholly within your Ark. ${GREETINGS[Math.floor(Math.random() * GREETINGS.length)]}`,
		},
	]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	async function send() {
		const prompt = input.trim();
		if (!prompt || busy) return;
		setInput("");
		setBusy(true);

		const userMsg: Message = { id: Date.now(), role: "user", content: prompt };
		const loadingMsg: Message = {
			id: Date.now() + 1,
			role: "assistant",
			content: "",
			loading: true,
		};
		setMessages((prev) => [...prev, userMsg, loadingMsg]);

		try {
			// Try Solomon first (natural language routing), fall back to direct AI query
			const res = await apiPost<{ reply?: string; response?: string }>(
				"/solomon",
				{ message: prompt },
			).catch(() => apiPost<{ response: string }>("/ai/query", { prompt }));

			const content =
				(res as any).reply ??
				(res as any).response ??
				"I have no answer at this time.";
			setMessages((prev) =>
				prev.map((m) => (m.loading ? { ...m, content, loading: false } : m)),
			);
		} catch (e) {
			setMessages((prev) =>
				prev.map((m) =>
					m.loading
						? { ...m, content: `Error: ${String(e)}`, loading: false }
						: m,
				),
			);
		} finally {
			setBusy(false);
			inputRef.current?.focus();
		}
	}

	function onKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div
				className="px-6 md:px-10 py-5 border-b border-ark-border"
				style={{
					background: "rgba(19,13,6,0.8)",
					backdropFilter: "blur(12px)",
				}}
			>
				<div className="flex items-center gap-4 max-w-3xl">
					<div className="w-10 h-10 rounded-full bg-ark-card border border-ark-gold/30 flex items-center justify-center shadow-gold-subtle">
						<span className="text-ark-gold font-serif">✝</span>
					</div>
					<div>
						<h2 className="font-serif text-xl text-ark-ivory tracking-wide">
							Solomon
						</h2>
						<p className="text-[10px] text-ark-gold/50 tracking-[0.2em] uppercase font-sans">
							Sapientia · Private AI
						</p>
					</div>
				</div>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto px-4 md:px-10 py-8 space-y-6">
				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`flex gap-4 animate-slide-up ${msg.role === "user" ? "justify-end" : "justify-start"}`}
					>
						{msg.role === "assistant" && (
							<div className="w-8 h-8 rounded-full bg-ark-card border border-ark-gold/20 flex items-center justify-center text-ark-gold/70 text-sm shrink-0 mt-1">
								✝
							</div>
						)}
						<div
							className={`max-w-[78%] px-5 py-4 text-sm leading-relaxed font-sans ${
								msg.role === "user"
									? "bg-ark-gold/10 border border-ark-gold/30 text-ark-ivory rounded-ark-lg rounded-br-sm"
									: "ark-card text-ark-parchment rounded-ark-lg rounded-bl-sm"
							}`}
						>
							{msg.loading ? (
								<span className="flex gap-1.5 items-center h-4">
									{[0, 200, 400].map((d) => (
										<span
											key={d}
											className="w-1.5 h-1.5 rounded-full bg-ark-gold/50 animate-pulse-gold"
											style={{ animationDelay: `${d}ms` }}
										/>
									))}
								</span>
							) : (
								<span className="whitespace-pre-wrap">{msg.content}</span>
							)}
						</div>
						{msg.role === "user" && (
							<div className="w-8 h-8 rounded-full bg-ark-raised border border-ark-border flex items-center justify-center text-ark-muted text-xs shrink-0 mt-1">
								✦
							</div>
						)}
					</div>
				))}
				<div ref={bottomRef} />
			</div>

			{/* Input */}
			<div
				className="px-4 md:px-10 py-5 border-t border-ark-border"
				style={{ background: "rgba(13,8,4,0.9)", backdropFilter: "blur(16px)" }}
			>
				<div className="flex gap-3 items-end max-w-3xl mx-auto">
					<textarea
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={onKeyDown}
						placeholder="Speak to Solomon…"
						rows={1}
						className="flex-1 bg-ark-card border border-ark-border rounded-ark px-4 py-3 text-sm
                       text-ark-ivory placeholder:text-ark-dim font-sans resize-none
                       focus:outline-none focus:border-ark-gold/50 transition-colors"
						style={{ minHeight: "48px", maxHeight: "120px" }}
					/>
					<button
						onClick={send}
						disabled={busy || !input.trim()}
						className="w-12 h-12 rounded-ark border border-ark-gold/40 bg-ark-gold/10 hover:bg-ark-gold/20
                       hover:border-ark-gold/70 disabled:opacity-30 disabled:cursor-not-allowed
                       flex items-center justify-center text-ark-gold transition-all shrink-0"
					>
						<span className="text-base">↑</span>
					</button>
				</div>
				<p className="text-[10px] text-ark-dim/40 text-center mt-2 tracking-widest uppercase font-sans">
					Enter to send · Shift+Enter for newline · Runs locally on your Ark
				</p>
			</div>
		</div>
	);
}
