import { useRef } from "react";
import { Icon } from "../components/Icons.tsx";
import { useApi } from "../hooks/useApi.ts";

const BASE = import.meta.env.DEV ? "/api" : "";

export default function Files() {
	const { data, loading, error, refetch } = useApi<{ files: string[] }>(
		"/storage",
	);
	const fileInputRef = useRef<HTMLInputElement>(null);

	async function uploadFile(file: File) {
		const buf = await file.arrayBuffer();
		await fetch(`${BASE}/storage/${encodeURIComponent(file.name)}`, {
			method: "POST",
			headers: { "Content-Type": "application/octet-stream" },
			body: buf,
		});
		refetch();
	}

	function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const files = e.target.files;
		if (files) for (const f of Array.from(files)) uploadFile(f);
	}

	function onDrop(e: React.DragEvent) {
		e.preventDefault();
		for (const f of Array.from(e.dataTransfer.files)) uploadFile(f);
	}

	function fileIconName(
		name: string,
	): "camera" | "diamond" | "archive" | "circle-ring" | "circle-dot" {
		const ext = name.split(".").pop()?.toLowerCase();
		if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext ?? ""))
			return "camera";
		if (
			["mp4", "mov", "mkv", "avi", "mp3", "m4a", "flac", "wav"].includes(
				ext ?? "",
			)
		)
			return "diamond";
		if (["pdf", "doc", "docx", "txt", "md"].includes(ext ?? ""))
			return "circle-ring";
		if (["zip", "tar", "gz", "7z"].includes(ext ?? "")) return "archive";
		return "circle-dot";
	}

	return (
		<div className="relative p-6 md:p-12 max-w-4xl mx-auto animate-slide-up">
			{/* Header */}
			<div className="flex items-start justify-between mb-10">
				<div>
					<p className="text-ark-gold/50 text-xs tracking-[0.3em] uppercase font-sans mb-2">
						Archivum
					</p>
					<h1 className="font-serif text-5xl text-ark-ivory font-light tracking-wide">
						Vault
					</h1>
					<div className="divider-gold w-24 mt-3" />
				</div>
				<button
					onClick={() => fileInputRef.current?.click()}
					className="btn-gold mt-4"
				>
					<span>↑</span> Upload
				</button>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					className="hidden"
					onChange={onFileChange}
				/>
			</div>

			{/* Drop zone */}
			<div
				onDrop={onDrop}
				onDragOver={(e) => e.preventDefault()}
				onClick={() => fileInputRef.current?.click()}
				className="ark-card p-10 text-center mb-6 cursor-pointer
                      hover:border-ark-gold/30 hover:shadow-gold-subtle
                      transition-all duration-300 group"
			>
				<Icon
					name="diamond"
					className="w-8 h-8 text-ark-gold/30 group-hover:text-ark-gold/60 mb-3 transition-colors"
				/>
				<p className="text-sm text-ark-muted font-sans">
					Drop files here or click to upload
				</p>
				<p className="text-xs text-ark-dim/50 font-sans mt-1 tracking-widest uppercase">
					Stored privately on your Ark
				</p>
			</div>

			{loading && (
				<div className="space-y-2">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="ark-card h-14 animate-pulse-gold opacity-30"
						/>
					))}
				</div>
			)}

			{error && (
				<div className="ark-card p-4 border-ark-crimson/30 text-ark-crimson/80 text-sm font-sans">
					Error: {error}
				</div>
			)}

			{data &&
				(data.files.length === 0 ? (
					<div className="text-center py-16 text-ark-dim">
						<div className="font-serif text-xl mb-2">The Vault is empty</div>
						<p className="text-sm font-sans">Upload your first file to begin</p>
					</div>
				) : (
					<>
						<p className="text-xs text-ark-gold/40 tracking-widest uppercase font-sans mb-4">
							{data.files.length} {data.files.length === 1 ? "item" : "items"}
						</p>
						<div className="space-y-2">
							{data.files.map((file) => (
								<a
									key={file}
									href={`${BASE}/storage/${encodeURIComponent(file)}`}
									target="_blank"
									rel="noreferrer"
									className="flex items-center gap-4 ark-card px-5 py-4
                                hover:border-ark-gold/30 hover:shadow-gold-subtle
                                transition-all duration-200 group"
								>
									<Icon
										name={fileIconName(file)}
										className="w-4 h-4 text-ark-gold/50 group-hover:text-ark-gold/80 transition-colors shrink-0"
									/>
									<span className="flex-1 text-sm font-sans text-ark-parchment truncate">
										{file}
									</span>
									<span className="text-xs text-ark-dim group-hover:text-ark-gold/50 transition-colors font-sans">
										↓
									</span>
								</a>
							))}
						</div>
					</>
				))}
		</div>
	);
}
