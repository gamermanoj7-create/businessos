export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  reminder_enabled: boolean;
  reminder_day: number | null;
  created_at: string;
  current_due?: number;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  stock_qty: number;
  low_stock_threshold: number;
}

export interface SaleListItem {
  id: string;
  invoice_no: string;
  customer_id: string | null;
  total: number;
  paid_amount: number;
  due_amount: number;
  created_at: string;
  customers?: { name: string } | null;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  note: string | null;
  expense_date: string;
}

export interface DashboardData {
  range: { start: string; end: string };
  sales_total: number;
  collected_total: number;
  due_total: number;
  expenses_total: number;
  profit_total: number;
  low_stock: { id: string; name: string; stock_qty: number; low_stock_threshold: number; unit: string }[];
  top_due_customers: { customer_id: string; customer_name: string; phone: string | null; current_due: number }[];
}
