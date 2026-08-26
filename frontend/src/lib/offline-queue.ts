const KEY = "storelisten_offline_queue";

export type QueuedRequest = {
  id: string;
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
};

function readQueue(): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedRequest[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedRequest[]): void {
  localStorage.setItem(KEY, JSON.stringify(items.slice(-25)));
}

export function enqueueFailedRequest(request: Omit<QueuedRequest, "id">): void {
  const items = readQueue();
  items.push({ ...request, id: `${Date.now()}-${Math.random().toString(16).slice(2)}` });
  writeQueue(items);
}

export function pendingOfflineCount(): number {
  return readQueue().length;
}

export async function flushOfflineQueue(): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const items = readQueue();
  if (items.length === 0) return 0;
  const remaining: QueuedRequest[] = [];
  let sent = 0;
  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (response.ok) sent += 1;
      else remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
  return sent;
}
