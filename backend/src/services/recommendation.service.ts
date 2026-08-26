import { z } from "zod";
import { countPhrase } from "./nlp.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";

export type ProductRow = {
  id: string;
  organization_id: string;
  name: string;
  category: string | null;
  price_range: string | null;
  features: string[];
  brand: string | null;
};

export type DetectedPreferences = {
  budget_range: string | null;
  features: string[];
  brands: string[];
  use_case: string | null;
};

export type ProductRecommendation = {
  detected_preferences: DetectedPreferences;
  recommended_products: Array<{ name: string; match_score: number; reasons: string[] }>;
  upsell_opportunities: Array<{ product: string; reason: string }>;
};

export const productSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  price_range: z.string().optional(),
  features: z.array(z.string()).optional(),
  brand: z.string().optional(),
});

const BRANDS = ["samsung", "iphone", "apple", "xiaomi", "infinix", "oppo", "vivo", "tecno", "oneplus"];
const FEATURES = ["camera", "battery", "storage", "display", "5g", "fast charging"];
const USE_CASES: Array<{ label: string; keys: string[] }> = [
  { label: "photography", keys: ["camera", "photo", "photos"] },
  { label: "gaming", keys: ["gaming", "game", "pubg"] },
  { label: "business", keys: ["business", "office", "work"] },
];

export function detectPreferences(transcript: string): DetectedPreferences {
  const text = transcript.toLowerCase();
  let budget_range: string | null = null;
  if (countPhrase(text, "under 50") || countPhrase(text, "50k") || countPhrase(text, "50,000")) {
    budget_range = "under 50k PKR";
  } else if (countPhrase(text, "1 lakh") || countPhrase(text, "100k") || countPhrase(text, "around 1")) {
    budget_range = "50k-100k PKR";
  } else if (countPhrase(text, "premium") || countPhrase(text, "flagship")) {
    budget_range = "100k+ PKR";
  }
  const features = FEATURES.filter((feature) => countPhrase(text, feature) > 0);
  const brands = BRANDS.filter((brand) => countPhrase(text, brand) > 0).map((brand) =>
    brand === "iphone" ? "Apple" : brand[0]!.toUpperCase() + brand.slice(1),
  );
  const use = USE_CASES.find((item) => item.keys.some((key) => countPhrase(text, key) > 0));
  return { budget_range, features, brands, use_case: use?.label ?? null };
}

function matchScore(product: ProductRow, prefs: DetectedPreferences): { score: number; reasons: string[] } {
  let score = 40;
  const reasons: string[] = [];
  if (product.brand && prefs.brands.some((brand) => brand.toLowerCase() === product.brand?.toLowerCase())) {
    score += 25;
    reasons.push(`${product.brand} matches brand preference`);
  }
  const overlap = (product.features ?? []).filter((feature) =>
    prefs.features.some((wanted) => wanted.toLowerCase() === feature.toLowerCase()),
  );
  if (overlap.length) {
    score += overlap.length * 10;
    reasons.push(`Has ${overlap.join(", ")}`);
  }
  if (prefs.budget_range && product.price_range && prefs.budget_range.includes(product.price_range)) {
    score += 15;
    reasons.push("Within budget");
  } else if (product.price_range) {
    reasons.push(`Priced ${product.price_range}`);
  }
  return { score: Math.min(99, score), reasons: reasons.length ? reasons : ["Catalog match"] };
}

export function rankProducts(products: ProductRow[], prefs: DetectedPreferences): ProductRecommendation {
  const ranked = products
    .map((product) => {
      const { score, reasons } = matchScore(product, prefs);
      return { name: product.name, match_score: score, reasons };
    })
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 5);

  if (!ranked.length && prefs.brands.length) {
    ranked.push({
      name: `${prefs.brands[0]} mid-range`,
      match_score: 70,
      reasons: ["Detected brand preference", ...(prefs.features.length ? [`Asked for ${prefs.features.join(", ")}`] : [])],
    });
  }

  const upsell: ProductRecommendation["upsell_opportunities"] = [];
  if (prefs.features.includes("camera") || prefs.use_case === "photography") {
    upsell.push({ product: "Flagship camera model", reason: "Customer mentioned premium camera features" });
  }
  if (prefs.budget_range === "under 50k PKR") {
    upsell.push({ product: "Extended warranty", reason: "Budget shoppers often value protection plans" });
  }

  return { detected_preferences: prefs, recommended_products: ranked, upsell_opportunities: upsell };
}

export async function listProducts(organizationId: string): Promise<ProductRow[]> {
  const { data, error } = await getSupabase().from("products").select("*").eq("organization_id", organizationId).order("name");
  if (error) {
    logger.warn({ error }, "Product list failed; run migration 013");
    return [];
  }
  return (data ?? []) as ProductRow[];
}

export async function createProduct(organizationId: string, input: z.infer<typeof productSchema>): Promise<ProductRow> {
  const { data, error } = await getSupabase()
    .from("products")
    .insert({
      organization_id: organizationId,
      name: input.name,
      category: input.category ?? null,
      price_range: input.price_range ?? null,
      features: input.features ?? [],
      brand: input.brand ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new HttpError(500, "Could not create product. Apply migration 013.", "PRODUCT_CREATE_FAILED");
  return data as ProductRow;
}

export async function updateProduct(
  organizationId: string,
  id: string,
  input: z.infer<typeof productSchema>,
): Promise<ProductRow> {
  const { data, error } = await getSupabase()
    .from("products")
    .update({
      name: input.name,
      category: input.category ?? null,
      price_range: input.price_range ?? null,
      features: input.features ?? [],
      brand: input.brand ?? null,
    })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .maybeSingle();
  if (error || !data) throw new HttpError(404, "Product not found.", "NOT_FOUND");
  return data as ProductRow;
}

export async function deleteProduct(organizationId: string, id: string): Promise<void> {
  const { error } = await getSupabase().from("products").delete().eq("id", id).eq("organization_id", organizationId);
  if (error) throw new HttpError(500, "Could not delete product.", "PRODUCT_DELETE_FAILED");
}

export async function recommendProducts(conversationId: string, organizationId: string): Promise<ProductRecommendation> {
  const { data: conversation } = await getSupabase()
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!conversation) throw new HttpError(404, "Conversation not found.", "NOT_FOUND");
  const { data: transcript } = await getSupabase()
    .from("transcripts")
    .select("text, original_text")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prefs = detectPreferences(String(transcript?.original_text ?? transcript?.text ?? ""));
  const products = await listProducts(organizationId);
  return rankProducts(products, prefs);
}
