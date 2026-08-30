"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<{ customers: Customer[] }>("/api/customers")
      .then((r) => setCustomers(r.customers))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleAdd() {
    setError(null);
    if (!name.trim()) {
      setError("Enter customer name");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/customers", { name: name.trim(), phone: phone.trim() || undefined });
      setName("");
      setPhone("");
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add customer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Customers</h1>
        <button className="bg-brand text-white text-sm font-medium rounded-lg px-3 py-2" onClick={() => setShowForm((s) => !s)}>
          + Add
        </button>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Phone (for WhatsApp reminders)</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+8801XXXXXXXXX" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" onClick={handleAdd} disabled={saving}>
            {saving ? "Saving..." : "Save Customer"}
          </button>
        </div>
      )}

      {loading && <div className="text-slate-400 text-sm">Loading...</div>}
      {!loading && customers.length === 0 && <div className="card text-slate-400 text-sm">No customers yet.</div>}

      <div className="space-y-2">
        {customers.map((c) => (
          <Link href={`/customers/detail?id=${c.id}`} key={c.id} className="card flex items-center justify-between block">
            <div>
              <div className="font-medium">{c.name}</div>
              {c.phone && <div className="text-xs text-slate-400">{c.phone}</div>}
            </div>
            <div className={`text-sm font-semibold ${(c.current_due || 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>
              {(c.current_due || 0) > 0 ? `Due ${c.current_due!.toFixed(2)}` : "Clear"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
