import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "../contexts/LanguageContext";
import { createProduct, deleteProduct, fetchProducts, updateProduct } from "../services/api";
import type { CatalogProduct } from "../types/conversation";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

const emptyForm = {
  name: "",
  category: "",
  price_range: "",
  brand: "",
  features: "",
};

export default function Products() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const save = useMutation({
    mutationFn: (input: Omit<CatalogProduct, "id"> & { id?: string }) => {
      const { id, ...body } = input;
      return id ? updateProduct(id, body) : createProduct(body);
    },
    onSuccess: () => {
      setForm(emptyForm);
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
  const remove = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    save.mutate({
      id: editingId ?? undefined,
      name: form.name,
      category: form.category || undefined,
      price_range: form.price_range || undefined,
      brand: form.brand || undefined,
      features: form.features
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });
  }

  function startEdit(product: CatalogProduct): void {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category ?? "",
      price_range: product.price_range ?? "",
      brand: product.brand ?? "",
      features: product.features.join(", "),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pages.products")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("pages.productsHint")}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit product" : "Add product"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              required
            />
            <Input
              placeholder="Brand"
              value={form.brand}
              onChange={(e) => setForm((current) => ({ ...current, brand: e.target.value }))}
            />
            <Input
              placeholder="Category"
              value={form.category}
              onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))}
            />
            <Input
              placeholder="Price range (e.g. 50k-100k PKR)"
              value={form.price_range}
              onChange={(e) => setForm((current) => ({ ...current, price_range: e.target.value }))}
            />
            <Input
              className="md:col-span-2"
              placeholder="Features, comma separated (camera, battery)"
              value={form.features}
              onChange={(e) => setForm((current) => ({ ...current, features: e.target.value }))}
            />
            {save.isError ? <p className="text-sm text-red-300 md:col-span-2">{save.error.message}</p> : null}
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? t("common.loading") : editingId ? "Update product" : "Create product"}
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
                  {t("common.cancel")}
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
      {products.isLoading ? (
        <Skeleton className="h-48" />
      ) : products.isError ? (
        <ErrorState message={products.error.message} onRetry={() => void products.refetch()} />
      ) : !products.data?.length ? (
        <EmptyState title="No products yet" hint="Add catalog items so AI can recommend them from transcripts." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {products.data.map((product) => (
            <Card key={product.id}>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs uppercase text-slate-500">
                      {product.brand || "No brand"} · {product.category || "uncategorized"}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                    {product.price_range || "price n/a"}
                  </span>
                </div>
                <p className="text-sm text-slate-400">{product.features.join(" · ") || "No features listed"}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(product)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove.mutate(product.id)}>
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
