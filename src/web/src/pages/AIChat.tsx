import { useEffect, useRef, useState } from "react";
import { apiPost } from "../hooks/useApi.ts";

interface Message {
	id: number;
	role: "user" | "assistant";
	content: string;
	loading?: boolean;
}

export default function AIChat() {
	const [messages, setMessages] = useState<Message[]>([
		{
			id: 0,
			role: "assistant",
			content:
				"Salve. I am Solomon, the intelligence of your Ark Node. How may I serve you?",
		},
	]);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll trigger on messages and loading
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, loading]);

	const send = async () => {
		const text = input.trim();
		if (!text || loading) return;
		setInput("");
		if (textareaRef.current) textareaRef.current.style.height = "auto";

		const userMsg: Message = { id: Date.now(), role: "user", content: text };
		setMessages((prev) => [...prev, userMsg]);
		setLoading(true);

		try {
			const res = await apiPost<{ reply?: string; response?: string }>(
				"/solomon",
				{ message: text },
			).catch(() =>
				apiPost<{ response: string }>("/ai/query", { prompt: text }),
			);

			const content =
				(res as { reply?: string }).reply ??
				(res as { response?: string }).response ??
				"I have no answer at this time.";

			setMessages((prev) => [
				...prev,
				{ id: Date.now(), role: "assistant", content },
			]);
		} catch {
			setMessages((prev) => [
				...prev,
				{
					id: Date.now(),
					role: "assistant",
					content: "Connection lost. Is the server running?",
				},
			]);
		} finally {
			setLoading(false);
			textareaRef.current?.focus();
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	};

	const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
		e.target.style.height = "auto";
		e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
	};

	return (
		<div
			className="flex flex-col"
			style={{ height: "calc(100vh - env(safe-area-inset-top, 0px))" }}
		>
			{/* Header */}
			<div className="px-4 py-3 border-b border-[#3A2A10] bg-[#0C0804] shrink-0">
				<h2 className="font-serif text-lg text-[#C9A84C] tracking-widest">
					SAPIENTIA
				</h2>
				<p className="text-xs text-[#6A5A3A] tracking-wider">
					Solomon · Intelligence Layer
				</p>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
					>
						<div
							className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
								msg.role === "user"
									? "bg-[#C9A84C]/15 text-[#F5F0E0] border border-[#C9A84C]/30 rounded-br-sm"
									: "bg-[#1A1108] text-[#DDD0B0] border border-[#3A2A10] rounded-bl-sm"
							}`}
						>
							<span className="whitespace-pre-wrap">{msg.content}</span>
						</div>
					</div>
				))}
				{loading && (
					<div className="flex justify-start">
						<div className="bg-[#1A1108] border border-[#3A2A10] rounded-2xl rounded-bl-sm px-4 py-3">
							<div className="flex gap-1 items-center h-4">
								<span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-bounce [animation-delay:0ms]" />
								<span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-bounce [animation-delay:150ms]" />
								<span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-bounce [animation-delay:300ms]" />
							</div>
						</div>
					</div>
				)}
				<div ref={bottomRef} />
			</div>

			{/* Input */}
			<div className="border-t border-[#3A2A10] bg-[#0C0804] px-4 py-3 shrink-0">
				<div className="flex gap-2 items-end">
					<textarea
						ref={textareaRef}
						value={input}
						onChange={handleInput}
						onKeyDown={handleKeyDown}
						placeholder="Ask Solomon anything..."
						rows={1}
						className="flex-1 bg-[#1A1108] border border-[#3A2A10] rounded-xl px-4 py-3 text-sm text-[#F5F0E0] placeholder-[#6A5A3A] resize-none focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
						style={{ minHeight: "44px", maxHeight: "120px" }}
					/>
					<button
						type="button"
						onClick={send}
						disabled={!input.trim() || loading}
						className="w-11 h-11 rounded-xl bg-[#C9A84C] text-[#060402] flex items-center justify-center text-lg disabled:opacity-30 disabled:cursor-not-allowed transition-opacity shrink-0"
					>
						↑
					</button>
				</div>
				<p className="text-[10px] text-[#3A2A10] text-center mt-2 tracking-wider">
					SHIFT+ENTER FOR NEW LINE
				</p>
			</div>
		</div>
	);
}
