"use client";
import { useSearchParams } from "next/navigation";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface CustomerDetail {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    reminder_enabled: boolean;
    reminder_day: number | null;
  };
  total_sales: number;
  total_paid: number;
  current_due: number;
  sales: { id: string; invoice_no: string; total: number; paid_amount: number; due_amount: number; created_at: string }[];
  payments: { id: string; amount: number; method: string; note: string | null; created_at: string }[];
}

export default function CustomerDetailPage() {
  const params = useSearchParams();
  const customerId = params.get("id");
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);

  function load() {
    api.get<CustomerDetail>(`/api/customers/${customerId}`).then(setData);
  }

  useEffect(load, [customerId]);

  async function handleReceivePayment() {
    setError(null);
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/customers/${customerId}/payments`, { amount, method: "cash" });
      setPaymentAmount("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not record payment");
    } finally {
      setSaving(false);
    }
  }

  async function toggleReminder(enabled: boolean) {
    await api.put(`/api/customers/${customerId}`, { reminder_enabled: enabled });
    load();
  }

  async function sendReminderNow() {
    setReminderMsg(null);
    try {
      const res = await api.post<{ sent: boolean; message_id?: string; error?: string }>(`/api/whatsapp/send-now/${customerId}`);
      setReminderMsg(res.sent ? "Reminder sent via WhatsApp." : `Not sent: ${res.error}`);
    } catch (e) {
      setReminderMsg(e instanceof ApiError ? e.message : "Could not send reminder");
    }
  }

  if (!data) return <div className="p-4 text-slate-400 text-sm">Loading...</div>;
  const { customer, current_due, total_sales, total_paid, sales, payments } = data;

  return (
    <div className="p-4 space-y-4">
      <div className="card">
        <div className="font-bold text-lg">{customer.name}</div>
        {customer.phone && <div className="text-sm text-slate-400">{customer.phone}</div>}
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div>
            <div className="text-xs text-slate-400">Total Sales</div>
            <div className="font-semibold">{total_sales.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Paid</div>
            <div className="font-semibold text-emerald-600">{total_paid.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Current Due</div>
            <div className="font-semibold text-red-500">{current_due.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {current_due > 0 && (
        <div className="card space-y-3">
          <div className="font-semibold text-sm">Receive Payment</div>
          <input className="input" type="number" placeholder="Amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" onClick={handleReceivePayment} disabled={saving}>
            {saving ? "Saving..." : "Record Payment"}
          </button>
        </div>
      )}

      <div className="card space-y-3">
        <div className="font-semibold text-sm">Due Reminder (WhatsApp)</div>
        <label className="flex items-center justify-between text-sm">
          <span>Automatic reminder</span>
          <input type="checkbox" checked={customer.reminder_enabled} onChange={(e) => toggleReminder(e.target.checked)} />
        </label>
        {current_due > 0 && (
          <button className="btn-secondary w-full" onClick={sendReminderNow}>
            Send Reminder Now
          </button>
        )}
        {reminderMsg && <p className="text-sm text-slate-500">{reminderMsg}</p>}
      </div>

      <div className="card">
        <div className="font-semibold text-sm mb-2">Sale History</div>
        {sales.length === 0 && <p className="text-sm text-slate-400">No sales yet.</p>}
        {sales.map((s) => (
          <div key={s.id} className="flex justify-between text-sm py-1.5 border-t first:border-t-0 border-slate-100">
            <div>
              <div>{s.invoice_no}</div>
              <div className="text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString()}</div>
            </div>
            <div className="text-right">
              <div>{s.total.toFixed(2)}</div>
              {s.due_amount > 0 && <div className="text-xs text-red-500">Due {s.due_amount.toFixed(2)}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="font-semibold text-sm mb-2">Payment History</div>
        {payments.length === 0 && <p className="text-sm text-slate-400">No payments yet.</p>}
        {payments.map((p) => (
          <div key={p.id} className="flex justify-between text-sm py-1.5 border-t first:border-t-0 border-slate-100">
            <div>{new Date(p.created_at).toLocaleDateString()}</div>
            <div className="font-medium text-emerald-600">{p.amount.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
