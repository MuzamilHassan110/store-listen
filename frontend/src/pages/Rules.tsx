import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "../contexts/LanguageContext";
import { createRule, deleteRule, fetchRules, testRuleAgainstText, updateRule } from "../services/api";
import type { ConversationRule } from "../types/conversation";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

const RULE_TYPES = ["greeting", "warranty", "return_policy", "budget", "discount", "custom"];

const emptyForm = {
  rule_type: "custom",
  description: "",
  keywords: "",
  is_active: true,
};

export default function Rules() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sample, setSample] = useState("Assalam alaikum, your budget and warranty are covered.");
  const [testKeywords, setTestKeywords] = useState("salam, warranty");

  const rules = useQuery({ queryKey: ["rules"], queryFn: fetchRules });
  const save = useMutation({
    mutationFn: (input: Omit<ConversationRule, "id"> & { id?: string }) =>
      input.id
        ? updateRule(input.id, input)
        : createRule({
            rule_type: input.rule_type,
            description: input.description,
            keywords: input.keywords,
            is_active: input.is_active,
          }),
    onSuccess: () => {
      setForm(emptyForm);
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });
  const toggle = useMutation({
    mutationFn: (rule: ConversationRule) => updateRule(rule.id, { is_active: !rule.is_active }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rules"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rules"] }),
  });

  const test = testRuleAgainstText(
    testKeywords.split(",").map((item) => item.trim()).filter(Boolean),
    sample,
  );

  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    save.mutate({
      id: editingId ?? undefined,
      rule_type: form.rule_type,
      description: form.description,
      keywords: form.keywords.split(",").map((item) => item.trim()).filter(Boolean),
      is_active: form.is_active,
    });
  }

  function startEdit(rule: ConversationRule): void {
    setEditingId(rule.id);
    setForm({
      rule_type: rule.rule_type,
      description: rule.description,
      keywords: rule.keywords.join(", "),
      is_active: rule.is_active,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pages.rules")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("pages.rulesHint")}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit rule" : "Add rule"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onSubmit}>
              <Select value={form.rule_type} onChange={(e) => setForm((current) => ({ ...current, rule_type: e.target.value }))}>
                {RULE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                required
              />
              <Input
                placeholder="Keywords, comma separated"
                value={form.keywords}
                onChange={(e) => setForm((current) => ({ ...current, keywords: e.target.value }))}
                required
              />
              {save.isError ? <p className="text-sm text-red-300">{save.error.message}</p> : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : editingId ? "Update rule" : "Create rule"}
                </Button>
                {editingId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Test keywords</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={testKeywords} onChange={(e) => setTestKeywords(e.target.value)} placeholder="keywords" />
            <textarea
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              className="min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <p className={`text-sm ${test.matched ? "text-emerald-300" : "text-amber-300"}`}>
              {test.matched ? `Matched: ${test.evidence}` : "No keyword found in the sample text."}
            </p>
          </CardContent>
        </Card>
      </div>

      {rules.isLoading ? (
        <Skeleton className="h-48" />
      ) : rules.isError ? (
        <ErrorState message={rules.error.message} onRetry={() => void rules.refetch()} />
      ) : !rules.data?.length ? (
        <EmptyState title="No rules yet" hint="Create a rule or run a scoring job to seed the defaults." />
      ) : (
        <div className="space-y-3">
          {rules.data.map((rule) => (
            <Card key={rule.id} className={rule.is_active ? "" : "opacity-60"}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{rule.description}</p>
                  <p className="mt-1 text-xs uppercase text-slate-500">{rule.rule_type}</p>
                  <p className="mt-2 text-sm text-slate-400">{rule.keywords.join(", ") || "No keywords"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => toggle.mutate(rule)}>
                    {rule.is_active ? "Active" : "Inactive"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => startEdit(rule)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => remove.mutate(rule.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
