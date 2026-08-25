import { describe, expect, it } from "vitest";
import { compliancePercent, evaluateRules, findKeywordEvidence, type ConversationRule } from "./rules.service.js";

const rules: ConversationRule[] = [
  {
    id: "1",
    organization_id: "org",
    rule_type: "greeting",
    description: "Greeting required",
    keywords: ["salam", "hello", "welcome"],
    is_active: true,
  },
  {
    id: "2",
    organization_id: "org",
    rule_type: "discount",
    description: "No unauthorized discount",
    keywords: ["extra discount", "special price"],
    is_active: true,
  },
];

describe("evaluateRules", () => {
  it("marks greeting followed when a keyword appears", () => {
    const results = evaluateRules("Assalam alaikum, this phone is 50k.", rules);
    const greeting = results.find((item) => item.rule_type === "greeting");
    expect(greeting?.is_followed).toBe(true);
    expect(greeting?.evidence).toMatch(/assalam/i);
  });

  it("fails the discount rule when unauthorized language is used", () => {
    const results = evaluateRules("I can give you a special price today.", rules);
    const discount = results.find((item) => item.rule_type === "discount");
    expect(discount?.is_followed).toBe(false);
    expect(discount?.evidence).toMatch(/special price/i);
  });

  it("passes the discount rule when those phrases are absent", () => {
    const results = evaluateRules("Hello, the listed price is 50 thousand.", rules);
    const discount = results.find((item) => item.rule_type === "discount");
    expect(discount?.is_followed).toBe(true);
  });

  it("computes compliance percent", () => {
    const results = evaluateRules("Hello there", rules);
    expect(compliancePercent(results)).toBe(100);
    expect(findKeywordEvidence("kitna budget", ["budget"])).toMatch(/budget/i);
  });
});
