import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("reports", () => {
  it("rejects report list and store report without auth", async () => {
    const list = await request(app).get("/api/reports");
    const store = await request(app).get("/api/reports/store");
    expect(list.status).toBe(401);
    expect(store.status).toBe(401);
  });

  it("rejects export without auth", async () => {
    const res = await request(app).get("/api/export/conversations");
    expect(res.status).toBe(401);
  });
});
