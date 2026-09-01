import { describe, expect, it } from "vitest";
import { detectEmotion } from "./emotion.service.js";
import { analyzeTone } from "./tone.service.js";
import { buildCoachingTips } from "./coaching.service.js";
import { detectPreferences, rankProducts } from "./recommendation.service.js";
import { scoreChurn } from "./churn.service.js";
import { buildSalesScript } from "./script.service.js";

describe("emotion detection", () => {
  it("flags Urdu price frustration", () => {
    const result = detectEmotion("Ye phone mehnga hai, problem yeh hai ke budget nahi hai.", {
      sentiment: "negative",
      objections: ["mehnga"],
    });
    expect(result.primary_emotion).toBe("frustrated");
    expect(result.emotion_triggers.some((item) => item.word === "mehnga")).toBe(true);
    expect(result.emotional_intensity).toBeGreaterThan(0.2);
  });

  it("flags English excitement and thanks", () => {
    const result = detectEmotion("Wow this is amazing, shukriya, kya baat hai!");
    expect(["excited", "happy"]).toContain(result.primary_emotion);
  });

  it("stays neutral without cues", () => {
    const result = detectEmotion("The store is on MM Alam Road.");
    expect(result.primary_emotion).toBe("neutral");
  });
});

describe("tone analysis", () => {
  it("counts fillers and lowers confidence", () => {
    const withFillers = analyzeTone("Umm actually basically I think we can do it.");
    const clean = analyzeTone("We recommend this model today. Warranty is included.");
    expect(withFillers.filler_word_count).toBeGreaterThan(0);
    expect(clean.confidence_score).toBeGreaterThan(withFillers.confidence_score);
    expect(clean.professionalism_score).toBeGreaterThan(50);
  }, 20000);
});

describe("coaching tips", () => {
  it("suggests EMI when price is repeated without a close", () => {
    const result = buildCoachingTips("Customer: price is high, mehnga hai. I am interested.");
    expect(result.tips.some((tip) => tip.trigger === "price_objection")).toBe(true);
    expect(result.missed_opportunities.some((item) => item.type === "closing")).toBe(true);
  });
});

describe("product recommendations", () => {
  it("detects budget, brand, and camera use case", () => {
    const prefs = detectPreferences("I want a Samsung around 1 lakh with a good camera for photos.");
    expect(prefs.brands).toContain("Samsung");
    expect(prefs.features).toContain("camera");
    expect(prefs.use_case).toBe("photography");
    const ranked = rankProducts(
      [
        {
          id: "1",
          organization_id: "o",
          name: "Samsung A54",
          category: "phone",
          price_range: "50k-100k PKR",
          features: ["camera", "battery"],
          brand: "Samsung",
        },
      ],
      prefs,
    );
    expect(ranked.recommended_products[0]?.name).toBe("Samsung A54");
    expect(ranked.recommended_products[0]?.match_score).toBeGreaterThan(70);
  });
});

describe("churn scoring", () => {
  it("marks high risk when sentiment and follow-ups fail", () => {
    const high = scoreChurn({
      negativeCount: 3,
      recentCount: 3,
      priceObjections: 2,
      openFollowUps: 1,
      overdueFollowUps: 1,
      visits: 4,
      purchases: 0,
      daysSinceVisit: 45,
    });
    expect(high.churn_risk).toBe("high");
    expect(high.churn_score).toBeGreaterThanOrEqual(65);
    const low = scoreChurn({
      negativeCount: 0,
      recentCount: 2,
      priceObjections: 0,
      openFollowUps: 0,
      overdueFollowUps: 0,
      visits: 2,
      purchases: 1,
      daysSinceVisit: 3,
    });
    expect(low.churn_risk).toBe("low");
  });
});

describe("sales scripts", () => {
  it("builds Urdu copy with EMI for price objections", () => {
    const script = buildSalesScript({
      customerName: "Sara",
      productName: "Samsung A54",
      language: "ur",
      objections: ["Price high hai"],
    });
    expect(script.opening).toContain("Sara");
    expect(script.objection_handlers[0]?.response).toMatch(/EMI/i);
  });
});
