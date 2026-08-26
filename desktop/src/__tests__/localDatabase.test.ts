import { beforeEach, describe, expect, it } from "vitest";
import {
  getSetting,
  localDb,
  pendingCount,
  pendingRecordings,
  readStoredAuthToken,
  saveAuthToken,
  setSetting,
} from "../db/localDatabase";

describe("local database", () => {
  beforeEach(async () => {
    await localDb.recordings.clear();
    await localDb.settings.clear();
    await localDb.authToken.clear();
  });

  it("stores settings and auth tokens", async () => {
    await setSetting("language", "ur");
    expect(await getSetting("language")).toBe("ur");
    await saveAuthToken("token-1", "user-1", "never");
    expect(await readStoredAuthToken()).toBe("token-1");
  });

  it("counts pending and failed recordings", async () => {
    await localDb.recordings.add({
      audioBlob: new Blob(["x"], { type: "audio/webm" }),
      duration: 12,
      transcript: "hello",
      language: "en",
      deviceId: "dev-1",
      salesmanId: null,
      createdAt: new Date().toISOString(),
      uploadedAt: null,
      status: "pending",
      conversationId: null,
      recordingHash: "abc",
      lastError: null,
    });
    expect(await pendingCount()).toBe(1);
    const rows = await pendingRecordings();
    expect(rows[0]?.transcript).toBe("hello");
  });
});
