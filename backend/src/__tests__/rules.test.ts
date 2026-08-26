import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { evaluateRules } from "../services/rules.service.js";

describe("rules", () => {
  it("rejects rule list without auth", async () => {
    const res = await request(app).get("/api/rules");
    expect(res.status).toBe(401);
  });

  it("matches required keywords in a transcript", () => {
    const results = evaluateRules("This phone includes a one year warranty.", [
      {
        id: "1",
        organization_id: "org",
        rule_type: "warranty",
        description: "Warranty",
        keywords: ["warranty"],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    expect(results[0]?.is_followed).toBe(true);
  });
});
