import { saveAuthToken } from "../db/localDatabase";

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

export async function refreshAuthToken(): Promise<string | null> {
  try {
    const refreshToken = typeof localStorage !== "undefined" ? localStorage.getItem("storelisten_refresh_token") : null;
    if (!refreshToken) return null;

    const baseUrl = await getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: { access_token?: string; refresh_token?: string };
    } | null;

    if (!res.ok || !json?.data?.access_token) {
      return null;
    }

    const newAccessToken = json.data.access_token;
    const newRefreshToken = json.data.refresh_token;

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("storelisten_token", newAccessToken);
      if (newRefreshToken) {
        localStorage.setItem("storelisten_refresh_token", newRefreshToken);
      }
    }
    await saveAuthToken(newAccessToken);
    return newAccessToken;
  } catch {
    return null;
  }
}

export async function startConversationApi(input: {
  salesmanId?: string | null;
  storeId?: string | null;
  language?: string | null;
  token?: string | null;
}): Promise<string | null> {
  try {
    const baseUrl = await getApiBaseUrl();
    let currentToken = input.token;

    const doFetch = async (authToken?: string | null) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      return fetch(`${baseUrl}/api/conversations/start`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          salesmanId: input.salesmanId || undefined,
          storeId: input.storeId || undefined,
          language: input.language || "en",
        }),
      });
    };

    let res = await doFetch(currentToken);

    if (res.status === 401) {
      const refreshedToken = await refreshAuthToken();
      if (refreshedToken) {
        currentToken = refreshedToken;
        res = await doFetch(currentToken);
      }
    }

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
    let currentToken = input.token;

    const doFetch = async (authToken?: string | null) => {
      const form = new FormData();
      form.append("audio", input.chunkBlob, "chunk.webm");
      if (input.transcriptContext) {
        form.append("transcriptContext", input.transcriptContext);
      }

      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      return fetch(`${baseUrl}/api/conversations/${input.conversationId}/stream-chunk`, {
        method: "POST",
        headers,
        body: form,
      });
    };

    let res = await doFetch(currentToken);

    if (res.status === 401) {
      const refreshedToken = await refreshAuthToken();
      if (refreshedToken) {
        currentToken = refreshedToken;
        res = await doFetch(currentToken);
      }
    }

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
