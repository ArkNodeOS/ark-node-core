import { useRef } from "react";
import { useApi } from "../hooks/useApi.ts";

interface StorageResponse {
  files: string[];
}

const BASE = import.meta.env.DEV ? "/api" : "";

export default function Files() {
  const { data, loading, error, refetch } = useApi<StorageResponse>("/storage");
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
    if (!files) return;
    for (const f of Array.from(files)) uploadFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    for (const f of Array.from(e.dataTransfer.files)) uploadFile(f);
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-slide-up">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Files</h1>
          <p className="text-ark-text-dim mt-1">Your private storage</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ark-accent hover:bg-ark-accent-glow text-white text-sm transition-all"
        >
          <span>↑</span> Upload
        </button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileChange} />
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-ark-border rounded-2xl p-8 text-center mb-6 hover:border-ark-accent/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="text-3xl mb-2">⊟</div>
        <div className="text-sm text-ark-muted">Drop files here or click to upload</div>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-ark-card rounded-xl animate-pulse2" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm">
          Error: {error}
        </div>
      )}

      {data && (
        <div className="space-y-2">
          {data.files.length === 0 ? (
            <div className="text-center py-12 text-ark-muted">
              <p>No files yet. Upload something!</p>
            </div>
          ) : (
            data.files.map((file) => (
              <a
                key={file}
                href={`${BASE}/storage/${encodeURIComponent(file)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-4 bg-ark-card border border-ark-border rounded-xl px-5 py-4 hover:border-ark-accent/30 transition-all group"
              >
                <span className="text-xl text-ark-muted">⊟</span>
                <span className="flex-1 text-sm truncate">{file}</span>
                <span className="text-xs text-ark-muted group-hover:text-ark-accent transition-colors">↓</span>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
