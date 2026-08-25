export type ScoringAnalysis = {
  summary?: string | null;
  sentiment?: string | null;
  purchase_intent?: string | null;
  objections?: string[];
  key_points?: string[];
  customer_questions?: string[];
  duration_spoken_seconds?: number | null;
};

export type ScoringSegment = {
  speaker: string;
  text: string;
};

export type ConversationScore = {
  overall_score: number;
  communication_score: number;
  product_knowledge_score: number;
  objection_handling_score: number;
  closing_ability_score: number;
  rule_compliance_score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

export const DIMENSION_LABELS = {
  communication_score: "Communication",
  product_knowledge_score: "Product knowledge",
  objection_handling_score: "Objection handling",
  closing_ability_score: "Closing ability",
  rule_compliance_score: "Rule compliance",
} as const;

const WEIGHTS = {
  communication_score: 0.2,
  product_knowledge_score: 0.2,
  objection_handling_score: 0.25,
  closing_ability_score: 0.2,
  rule_compliance_score: 0.15,
} as const;

const HARSH_WORDS = ["stupid", "idiot", "shut up", "damn", "useless", "cheapskate", "bakwas", "pagal", "bewakoof"];
const LISTENING_PHRASES = ["i understand", "i hear", "samajh", "got it", "that makes sense", "acha jee", "right"];
const FEATURE_TERMS = [
  "battery",
  "camera",
  "ram",
  "storage",
  "processor",
  "display",
  "screen",
  "model",
  "specification",
  "spec",
  "megapixel",
  "mah",
  "warranty",
  "gb",
  "zoom",
];
const BENEFIT_TERMS = ["benefit", "faida", "advantage", "save", "faster", "easier", "better", "durable", "quality"];
const CLOSE_PHRASES = [
  "would you like",
  "shall i pack",
  "shall i bill",
  "ready to buy",
  "kharid",
  "le lo",
  "book it",
  "confirm the order",
];
const PAYMENT_TERMS = ["cash", "card", "installment", "emi", "jazzcash", "easypaisa", "payment", "invoice"];
const URGENCY_TERMS = ["today only", "limited", "last piece", "stock", "offer ends", "abhi"];
const ACKNOWLEDGE_TERMS = ["i understand", "valid point", "fair", "samajh", "concern", "i hear"];
const SOLUTION_TERMS = ["alternative", "instead", "option", "another", "we can", "solution"];

function clampScore(value: number): number {
  return Math.max(8, Math.min(96, Math.round(value)));
}

function normalize(text: string): string {
  return text.toLowerCase();
}

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function countHits(haystack: string, needles: string[]): number {
  const text = normalize(haystack);
  return needles.reduce((sum, needle) => sum + (text.includes(needle) ? 1 : 0), 0);
}

function speakerText(segments: ScoringSegment[], speaker: string, fallback: string): string {
  const matched = segments.filter((segment) => segment.speaker === speaker).map((segment) => segment.text);
  if (matched.length) return matched.join(" ");
  return speaker === "salesman" ? fallback : "";
}

function customerShare(salesmanWords: number, customerWords: number): number {
  const total = salesmanWords + customerWords;
  if (total === 0) return 0;
  return customerWords / total;
}

function interruptionRatio(segments: ScoringSegment[]): number {
  if (segments.length < 2) return 0.35;
  let same = 0;
  for (let i = 1; i < segments.length; i += 1) {
    if (segments[i]?.speaker === segments[i - 1]?.speaker) same += 1;
  }
  return same / (segments.length - 1);
}

function questionsAnswered(segments: ScoringSegment[], questions: string[]): number {
  if (questions.length === 0) {
    const customerTurns = segments.filter((segment) => segment.speaker === "customer" && segment.text.includes("?"));
    if (customerTurns.length === 0) return 0.6;
    let answered = 0;
    for (let i = 0; i < segments.length - 1; i += 1) {
      if (segments[i]?.speaker === "customer" && segments[i + 1]?.speaker === "salesman") answered += 1;
    }
    return Math.min(1, answered / customerTurns.length);
  }

  let answered = 0;
  for (const question of questions) {
    const token = question.toLowerCase().split(/\s+/).find((word) => word.length > 3);
    if (!token) {
      answered += 0.5;
      continue;
    }
    const index = segments.findIndex(
      (segment) => segment.speaker === "customer" && segment.text.toLowerCase().includes(token),
    );
    if (index >= 0 && segments.slice(index + 1).some((segment) => segment.speaker === "salesman")) {
      answered += 1;
    }
  }
  return answered / questions.length;
}

function communicationScore(input: {
  transcript: string;
  salesmanText: string;
  customerWords: number;
  salesmanWords: number;
  duration: number;
  segments: ScoringSegment[];
}): number {
  const words = wordCount(input.transcript);
  let lengthScore = 38;
  if (input.duration >= 45 || words >= 40) lengthScore = 52;
  if (input.duration >= 90 || words >= 90) lengthScore = 74;
  if (input.duration >= 180 || words >= 180) lengthScore = 84;
  if (words > 900) lengthScore = 70;

  const share = customerShare(input.salesmanWords, input.customerWords);
  let engagement = 40;
  if (share >= 0.12 && share <= 0.55) engagement = 82;
  else if (share > 0 && share < 0.12) engagement = 55;
  else if (share > 0.55 && share <= 0.75) engagement = 68;
  else if (share > 0.75) engagement = 46;

  const turnTaking = 88 - interruptionRatio(input.segments) * 45;
  const harshHits = countHits(input.salesmanText, HARSH_WORDS);
  const listeningHits = countHits(input.salesmanText, LISTENING_PHRASES);
  const tone = 78 - harshHits * 14 + Math.min(10, listeningHits * 5);

  return clampScore(lengthScore * 0.3 + engagement * 0.3 + turnTaking * 0.2 + tone * 0.2);
}

function productKnowledgeScore(input: {
  salesmanText: string;
  segments: ScoringSegment[];
  questions: string[];
  keyPoints: string[];
}): number {
  const featureHits = countHits(input.salesmanText, FEATURE_TERMS);
  const benefitHits = countHits(input.salesmanText, BENEFIT_TERMS);
  const featureScore = Math.min(88, 40 + featureHits * 10);
  const benefitScore = Math.min(88, 42 + benefitHits * 12);
  const answerScore = 38 + questionsAnswered(input.segments, input.questions) * 48;
  const keyPointBonus = Math.min(8, input.keyPoints.length * 2);
  return clampScore(featureScore * 0.3 + benefitScore * 0.25 + answerScore * 0.35 + 30 * 0.1 + keyPointBonus);
}

function objectionHandlingScore(input: {
  salesmanText: string;
  objections: string[];
  sentiment?: string | null;
}): number {
  if (input.objections.length === 0) {
    return clampScore(input.sentiment === "positive" ? 72 : 64);
  }

  const acknowledged = countHits(input.salesmanText, ACKNOWLEDGE_TERMS);
  const solutions = countHits(input.salesmanText, SOLUTION_TERMS);
  const handledRatio = Math.min(1, (acknowledged + solutions) / (input.objections.length * 1.4));
  let score = 42 + handledRatio * 40;
  if (input.sentiment === "positive") score += 10;
  if (input.sentiment === "negative") score -= 8;
  if (solutions === 0) score -= 6;
  return clampScore(score);
}

function closingAbilityScore(input: {
  salesmanText: string;
  purchaseIntent?: string | null;
}): number {
  const closeHits = countHits(input.salesmanText, CLOSE_PHRASES);
  const paymentHits = countHits(input.salesmanText, PAYMENT_TERMS);
  const urgencyHits = countHits(input.salesmanText, URGENCY_TERMS);
  let score = 36 + Math.min(24, closeHits * 12) + Math.min(16, paymentHits * 8) + Math.min(12, urgencyHits * 6);

  if (input.purchaseIntent === "high" && closeHits === 0) score -= 14;
  if (input.purchaseIntent === "high" && closeHits > 0) score += 10;
  if (input.purchaseIntent === "low" && closeHits > 0) score += 6;
  return clampScore(score);
}

function recommendationsFor(weaknesses: string[]): string[] {
  const tips: Record<string, string> = {
    Communication: "Give the customer more time to speak and avoid talking over them.",
    "Product knowledge": "Name specific product features and turn each one into a customer benefit.",
    "Objection handling": "Acknowledge the concern first, then offer a clear alternative or solution.",
    "Closing ability": "Ask for the sale and mention payment options before the customer leaves.",
    "Rule compliance": "Cover the required talking points: greeting, budget, warranty, and return policy.",
  };
  return weaknesses.map((name) => tips[name]).filter((item): item is string => Boolean(item));
}

export function scoreConversation(
  analysis: ScoringAnalysis,
  transcript: string,
  segments: ScoringSegment[],
  ruleComplianceScore?: number | null,
): ConversationScore {
  const salesman = speakerText(segments, "salesman", transcript);
  const customer = speakerText(segments, "customer", "");
  const duration = analysis.duration_spoken_seconds ?? 0;
  const compliance =
    typeof ruleComplianceScore === "number" && Number.isFinite(ruleComplianceScore)
      ? clampScore(ruleComplianceScore)
      : 70;

  const communication = communicationScore({
    transcript,
    salesmanText: salesman,
    customerWords: wordCount(customer),
    salesmanWords: wordCount(salesman),
    duration,
    segments,
  });
  const product = productKnowledgeScore({
    salesmanText: salesman,
    segments,
    questions: analysis.customer_questions ?? [],
    keyPoints: analysis.key_points ?? [],
  });
  const objections = objectionHandlingScore({
    salesmanText: salesman,
    objections: analysis.objections ?? [],
    sentiment: analysis.sentiment,
  });
  const closing = closingAbilityScore({
    salesmanText: salesman,
    purchaseIntent: analysis.purchase_intent,
  });

  const overall = clampScore(
    communication * WEIGHTS.communication_score +
      product * WEIGHTS.product_knowledge_score +
      objections * WEIGHTS.objection_handling_score +
      closing * WEIGHTS.closing_ability_score +
      compliance * WEIGHTS.rule_compliance_score,
  );

  const ranked = (
    [
      ["communication_score", communication],
      ["product_knowledge_score", product],
      ["objection_handling_score", objections],
      ["closing_ability_score", closing],
      ["rule_compliance_score", compliance],
    ] as const
  )
    .map(([key, value]) => ({ label: DIMENSION_LABELS[key], value }))
    .sort((a, b) => b.value - a.value);

  const strengths = ranked.slice(0, 2).map((item) => item.label);
  const weaknesses = ranked.slice(-2).reverse().map((item) => item.label);

  return {
    overall_score: overall,
    communication_score: communication,
    product_knowledge_score: product,
    objection_handling_score: objections,
    closing_ability_score: closing,
    rule_compliance_score: compliance,
    strengths,
    weaknesses,
    recommendations: recommendationsFor(weaknesses),
  };
}
