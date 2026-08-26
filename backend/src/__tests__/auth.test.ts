import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("auth", () => {
  it("rejects 2FA setup without a bearer token", async () => {
    const res = await request(app).post("/api/auth/2fa/setup");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects password login with an invalid body", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("rejects session list without auth", async () => {
    const res = await request(app).get("/api/auth/sessions");
    expect(res.status).toBe(401);
  });
});
