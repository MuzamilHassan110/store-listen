export async function getApiBaseUrl(): Promise<string> {
  try {
    if (typeof window !== "undefined" && window.storelisten?.getBackendUrl) {
      const url = await window.storelisten.getBackendUrl();
      if (url) return url.replace(/\/+$/, "");
    }
  } catch {
    // fallback
  }
  return (import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export async function startConversationApi(input: {
  salesmanId?: string | null;
  storeId?: string | null;
  language?: string | null;
  token?: string | null;
}): Promise<string | null> {
  try {
    const baseUrl = await getApiBaseUrl();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (input.token) {
      headers["Authorization"] = `Bearer ${input.token}`;
    }
    const res = await fetch(`${baseUrl}/api/conversations/start`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        salesmanId: input.salesmanId || undefined,
        storeId: input.storeId || undefined,
        language: input.language || "en",
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: { conversationId?: string };
    } | null;
    return json?.data?.conversationId ?? null;
  } catch {
    return null;
  }
}

export async function sendStreamChunkApi(input: {
  conversationId: string;
  chunkBlob: Blob;
  transcriptContext?: string;
  token?: string | null;
}): Promise<{ transcriptDelta?: string; suggestion?: string; error?: boolean } | null> {
  try {
    const baseUrl = await getApiBaseUrl();
    const form = new FormData();
    form.append("audio", input.chunkBlob, "chunk.webm");
    if (input.transcriptContext) {
      form.append("transcriptContext", input.transcriptContext);
    }

    const headers: Record<string, string> = {};
    if (input.token) {
      headers["Authorization"] = `Bearer ${input.token}`;
    }

    const res = await fetch(`${baseUrl}/api/conversations/${input.conversationId}/stream-chunk`, {
      method: "POST",
      headers,
      body: form,
    });

    if (!res.ok) {
      return { error: true };
    }
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: { transcriptDelta?: string; suggestion?: string; error?: boolean };
    } | null;
    return json?.data ?? { error: true };
  } catch {
    return { error: true };
  }
}
