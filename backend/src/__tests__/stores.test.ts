import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("stores", () => {
  it("rejects store, device, and activity lists without auth", async () => {
    const stores = await request(app).get("/api/stores");
    const devices = await request(app).get("/api/devices");
    const activity = await request(app).get("/api/activity");
    expect(stores.status).toBe(401);
    expect(devices.status).toBe(401);
    expect(activity.status).toBe(401);
  });
});
