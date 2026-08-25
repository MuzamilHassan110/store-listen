import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("GET /api/health", () => {
  it("returns service status", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("store-listien-api");
  });
});

describe("POST /api/recordings", () => {
  it("rejects requests without a bearer token", async () => {
    const res = await request(app).post("/api/recordings");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("GET /api/conversations/:id/analysis", () => {
  it("rejects requests without a bearer token", async () => {
    const res = await request(app).get("/api/conversations/00000000-0000-0000-0000-000000000000/analysis");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/conversations/:id/analyze", () => {
  it("rejects requests without a bearer token", async () => {
    const res = await request(app).post("/api/conversations/00000000-0000-0000-0000-000000000000/analyze");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
