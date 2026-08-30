"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Product } from "@/lib/types";

const emptyForm = { name: "", unit: "pcs", purchase_price: "", selling_price: "", stock_qty: "", low_stock_threshold: "5" };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<{ products: Product[] }>("/api/products")
      .then((r) => setProducts(r.products))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      unit: p.unit,
      purchase_price: String(p.purchase_price),
      selling_price: String(p.selling_price),
      stock_qty: String(p.stock_qty),
      low_stock_threshold: String(p.low_stock_threshold),
    });
    setShowForm(true);
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) return setError("Enter product name");
    if (form.purchase_price === "" || form.selling_price === "") return setError("Enter both prices");

    const payload = {
      name: form.name.trim(),
      unit: form.unit || "pcs",
      purchase_price: Number(form.purchase_price),
      selling_price: Number(form.selling_price),
      stock_qty: Number(form.stock_qty || 0),
      low_stock_threshold: Number(form.low_stock_threshold || 5),
    };

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/products/${editing.id}`, payload);
      } else {
        await api.post("/api/products", payload);
      }
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Stock</h1>
        <button className="bg-brand text-white text-sm font-medium rounded-lg px-3 py-2" onClick={openAdd}>
          + Add
        </button>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <div>
            <label className="label">Product Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Unit</label>
              <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs" />
            </div>
            <div>
              <label className="label">Stock Quantity</label>
              <input className="input" type="number" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
            </div>
            <div>
              <label className="label">Purchase Price</label>
              <input className="input" type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
            </div>
            <div>
              <label className="label">Selling Price</label>
              <input className="input" type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Low Stock Alert Below</label>
            <input
              className="input"
              type="number"
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-slate-400 text-sm">Loading...</div>}

      <div className="space-y-2">
        {products.map((p) => {
          const isLow = p.stock_qty <= p.low_stock_threshold;
          return (
            <button key={p.id} onClick={() => openEdit(p)} className="card w-full flex items-center justify-between text-left">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-slate-400">
                  Buy {p.purchase_price.toFixed(2)} · Sell {p.selling_price.toFixed(2)}
                </div>
              </div>
              <div className={`text-sm font-semibold ${isLow ? "text-amber-600" : "text-slate-600"}`}>
                {p.stock_qty} {p.unit}
                {isLow && <div className="text-xs">Low stock</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
