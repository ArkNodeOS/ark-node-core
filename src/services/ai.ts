const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

interface OllamaGenerateResponse {
	response: string;
	done: boolean;
	model: string;
}

interface OllamaChatResponse {
	message: { role: string; content: string };
	done: boolean;
	model: string;
}

interface OllamaTagsResponse {
	models: { name: string; modified_at: string; size: number }[];
}

export async function isOllamaAvailable(): Promise<boolean> {
	try {
		const res = await fetch(`${OLLAMA_URL}/api/tags`, {
			signal: AbortSignal.timeout(3000),
		});
		return res.ok;
	} catch {
		return false;
	}
}

export async function listModels(): Promise<string[]> {
	try {
		const res = await fetch(`${OLLAMA_URL}/api/tags`, {
			signal: AbortSignal.timeout(5000),
		});
		if (!res.ok) return [];
		const data = (await res.json()) as OllamaTagsResponse;
		return data.models?.map((m) => m.name) ?? [];
	} catch {
		return [];
	}
}

/** General-purpose text query via /api/generate */
export async function queryAI(
	prompt: string,
	model?: string,
	context?: string,
): Promise<string> {
	const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
	const selectedModel = model ?? DEFAULT_MODEL;

	const res = await fetch(`${OLLAMA_URL}/api/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: selectedModel,
			prompt: fullPrompt,
			stream: false,
		}),
		signal: AbortSignal.timeout(120_000),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Ollama error ${res.status}: ${text}`);
	}

	const data = (await res.json()) as OllamaGenerateResponse;
	return data.response;
}

/**
 * Structured JSON query via /api/chat with a proper system message.
 * Uses format:"json" to guarantee valid JSON output even from small models.
 * Use this for intent classification, not general conversation.
 */
export async function queryAIStructured(
	systemPrompt: string,
	userMessage: string,
	model?: string,
): Promise<string> {
	const selectedModel = model ?? DEFAULT_MODEL;

	const res = await fetch(`${OLLAMA_URL}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: selectedModel,
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userMessage },
			],
			format: "json",
			stream: false,
			options: {
				temperature: 0.1, // low temp for deterministic JSON classification
			},
		}),
		signal: AbortSignal.timeout(120_000),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Ollama error ${res.status}: ${text}`);
	}

	const data = (await res.json()) as OllamaChatResponse;
	return data.message.content;
}
