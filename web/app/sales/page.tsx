"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { SaleListItem } from "@/lib/types";

export default function SalesPage() {
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ sales: SaleListItem[] }>("/api/sales")
      .then((res) => setSales(res.sales))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Sales</h1>
        <Link href="/sales/new" className="bg-brand text-white text-sm font-medium rounded-lg px-3 py-2">
          + New Sale
        </Link>
      </div>

      {loading && <div className="text-slate-400 text-sm">Loading...</div>}
      {!loading && sales.length === 0 && <div className="card text-slate-400 text-sm">No sales yet. Tap "New Sale" to record one.</div>}

      <div className="space-y-2">
        {sales.map((s) => (
          <Link href={`/sales/${s.id}`} key={s.id} className="card flex items-center justify-between block">
            <div>
              <div className="font-medium">{s.customers?.name || "Walk-in customer"}</div>
              <div className="text-xs text-slate-400">
                {s.invoice_no} · {new Date(s.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{s.total.toFixed(2)}</div>
              {s.due_amount > 0 ? (
                <div className="text-xs text-red-500">Due {s.due_amount.toFixed(2)}</div>
              ) : (
                <div className="text-xs text-emerald-600">Paid</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
