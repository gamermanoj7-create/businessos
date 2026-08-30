"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Tab = "sales" | "profit" | "expenses" | "due" | "stock";
type RangeKey = "today" | "7days" | "month";

const TABS: { key: Tab; label: string }[] = [
  { key: "sales", label: "Sales" },
  { key: "profit", label: "Profit" },
  { key: "expenses", label: "Expenses" },
  { key: "due", label: "Customer Due" },
  { key: "stock", label: "Stock" },
];

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7days", label: "7 Days" },
  { key: "month", label: "This Month" },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("sales");
  const [range, setRange] = useState<RangeKey>("7days");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const needsRange = tab === "sales" || tab === "profit" || tab === "expenses";
    const path =
      tab === "due" ? "/api/reports/customer-due" : tab === "stock" ? "/api/reports/stock" : `/api/reports/${tab}${needsRange ? `?range=${range}` : ""}`;

    api
      .get<{ rows: any[] }>(path)
      .then((r) => setRows(r.rows || []))
      .finally(() => setLoading(false));
  }, [tab, range]);

  const showRangePicker = tab === "sales" || tab === "profit" || tab === "expenses";

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold pt-2">Reports</h1>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
              tab === t.key ? "bg-brand text-white" : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {showRangePicker && (
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                range === r.key ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="text-slate-400 text-sm">Loading...</div>}

      {!loading && rows.length === 0 && <div className="card text-slate-400 text-sm">No data for this period.</div>}

      <div className="space-y-2">
        {tab === "sales" &&
          rows.map((r, i) => (
            <div key={i} className="card flex justify-between text-sm">
              <span>{r.day}</span>
              <span>
                {r.orders_count} orders · {Number(r.sales_total).toFixed(2)}
              </span>
            </div>
          ))}

        {tab === "profit" &&
          rows.map((r, i) => (
            <div key={i} className="card flex justify-between text-sm">
              <span>{r.day}</span>
              <span className={Number(r.profit) >= 0 ? "text-emerald-600" : "text-red-500"}>{Number(r.profit).toFixed(2)}</span>
            </div>
          ))}

        {tab === "expenses" &&
          rows.map((r, i) => (
            <div key={i} className="card flex justify-between text-sm">
              <span>{r.category}</span>
              <span className="text-red-500">{Number(r.amount).toFixed(2)}</span>
            </div>
          ))}

        {tab === "due" &&
          rows.map((r, i) => (
            <div key={i} className="card flex justify-between text-sm">
              <span>{r.customer_name}</span>
              <span className="text-red-500">{Number(r.current_due).toFixed(2)}</span>
            </div>
          ))}

        {tab === "stock" &&
          rows.map((r, i) => (
            <div key={i} className="card flex justify-between text-sm">
              <span>{r.name}</span>
              <span className={r.is_low ? "text-amber-600 font-semibold" : "text-slate-600"}>{Number(r.stock_qty)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
