import { beforeEach, describe, expect, it, vi } from "vitest";
import { localDb } from "../db/localDatabase";
import { saveRecordingLocally } from "../services/sync.service";
import {
  getApiBaseUrl,
  sendStreamChunkApi,
  startConversationApi,
} from "../services/api.service";

describe("streaming and conversation attachment", () => {
  beforeEach(async () => {
    await localDb.recordings.clear();
    vi.restoreAllMocks();
  });

  it("saves a recording locally with an attached conversationId", async () => {
    const id = await saveRecordingLocally({
      audioBlob: new Blob(["audio-data"], { type: "audio/webm" }),
      duration: 15,
      transcript: "Customer asking about warranty",
      language: "en",
      deviceId: "device-123",
      salesmanId: "salesman-456",
      recordingHash: "hash-789",
      conversationId: "conv-abc-123",
    });

    expect(id).toBeGreaterThan(0);
    const saved = await localDb.recordings.get(id);
    expect(saved).toBeDefined();
    expect(saved?.conversationId).toBe("conv-abc-123");
    expect(saved?.duration).toBe(15);
  });

  it("handles getApiBaseUrl fallback when window.storelisten is absent", async () => {
    const url = await getApiBaseUrl();
    expect(url).toBeTruthy();
  });

  it("handles startConversationApi successfully when backend responds", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { conversationId: "conv-xyz-999" },
      }),
    });
    vi.stubGlobal("fetch", fakeFetch);

    const convId = await startConversationApi({
      salesmanId: "salesman-1",
      storeId: "store-1",
      language: "en",
      token: "test-token",
    });

    expect(convId).toBe("conv-xyz-999");
    expect(fakeFetch).toHaveBeenCalled();
  });

  it("handles sendStreamChunkApi gracefully on network failure", async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error("Network offline"));
    vi.stubGlobal("fetch", fakeFetch);

    const result = await sendStreamChunkApi({
      conversationId: "conv-1",
      chunkBlob: new Blob(["chunk"], { type: "audio/webm" }),
      transcriptContext: "Hello",
      token: "test-token",
    });

    expect(result).toEqual({ error: true });
  });

  it("handles sendStreamChunkApi successful response with delta and suggestion", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          transcriptDelta: "How much is the phone?",
          suggestion: "Highlight our 0% installment plan.",
        },
      }),
    });
    vi.stubGlobal("fetch", fakeFetch);

    const result = await sendStreamChunkApi({
      conversationId: "conv-1",
      chunkBlob: new Blob(["chunk"], { type: "audio/webm" }),
      transcriptContext: "Hello",
      token: "test-token",
    });

    expect(result?.transcriptDelta).toBe("How much is the phone?");
    expect(result?.suggestion).toBe("Highlight our 0% installment plan.");
    expect(result?.error).toBeUndefined();
  });
});
