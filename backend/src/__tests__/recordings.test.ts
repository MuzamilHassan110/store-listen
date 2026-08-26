import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("recordings", () => {
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
});
