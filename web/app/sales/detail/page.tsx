"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";

interface InvoiceItem {
  id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  products: { name: string; unit: string } | null;
}

interface InvoiceData {
  sale: {
    id: string;
    invoice_no: string;
    subtotal: number;
    discount: number;
    tax_amount: number;
    total: number;
    paid_amount: number;
    due_amount: number;
    created_at: string;
    customers: { name: string; phone: string | null } | null;
  };
  items: InvoiceItem[];
}

export default function InvoicePage() {
  const [saleId, setSaleId] = useState<string | null>(null);
  const [data, setData] = useState<InvoiceData | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    setSaleId(id);
  }, []);

  useEffect(() => {
    if (!saleId) return;
    api.get<InvoiceData>(`/api/sales/${saleId}`).then(setData);
  }, [saleId]);

  if (!data) return <div className="p-4 text-slate-400 text-sm">Loading...</div>;

  const { sale, items } = data;

  return (
    <div className="p-4 space-y-4">
      <div className="card">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-bold text-lg">{sale.invoice_no}</div>
            <div className="text-xs text-slate-400">{new Date(sale.created_at).toLocaleString()}</div>
          </div>
          <div className={`text-xs font-semibold px-2 py-1 rounded-full ${sale.due_amount > 0 ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"}`}>
            {sale.due_amount > 0 ? "Due" : "Paid"}
          </div>
        </div>
        <div className="text-sm mt-2 text-slate-600">{sale.customers?.name || "Walk-in customer"}</div>
      </div>

      <div className="card divide-y">
        {items.map((it) => (
          <div key={it.id} className="py-2 flex justify-between text-sm">
            <div>
              <div className="font-medium">{it.products?.name}</div>
              <div className="text-xs text-slate-400">
                {it.quantity} {it.products?.unit} × {it.unit_price.toFixed(2)}
              </div>
            </div>
            <div className="font-medium">{it.line_total.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div className="card space-y-1 text-sm">
        <Row label="Subtotal" value={sale.subtotal.toFixed(2)} />
        <Row label="Discount" value={`- ${sale.discount.toFixed(2)}`} />
        {sale.tax_amount > 0 && <Row label="Tax" value={sale.tax_amount.toFixed(2)} />}
        <Row label="Total" value={sale.total.toFixed(2)} bold />
        <Row label="Paid" value={sale.paid_amount.toFixed(2)} />
        <Row label="Due" value={sale.due_amount.toFixed(2)} tone={sale.due_amount > 0 ? "text-red-500" : "text-emerald-600"} />
      </div>
    </div>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-base" : ""} ${tone || ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
