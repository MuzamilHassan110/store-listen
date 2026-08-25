import { describe, expect, it } from "vitest";
import { scoreConversation } from "./scoring.service.js";

const strongTranscript = [
  "Salesman: Assalam alaikum, welcome. What is your budget or price range?",
  "Customer: Around 80 thousand. Does it have a good camera and battery?",
  "Salesman: Yes, 50 megapixel camera and 5000 mah battery. The benefit is longer battery life and better photos.",
  "Customer: Warranty and return?",
  "Salesman: One year warranty and 7 day exchange. I understand the concern about price. We can do installments instead.",
  "Customer: Okay I like it.",
  "Salesman: Would you like to buy it today? Cash or card payment is fine.",
].join("\n");

const weakTranscript = [
  "Salesman: Yeah this one.",
  "Customer: How much?",
  "Salesman: Expensive. Take it or leave it, don't be stupid.",
].join("\n");

describe("scoreConversation", () => {
  it("scores a complete professional conversation in a mid-to-high range", () => {
    const score = scoreConversation(
      {
        summary: "Customer asked about camera and bought after warranty and payment options.",
        sentiment: "positive",
        purchase_intent: "high",
        objections: ["price"],
        key_points: ["budget asked", "warranty explained"],
        customer_questions: ["Does it have a good camera and battery?", "Warranty and return?"],
        duration_spoken_seconds: 180,
      },
      strongTranscript,
      [
        { speaker: "salesman", text: "Assalam alaikum, welcome. What is your budget or price range?" },
        { speaker: "customer", text: "Around 80 thousand. Does it have a good camera and battery?" },
        { speaker: "salesman", text: "Yes, 50 megapixel camera and 5000 mah battery. The benefit is longer battery life." },
        { speaker: "customer", text: "Warranty and return?" },
        { speaker: "salesman", text: "One year warranty. I understand the concern. We can do installments instead." },
        { speaker: "customer", text: "Okay I like it." },
        { speaker: "salesman", text: "Would you like to buy it today? Cash or card payment is fine." },
      ],
      83,
    );

    expect(score.overall_score).toBeGreaterThan(55);
    expect(score.overall_score).toBeLessThan(96);
    expect(score.communication_score).toBeGreaterThan(50);
    expect(score.closing_ability_score).toBeGreaterThan(50);
    expect(score.strengths.length).toBe(2);
    expect(score.weaknesses.length).toBe(2);
    expect(score.recommendations.length).toBeGreaterThan(0);
  });

  it("scores a short rude conversation lower, but not at zero", () => {
    const score = scoreConversation(
      {
        summary: "Salesman was dismissive.",
        sentiment: "negative",
        purchase_intent: "low",
        objections: ["price"],
        key_points: [],
        customer_questions: ["How much?"],
        duration_spoken_seconds: 12,
      },
      weakTranscript,
      [
        { speaker: "salesman", text: "Yeah this one." },
        { speaker: "customer", text: "How much?" },
        { speaker: "salesman", text: "Expensive. Take it or leave it, don't be stupid." },
      ],
      16,
    );

    expect(score.overall_score).toBeGreaterThan(8);
    expect(score.overall_score).toBeLessThan(60);
    expect(score.communication_score).toBeLessThan(70);
  });
});
