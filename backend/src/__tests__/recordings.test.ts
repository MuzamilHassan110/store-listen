import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import {
  clearChunkCounter,
  getAndIncrementChunkCount,
  transcribeChunk,
} from "../services/live-stream.service.js";

describe("recordings and streaming endpoints", () => {
  it("rejects upload without auth", async () => {
    const res = await request(app).post("/api/recordings");
    expect(res.status).toBe(401);
  });

  it("rejects batch upload without auth", async () => {
    const res = await request(app).post("/api/recordings/batch");
    expect(res.status).toBe(401);
  });

  it("rejects analysis retry without auth", async () => {
    const res = await request(app).post("/api/conversations/00000000-0000-0000-0000-000000000000/analyze");
    expect(res.status).toBe(401);
  });

  it("rejects conversation start without auth", async () => {
    const res = await request(app).post("/api/conversations/start").send({
      language: "en",
    });
    expect(res.status).toBe(401);
  });

  it("rejects stream chunk upload without auth", async () => {
    const res = await request(app)
      .post("/api/conversations/00000000-0000-0000-0000-000000000000/stream-chunk")
      .attach("audio", Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), "chunk.webm");
    expect(res.status).toBe(401);
  });

  it("tracks in-memory chunk counts correctly per conversation", () => {
    const convId = "test-conv-" + Math.random().toString(36).slice(2);
    expect(getAndIncrementChunkCount(convId)).toBe(1);
    expect(getAndIncrementChunkCount(convId)).toBe(2);
    expect(getAndIncrementChunkCount(convId)).toBe(3);
    clearChunkCounter(convId);
    expect(getAndIncrementChunkCount(convId)).toBe(1);
    clearChunkCounter(convId);
  });

  it("returns empty transcript without throwing on empty audio buffer", async () => {
    const result = await transcribeChunk({
      audioBuffer: Buffer.alloc(0),
      mimeType: "audio/webm",
    });
    expect(result.transcriptDelta).toBe("");
    expect(result.error).toBe(false);
  });
});
