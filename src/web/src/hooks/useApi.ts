import { useCallback, useEffect, useState } from "react";

const BASE = import.meta.env.DEV ? "/api" : "";

export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}${path}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as T);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const BASE_ = import.meta.env.DEV ? "/api" : "";
  const res = await fetch(`${BASE_}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  return res.json() as Promise<T>;
}
