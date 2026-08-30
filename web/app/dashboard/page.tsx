"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";

type RangeKey = "today" | "7days" | "month";

const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  "7days": "Last 7 Days",
  month: "This Month",
};

function money(n: number | undefined) {
  return (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<DashboardData>(`/api/dashboard?range=${range}`)
      .then((res) => !cancelled && setData(res))
      .catch((e: ApiError) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <button className="text-sm text-slate-500 underline" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>

      <div className="flex gap-2">
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              range === key ? "bg-brand text-white" : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      {error && <div className="card text-red-600 text-sm">{error}</div>}

      {loading && !data && <div className="text-slate-400 text-sm px-1">Loading...</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="Sold" value={money(data.sales_total)} tone="brand" />
            <SummaryCard label="Collected" value={money(data.collected_total)} tone="green" />
            <SummaryCard label="Customer Due" value={money(data.due_total)} tone="amber" />
            <SummaryCard label="Expenses" value={money(data.expenses_total)} tone="red" />
          </div>

          <div className="card">
            <div className="text-sm text-slate-500">Profit ({RANGE_LABELS[range]})</div>
            <div className={`text-3xl font-bold mt-1 ${data.profit_total >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {money(data.profit_total)}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Needs Attention</div>
            </div>
            {data.low_stock.length === 0 && data.top_due_customers.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing urgent right now.</p>
            ) : (
              <div className="space-y-3">
                {data.low_stock.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-amber-600 uppercase mb-1">Low Stock</div>
                    {data.low_stock.slice(0, 5).map((p) => (
                      <div key={p.id} className="flex justify-between text-sm py-1">
                        <span>{p.name}</span>
                        <span className="text-amber-600 font-medium">
                          {p.stock_qty} {p.unit} left
                        </span>
                      </div>
                    ))}
                    <Link href="/products" className="text-sm text-brand font-medium">
                      View all stock →
                    </Link>
                  </div>
                )}
                {data.top_due_customers.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-red-500 uppercase mb-1 mt-2">Customers Who Owe You</div>
                    {data.top_due_customers.map((c) => (
                      <div key={c.customer_id} className="flex justify-between text-sm py-1">
                        <span>{c.customer_name}</span>
                        <span className="text-red-500 font-medium">{money(c.current_due)}</span>
                      </div>
                    ))}
                    <Link href="/customers" className="text-sm text-brand font-medium">
                      View all customers →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <Link href="/sales/new" className="btn-primary w-full block text-center">
            + New Sale
          </Link>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "brand" | "green" | "amber" | "red" }) {
  const toneClass = {
    brand: "text-brand",
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-500",
  }[tone];
  return (
    <div className="card">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
