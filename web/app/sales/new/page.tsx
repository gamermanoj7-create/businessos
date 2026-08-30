"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Customer, Product } from "@/lib/types";

interface CartLine {
  product: Product;
  quantity: number;
}

export default function NewSalePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [discount, setDiscount] = useState<string>("0");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [productQuery, setProductQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ products: Product[] }>("/api/products").then((r) => setProducts(r.products));
    api.get<{ customers: Customer[] }>("/api/customers").then((r) => setCustomers(r.customers));
  }, []);

  const filteredProducts = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(productQuery.toLowerCase())).slice(0, 8),
    [products, productQuery]
  );

  const subtotal = useMemo(() => cart.reduce((sum, l) => sum + l.quantity * l.product.selling_price, 0), [cart]);
  const discountNum = Number(discount) || 0;
  const total = Math.max(0, subtotal - discountNum); // tax is computed server-side from real gst settings
  const paidNum = paidAmount === "" ? total : Number(paidAmount) || 0;
  const due = Math.max(0, total - paidNum);

  function addProduct(p: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        return prev.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product: p, quantity: 1 }];
    });
    setProductQuery("");
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.product.id !== productId));
    } else {
      setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, quantity: qty } : l)));
    }
  }

  async function handleSubmit() {
    setError(null);
    if (cart.length === 0) {
      setError("Add at least one product");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ sale: { id: string } }>("/api/sales", {
        customer_id: customerId || null,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity, unit_price: l.product.selling_price })),
        discount: discountNum,
        tax_enabled: taxEnabled,
        paid_amount: paidNum,
      });
      router.push(`/sales/detail?id=${res.sale.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save this sale");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold pt-2">New Sale</h1>

      <div className="card">
        <label className="label">Customer (optional)</label>
        <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Walk-in customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <label className="label">Add Product</label>
        <input className="input" placeholder="Search product..." value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
        {productQuery && (
          <div className="mt-2 border border-slate-200 rounded-xl divide-y">
            {filteredProducts.length === 0 && <div className="p-3 text-sm text-slate-400">No products found</div>}
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="w-full text-left p-3 flex justify-between items-center active:bg-slate-50"
              >
                <span>{p.name}</span>
                <span className="text-sm text-slate-500">
                  {p.selling_price.toFixed(2)} · {p.stock_qty} {p.unit}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="card space-y-3">
          <div className="font-semibold text-sm">Cart</div>
          {cart.map((line) => (
            <div key={line.product.id} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium">{line.product.name}</div>
                <div className="text-xs text-slate-400">{line.product.selling_price.toFixed(2)} each</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 rounded-full bg-slate-100" onClick={() => updateQty(line.product.id, line.quantity - 1)}>
                  −
                </button>
                <span className="w-6 text-center">{line.quantity}</span>
                <button className="w-8 h-8 rounded-full bg-slate-100" onClick={() => updateQty(line.product.id, line.quantity + 1)}>
                  +
                </button>
              </div>
              <div className="w-16 text-right text-sm font-medium">{(line.quantity * line.product.selling_price).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card space-y-3">
        <div>
          <label className="label">Discount</label>
          <input className="input" type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
          Apply GST / Tax (if enabled for your business)
        </label>
        <div>
          <label className="label">Paid Amount</label>
          <input
            className="input"
            type="number"
            min={0}
            placeholder={total.toFixed(2)}
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="card space-y-1 text-sm">
        <Row label="Subtotal" value={subtotal.toFixed(2)} />
        <Row label="Discount" value={`- ${discountNum.toFixed(2)}`} />
        <Row label="Total" value={total.toFixed(2)} bold />
        <Row label="Paid" value={paidNum.toFixed(2)} />
        <Row label="Due" value={due.toFixed(2)} tone={due > 0 ? "text-red-500" : "text-emerald-600"} />
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <button className="btn-primary w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Saving..." : "Complete Sale"}
      </button>
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
