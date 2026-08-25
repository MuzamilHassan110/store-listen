import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { exportCustomersCsv, fetchCustomers } from "../services/api";
import { ExportMenu } from "../components/ExportMenu";
import { formatDateTime } from "../lib/format";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { ScoreBar } from "../components/conversation/ScoreBar";

export default function Customers() {
  const [search, setSearch] = useState("");
  const list = useQuery({
    queryKey: ["customers", search],
    queryFn: () => fetchCustomers(search || undefined),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="mt-1 text-sm text-slate-400">People captured from store conversations and follow-ups.</p>
        </div>
        <ExportMenu onExport={exportCustomersCsv} />
      </div>
      <Input placeholder="Search name or phone" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
      {list.isLoading ? (
        <Skeleton className="h-48" />
      ) : list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState title="No customers yet" hint="High-intent conversations will create a customer profile automatically." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Visits</th>
                <th className="px-4 py-3 font-medium">Purchases</th>
                <th className="px-4 py-3 font-medium">Last visit</th>
                <th className="px-4 py-3 font-medium">Purchase probability</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((item) => (
                <tr key={item.id} className="border-t border-slate-800">
                  <td className="px-4 py-3">
                    <Link to={`/customers/${item.id}`} className="font-medium hover:text-emerald-300">
                      {item.name || "Unnamed customer"}
                    </Link>
                    <p className="text-xs text-slate-500">{item.phone || "No phone"}</p>
                  </td>
                  <td className="px-4 py-3">{item.total_visits}</td>
                  <td className="px-4 py-3">{item.total_purchases}</td>
                  <td className="px-4 py-3">{formatDateTime(item.last_visit_at)}</td>
                  <td className="px-4 py-3 min-w-[180px]">
                    <ScoreBar label="" icon="" value={item.purchase_probability} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
