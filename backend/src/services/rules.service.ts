import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";

export type ConversationRule = {
  id: string;
  organization_id: string;
  rule_type: string;
  description: string;
  keywords: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type RuleEvaluation = {
  rule_id: string;
  rule_type: string;
  description: string;
  is_followed: boolean;
  evidence: string | null;
};

export const DEFAULT_RULES: Array<{
  rule_type: string;
  description: string;
  keywords: string[];
}> = [
  { rule_type: "greeting", description: "Greeting required", keywords: ["salam", "hello", "welcome", "assalam"] },
  { rule_type: "budget", description: "Ask budget", keywords: ["budget", "price range", "kitna", "range"] },
  { rule_type: "warranty", description: "Explain warranty", keywords: ["warranty", "guarantee", "waranti"] },
  { rule_type: "return_policy", description: "Explain return policy", keywords: ["return", "exchange", "wapsi"] },
  { rule_type: "custom", description: "Mention benefits", keywords: ["benefit", "faida", "feature", "advantage"] },
  { rule_type: "discount", description: "No unauthorized discount", keywords: ["extra discount", "special price"] },
];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter((item) => item.trim().length > 0);
}

function mapRule(row: Record<string, unknown>): ConversationRule {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    rule_type: String(row.rule_type),
    description: String(row.description ?? ""),
    keywords: asStringArray(row.keywords),
    is_active: row.is_active !== false,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 40);
  return text.slice(start, end).trim();
}

export function findKeywordEvidence(transcript: string, keywords: string[]): string | null {
  const haystack = transcript.toLowerCase();
  for (const keyword of keywords) {
    const needle = keyword.trim().toLowerCase();
    if (!needle) continue;
    const index = haystack.indexOf(needle);
    if (index >= 0) return snippetAround(transcript, index, needle.length);
  }
  return null;
}

export function evaluateRules(transcript: string, rules: ConversationRule[]): RuleEvaluation[] {
  return rules.map((rule) => {
    const evidence = findKeywordEvidence(transcript, rule.keywords);
    const inverted = rule.rule_type === "discount";
    const isFollowed = inverted ? evidence === null : evidence !== null;
    return {
      rule_id: rule.id,
      rule_type: rule.rule_type,
      description: rule.description,
      is_followed: isFollowed,
      evidence: inverted && evidence ? `Unauthorized language: ${evidence}` : evidence,
    };
  });
}

export function compliancePercent(results: RuleEvaluation[]): number | null {
  if (results.length === 0) return null;
  const followed = results.filter((item) => item.is_followed).length;
  return Math.round((followed / results.length) * 100);
}

export async function listRules(organizationId: string, includeInactive = true): Promise<ConversationRule[]> {
  await ensureDefaultRules(organizationId);
  let query = getSupabase()
    .from("conversation_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) {
    logger.error({ error, organizationId }, "Failed to list conversation rules");
    throw new HttpError(500, "Failed to load rules.", "RULES_LOAD_FAILED");
  }
  return (data ?? []).map((row) => mapRule(row as Record<string, unknown>));
}

export async function ensureDefaultRules(organizationId: string): Promise<void> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("conversation_rules")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (error) {
    logger.error({ error, organizationId }, "Failed to count conversation rules");
    return;
  }
  if ((count ?? 0) > 0) return;

  const { error: insertError } = await supabase.from("conversation_rules").insert(
    DEFAULT_RULES.map((rule) => ({
      organization_id: organizationId,
      rule_type: rule.rule_type,
      description: rule.description,
      keywords: rule.keywords,
      is_active: true,
    })),
  );
  if (insertError) {
    logger.error({ error: insertError, organizationId }, "Failed to seed default conversation rules");
  }
}

export async function createRule(
  organizationId: string,
  input: { rule_type: string; description: string; keywords: string[]; is_active?: boolean },
): Promise<ConversationRule> {
  const { data, error } = await getSupabase()
    .from("conversation_rules")
    .insert({
      organization_id: organizationId,
      rule_type: input.rule_type,
      description: input.description,
      keywords: input.keywords,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();
  if (error || !data) {
    logger.error({ error, organizationId }, "Failed to create conversation rule");
    throw new HttpError(500, "Failed to create rule.", "RULE_CREATE_FAILED");
  }
  return mapRule(data as Record<string, unknown>);
}

export async function updateRule(
  organizationId: string,
  ruleId: string,
  input: Partial<{ rule_type: string; description: string; keywords: string[]; is_active: boolean }>,
): Promise<ConversationRule> {
  const { data, error } = await getSupabase()
    .from("conversation_rules")
    .update(input)
    .eq("id", ruleId)
    .eq("organization_id", organizationId)
    .select()
    .maybeSingle();
  if (error) {
    logger.error({ error, ruleId }, "Failed to update conversation rule");
    throw new HttpError(500, "Failed to update rule.", "RULE_UPDATE_FAILED");
  }
  if (!data) throw new HttpError(404, "Rule not found.", "NOT_FOUND");
  return mapRule(data as Record<string, unknown>);
}

export async function softDeleteRule(organizationId: string, ruleId: string): Promise<ConversationRule> {
  return updateRule(organizationId, ruleId, { is_active: false });
}

export async function saveRuleResults(conversationId: string, results: RuleEvaluation[]): Promise<RuleEvaluation[]> {
  const supabase = getSupabase();
  await supabase.from("conversation_rule_results").delete().eq("conversation_id", conversationId);
  if (results.length === 0) return [];

  const { error } = await supabase.from("conversation_rule_results").insert(
    results.map((result) => ({
      conversation_id: conversationId,
      rule_id: result.rule_id,
      is_followed: result.is_followed,
      evidence: result.evidence,
    })),
  );
  if (error) {
    logger.error({ error, conversationId }, "Failed to save rule results");
    throw new HttpError(500, "Failed to save rule results.", "RULE_RESULTS_SAVE_FAILED");
  }
  return results;
}

export async function getConversationRuleResults(
  conversationId: string,
  organizationId: string,
): Promise<RuleEvaluation[]> {
  const supabase = getSupabase();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!conversation) throw new HttpError(404, "Conversation not found.", "NOT_FOUND");

  const { data, error } = await supabase
    .from("conversation_rule_results")
    .select("rule_id, is_followed, evidence, conversation_rules (rule_type, description)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) {
    logger.error({ error, conversationId }, "Failed to load rule results");
    throw new HttpError(500, "Failed to load rule results.", "RULE_RESULTS_LOAD_FAILED");
  }

  return (data ?? []).map((row) => {
    const rule = Array.isArray(row.conversation_rules) ? row.conversation_rules[0] : row.conversation_rules;
    return {
      rule_id: String(row.rule_id),
      rule_type: String(rule?.rule_type ?? "custom"),
      description: String(rule?.description ?? ""),
      is_followed: Boolean(row.is_followed),
      evidence: row.evidence ? String(row.evidence) : null,
    };
  });
}

export async function evaluateAndSaveRules(input: {
  conversationId: string;
  organizationId: string;
  transcript: string;
}): Promise<RuleEvaluation[]> {
  const rules = (await listRules(input.organizationId, false)).filter((rule) => rule.is_active);
  const results = evaluateRules(input.transcript, rules);
  return saveRuleResults(input.conversationId, results);
}
