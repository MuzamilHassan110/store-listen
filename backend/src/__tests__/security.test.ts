import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { decryptText, encryptText, hashPhone } from "../services/encryption.service.js";

describe("security", () => {
  it("sends nosniff and deny frame headers", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("accepts a client error report", async () => {
    const res = await request(app).post("/api/health/client-error").send({ message: "boom" });
    expect(res.status).toBe(204);
  });

  it("exposes a detailed health payload", async () => {
    const res = await request(app).get("/api/health/detailed");
    expect(res.status).toBe(200);
    expect(res.body.checks).toBeTruthy();
    expect(res.body.process.uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it("hashes phone numbers consistently", () => {
    expect(hashPhone("(0300) 123-4567")).toBe(hashPhone("03001234567"));
    expect(decryptText(encryptText("hello"))).toBe("hello");
  });
});
