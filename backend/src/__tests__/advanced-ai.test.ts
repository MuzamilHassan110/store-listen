import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("advanced AI routes", () => {
  it("rejects unauthenticated product, script, insight, coaching, and churn calls", async () => {
    const products = await request(app).get("/api/products");
    const scripts = await request(app).get("/api/scripts");
    const overview = await request(app).get("/api/insights/overview");
    const coaching = await request(app).get("/api/conversations/00000000-0000-0000-0000-000000000000/coaching");
    const recs = await request(app).get("/api/conversations/00000000-0000-0000-0000-000000000000/recommendations");
    const churn = await request(app).get("/api/customers/00000000-0000-0000-0000-000000000000/churn");
    expect(products.status).toBe(401);
    expect(scripts.status).toBe(401);
    expect(overview.status).toBe(401);
    expect(coaching.status).toBe(401);
    expect(recs.status).toBe(401);
    expect(churn.status).toBe(401);
  });
});
