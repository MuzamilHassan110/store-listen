import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "../contexts/LanguageContext";
import {
  deleteScript,
  fetchCustomers,
  fetchProducts,
  fetchScripts,
  generateScript,
  saveScript,
  updateScript,
} from "../services/api";
import type { SalesScriptContent, StoredScript } from "../types/conversation";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

const emptyContent: SalesScriptContent = {
  opening: "",
  value_proposition: "",
  objection_handlers: [{ objection: "Price high hai", response: "" }],
  closing: "",
};

function scriptText(content: SalesScriptContent): string {
  const handlers = content.objection_handlers
    .map((item) => `If they say “${item.objection}”: ${item.response}`)
    .join("\n");
  return [content.opening, content.value_proposition, handlers, content.closing].filter(Boolean).join("\n\n");
}

export default function Scripts() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [name, setName] = useState("Personalized pitch");
  const [scriptType, setScriptType] = useState("follow_up");
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [productName, setProductName] = useState("");
  const [language, setLanguage] = useState("ur");
  const [content, setContent] = useState<SalesScriptContent>(emptyContent);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const scripts = useQuery({ queryKey: ["scripts"], queryFn: fetchScripts });
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => fetchCustomers() });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const generate = useMutation({
    mutationFn: () =>
      generateScript({
        customer_id: customerId || undefined,
        product_id: productId || undefined,
        customer_name: customerName || undefined,
        product_name: productName || undefined,
        preferred_language: language,
      }),
    onSuccess: (result) => setContent(result),
  });
  const save = useMutation({
    mutationFn: () =>
      editingId
        ? updateScript(editingId, { name, script_type: scriptType, content })
        : saveScript({ name, script_type: scriptType, content }),
    onSuccess: () => {
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["scripts"] });
    },
  });
  const remove = useMutation({
    mutationFn: deleteScript,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["scripts"] }),
  });

  async function copyScript(): Promise<void> {
    await navigator.clipboard.writeText(scriptText(content));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function startEdit(script: StoredScript): void {
    setEditingId(script.id);
    setName(script.name ?? "Script");
    setScriptType(script.script_type ?? "follow_up");
    setContent(script.content);
  }

  function onSave(event: FormEvent): void {
    event.preventDefault();
    save.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pages.scripts")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("pages.scriptsHint")}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Generate script</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Customer (optional)</option>
              {(customers.data ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name || "Unnamed"} {customer.phone ? `· ${customer.phone}` : ""}
                </option>
              ))}
            </Select>
            <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Product (optional)</option>
              {(products.data ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </Select>
            <Input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input placeholder="Product name" value={productName} onChange={(e) => setProductName(e.target.value)} />
            <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="ur">Urdu</option>
              <option value="en">English</option>
            </Select>
            <Button type="button" onClick={() => generate.mutate()} disabled={generate.isPending}>
              {generate.isPending ? t("common.loading") : "Generate script"}
            </Button>
            {generate.isError ? <p className="text-sm text-red-300">{generate.error.message}</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit script" : "Script editor"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onSave}>
              <Input placeholder="Script name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input placeholder="Type (follow_up, closing)" value={scriptType} onChange={(e) => setScriptType(e.target.value)} />
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm dark:bg-slate-950"
                placeholder="Opening"
                value={content.opening}
                onChange={(e) => setContent((current) => ({ ...current, opening: e.target.value }))}
              />
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Value proposition"
                value={content.value_proposition}
                onChange={(e) => setContent((current) => ({ ...current, value_proposition: e.target.value }))}
              />
              {content.objection_handlers.map((handler, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-2">
                  <Input
                    placeholder="Objection"
                    value={handler.objection}
                    onChange={(e) =>
                      setContent((current) => ({
                        ...current,
                        objection_handlers: current.objection_handlers.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, objection: e.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <Input
                    placeholder="Response"
                    value={handler.response}
                    onChange={(e) =>
                      setContent((current) => ({
                        ...current,
                        objection_handlers: current.objection_handlers.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, response: e.target.value } : item,
                        ),
                      }))
                    }
                  />
                </div>
              ))}
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Closing"
                value={content.closing}
                onChange={(e) => setContent((current) => ({ ...current, closing: e.target.value }))}
              />
              {save.isError ? <p className="text-sm text-red-300">{save.error.message}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={save.isPending || !content.opening}>
                  {save.isPending ? t("common.loading") : t("common.save")}
                </Button>
                <Button type="button" variant="secondary" onClick={() => void copyScript()} disabled={!content.opening}>
                  {copied ? "Copied" : t("common.copy")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      {scripts.isLoading ? (
        <Skeleton className="h-40" />
      ) : scripts.isError ? (
        <ErrorState message={scripts.error.message} onRetry={() => void scripts.refetch()} />
      ) : !scripts.data?.length ? (
        <EmptyState title="No saved scripts" hint="Generate a pitch, then save it for the team." />
      ) : (
        <div className="space-y-3">
          {scripts.data.map((script) => (
            <Card key={script.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{script.name || "Untitled script"}</p>
                  <p className="mt-1 text-xs uppercase text-slate-500">{script.script_type || "general"}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-400">{script.content.opening}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(script)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove.mutate(script.id)}>
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
