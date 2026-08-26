import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("license and version", () => {
  it("returns desktop version metadata", async () => {
    const res = await request(app).get("/api/version");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.latest).toBeTruthy();
  });

  it("rejects empty license activation", async () => {
    const res = await request(app).post("/api/license/activate").send({});
    expect(res.status).toBe(400);
  });

  it("requires a key to check status", async () => {
    const res = await request(app).get("/api/license/status");
    expect(res.status).toBe(400);
  });

  it("rejects deactivate, renew, and generate without auth", async () => {
    const deactivate = await request(app).post("/api/license/deactivate").send({ license_key: "SL-TEST" });
    const renew = await request(app).post("/api/license/renew").send({ license_key: "SL-TEST" });
    const generate = await request(app).post("/api/license/generate").send({ plan_type: "pro" });
    expect(deactivate.status).toBe(401);
    expect(renew.status).toBe(401);
    expect(generate.status).toBe(401);
  });
});
