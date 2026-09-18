import { useCallback, useEffect, useRef, useState } from 'react';

export interface CachedConnection<T> {
  /** What to render: the last known status instantly, then the fresh one. */
  status: T | null;
  /** True only on first load with no cache. Cached renders never spin. */
  loading: boolean;
  /** A background re-check is in flight. */
  revalidating: boolean;
  /** Epoch ms of the last successful check (persisted). */
  lastCheckedAt: number | null;
  /** The cache said connected but the fresh check says otherwise. */
  connectionLost: boolean;
  /** Fetch error from the last revalidation (cached status still shown). */
  error: string | null;
  /** Force a fresh check now. */
  refresh: () => Promise<T | null>;
}

interface CacheEnvelope<T> {
  status: T;
  savedAt: number;
}

function readCache<T>(key: string): CacheEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.status) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Show the last known connection status instantly, re-check in the
 * background, and only raise a flag when a working connection actually
 * breaks. Cache key should be scoped per workspace + channel. */
export function useCachedConnectionStatus<T>(opts: {
  cacheKey: string;
  fetchStatus: () => Promise<T>;
  isConnected: (s: T | null) => boolean;
  onFresh?: (s: T) => void;
}): CachedConnection<T> {
  const { cacheKey, fetchStatus, isConnected, onFresh } = opts;
  const [cached] = useState<CacheEnvelope<T> | null>(() => readCache<T>(cacheKey));
  const [status, setStatus] = useState<T | null>(cached?.status ?? null);
  const [loading, setLoading] = useState(!cached);
  const [revalidating, setRevalidating] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(cached?.savedAt ?? null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const fetchRef = useRef(fetchStatus);
  fetchRef.current = fetchStatus;
  const onFreshRef = useRef(onFresh);
  onFreshRef.current = onFresh;
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;

  const revalidate = useCallback(async (): Promise<T | null> => {
    setRevalidating(true);
    setError(null);
    try {
      const fresh = await fetchRef.current();
      if (!mounted.current) return fresh;
      const wasConnected = isConnectedRef.current(readCache<T>(cacheKey)?.status ?? null);
      setStatus(fresh);
      const now = Date.now();
      setLastCheckedAt(now);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ status: fresh, savedAt: now }));
      } catch { /* storage full or blocked: keep in-memory state */ }
      setConnectionLost(wasConnected && !isConnectedRef.current(fresh));
      setLoading(false);
      onFreshRef.current?.(fresh);
      return fresh;
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'Could not check connection.');
        setLoading(false);
      }
      return null;
    } finally {
      if (mounted.current) setRevalidating(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    mounted.current = true;
    revalidate();
    return () => { mounted.current = false; };
  }, [revalidate]);

  return { status, loading, revalidating, lastCheckedAt, connectionLost, error, refresh: revalidate };
}

/** "Checked 3m ago" style label for the persisted last-checked time. */
export function timeAgo(ts: number | null): string | null {
  if (!ts) return null;
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
