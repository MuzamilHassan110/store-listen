import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { shouldCreateLead } from "../services/lead.service.js";

describe("followups", () => {
  it("rejects follow-up list without auth", async () => {
    const res = await request(app).get("/api/followups");
    expect(res.status).toBe(401);
  });

  it("creates a lead for high intent and positive sentiment", () => {
    expect(shouldCreateLead("high", "positive")).toBe(true);
    expect(shouldCreateLead("low", "negative")).toBe(false);
  });
});
