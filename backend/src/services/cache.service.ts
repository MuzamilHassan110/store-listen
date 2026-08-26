type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): T {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function cacheInvalidate(prefix: string): number {
  let count = 0;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      count += 1;
    }
  }
  return count;
}

export function cacheWrap<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return Promise.resolve(hit);
  return factory().then((value) => cacheSet(key, value, ttlMs));
}

export const CACHE_TTL = {
  dashboard: 5 * 60_000,
  scores: 10 * 60_000,
  reports: 60 * 60_000,
};

export function cacheSize(): number {
  return store.size;
}
