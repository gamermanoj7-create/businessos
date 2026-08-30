"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Expense } from "@/lib/types";

const CATEGORIES = ["Rent", "Salary", "Utilities", "Purchase", "Transport", "Other"];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<{ expenses: Expense[] }>("/api/expenses")
      .then((r) => setExpenses(r.expenses))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleAdd() {
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount");

    setSaving(true);
    try {
      await api.post("/api/expenses", { category, amount: amt, note: note.trim() || undefined });
      setAmount("");
      setNote("");
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Expenses</h1>
        <button className="bg-brand text-white text-sm font-medium rounded-lg px-3 py-2" onClick={() => setShowForm((s) => !s)}>
          + Add
        </button>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount</label>
            <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" onClick={handleAdd} disabled={saving}>
            {saving ? "Saving..." : "Save Expense"}
          </button>
        </div>
      )}

      {loading && <div className="text-slate-400 text-sm">Loading...</div>}
      {!loading && expenses.length === 0 && <div className="card text-slate-400 text-sm">No expenses recorded yet.</div>}

      <div className="space-y-2">
        {expenses.map((e) => (
          <div key={e.id} className="card flex items-center justify-between">
            <div>
              <div className="font-medium">{e.category}</div>
              <div className="text-xs text-slate-400">
                {e.expense_date} {e.note ? `· ${e.note}` : ""}
              </div>
            </div>
            <div className="font-semibold text-red-500">{e.amount.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
