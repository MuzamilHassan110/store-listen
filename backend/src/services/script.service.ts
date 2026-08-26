import { z } from "zod";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";

export type SalesScriptContent = {
  opening: string;
  value_proposition: string;
  objection_handlers: Array<{ objection: string; response: string }>;
  closing: string;
};

export const generateScriptSchema = z.object({
  customer_id: z.string().uuid().optional(),
  customer_name: z.string().optional(),
  product_id: z.string().uuid().optional(),
  product_name: z.string().optional(),
  preferred_language: z.string().optional(),
  objections: z.array(z.string()).optional(),
});

export const saveScriptSchema = z.object({
  name: z.string().min(1),
  script_type: z.string().optional(),
  content: z.object({
    opening: z.string(),
    value_proposition: z.string(),
    objection_handlers: z.array(z.object({ objection: z.string(), response: z.string() })),
    closing: z.string(),
  }),
});

export function buildSalesScript(input: {
  customerName: string;
  productName: string;
  language?: string;
  objections?: string[];
}): SalesScriptContent {
  const name = input.customerName || "ji";
  const product = input.productName || "yeh model";
  const ur = (input.language ?? "en").startsWith("ur") || input.language === "pa";
  const opening = ur
    ? `Assalam-o-Alaikum ${name}, aap ne pichli dafa ${product} ke bare mein poocha tha. Aaj main update de sakta hoon.`
    : `Hello ${name}, last time you asked about ${product}. I have a quick update that matches what you wanted.`;
  const value_proposition = ur
    ? `${product} battery, camera, aur warranty ke sath aata hai — wohi points jo aap ne mention kiye.`
    : `${product} covers the battery, camera, and warranty points you mentioned.`;
  const handlers = (input.objections?.length ? input.objections : ["Price high hai"]).map((objection) => ({
    objection,
    response: /price|mehnga|expensive/i.test(objection)
      ? ur
        ? "Hum EMI option dete hain, monthly installment se budget match ho jata hai."
        : "We can split this on EMI so the monthly amount fits the budget you mentioned."
      : ur
        ? "Main yeh point note kar leta hoon aur alternative option dikhata hoon."
        : "I can show an alternative that avoids that issue.",
  }));
  const closing = ur
    ? "Aaj order karein to free delivery aur setup mil sakti hai. Confirm karun?"
    : "If we book today I can include delivery. Shall I confirm the order?";
  return { opening, value_proposition, objection_handlers: handlers, closing };
}

export async function generateSalesScript(
  organizationId: string,
  input: z.infer<typeof generateScriptSchema>,
): Promise<SalesScriptContent> {
  let customerName = input.customer_name ?? "ji";
  let language = input.preferred_language ?? "en";
  let objections = input.objections ?? [];
  if (input.customer_id) {
    const { data } = await getSupabase()
      .from("customers")
      .select("name, preferred_language")
      .eq("id", input.customer_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (data?.name) customerName = String(data.name);
    if (data?.preferred_language) language = String(data.preferred_language);
  }
  let productName = input.product_name ?? "this model";
  if (input.product_id) {
    const { data } = await getSupabase()
      .from("products")
      .select("name")
      .eq("id", input.product_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (data?.name) productName = String(data.name);
  }
  return buildSalesScript({ customerName, productName, language, objections });
}

export async function listScripts(organizationId: string) {
  const { data, error } = await getSupabase()
    .from("sales_scripts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) {
    logger.warn({ error }, "Script list failed; run migration 013");
    return [];
  }
  return data ?? [];
}

export async function saveScript(organizationId: string, input: z.infer<typeof saveScriptSchema>) {
  const { data, error } = await getSupabase()
    .from("sales_scripts")
    .insert({
      organization_id: organizationId,
      name: input.name,
      script_type: input.script_type ?? "personalized",
      content: input.content,
    })
    .select()
    .single();
  if (error || !data) throw new HttpError(500, "Could not save script. Apply migration 013.", "SCRIPT_SAVE_FAILED");
  return data;
}

export async function updateScript(
  organizationId: string,
  id: string,
  input: z.infer<typeof saveScriptSchema>,
) {
  const { data, error } = await getSupabase()
    .from("sales_scripts")
    .update({ name: input.name, script_type: input.script_type ?? "personalized", content: input.content })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .maybeSingle();
  if (error || !data) throw new HttpError(404, "Script not found.", "NOT_FOUND");
  return data;
}

export async function deleteScript(organizationId: string, id: string): Promise<void> {
  const { error } = await getSupabase().from("sales_scripts").delete().eq("id", id).eq("organization_id", organizationId);
  if (error) throw new HttpError(500, "Could not delete script.", "SCRIPT_DELETE_FAILED");
}
