import { beforeEach, describe, expect, it } from "vitest";
import { localDb } from "../db/localDatabase";
import { getSyncSnapshot, saveRecordingLocally } from "../services/sync.service";

describe("sync service", () => {
  beforeEach(async () => {
    await localDb.recordings.clear();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  });

  it("queues a recording locally while offline", async () => {
    const id = await saveRecordingLocally({
      audioBlob: new Blob(["audio"], { type: "audio/webm" }),
      duration: 8,
      transcript: "need a warranty",
      language: "en",
      deviceId: "dev-1",
      salesmanId: null,
      recordingHash: "hash-1",
    });
    expect(id).toBeGreaterThan(0);
    const snapshot = await getSyncSnapshot();
    expect(snapshot.online).toBe(false);
    expect(snapshot.pendingCount).toBe(1);
    expect(snapshot.message).toBe("Offline");
  });
});
