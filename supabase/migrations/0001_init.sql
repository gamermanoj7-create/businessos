-- ============================================================================
-- BusinessOS Cloud AI — Initial Schema
-- Postgres / Supabase
-- Source of truth for all business data. No app-side localStorage/data.json.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- BUSINESSES (tenant root)
-- ----------------------------------------------------------------------------
create table businesses (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  currency        text not null default 'BDT',
  gst_enabled     boolean not null default false,
  gst_percent     numeric(5,2) not null default 0,
  low_stock_default int not null default 5,
  whatsapp_phone_number_id text,      -- WhatsApp Cloud API phone number id (per-business)
  reminder_default_day int not null default 3, -- days after due date to send first reminder
  created_at      timestamptz not null default now()
);

-- Membership: which auth users belong to which business, and their role.
-- This is the ONLY table that maps auth.uid() -> business_id, so every
-- other table's RLS policy goes through this table.
create table business_users (
  business_id     uuid not null references businesses(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'owner' check (role in ('owner','staff')),
  created_at      timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index idx_business_users_user on business_users(user_id);

-- Helper: fast membership check used by every RLS policy below.
create or replace function is_business_member(p_business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from business_users bu
    where bu.business_id = p_business_id
      and bu.user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- CUSTOMERS
-- ----------------------------------------------------------------------------
create table customers (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  name            text not null,
  phone           text,
  address         text,
  reminder_enabled boolean not null default true,
  reminder_day    int, -- overrides businesses.reminder_default_day if set
  created_at      timestamptz not null default now()
);

create index idx_customers_business on customers(business_id);
create index idx_customers_phone on customers(business_id, phone);

-- ----------------------------------------------------------------------------
-- PRODUCTS / STOCK
-- ----------------------------------------------------------------------------
create table products (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id) on delete cascade,
  name              text not null,
  unit              text not null default 'pcs',
  purchase_price    numeric(12,2) not null default 0 check (purchase_price >= 0),
  selling_price     numeric(12,2) not null default 0 check (selling_price >= 0),
  stock_qty         numeric(12,2) not null default 0 check (stock_qty >= 0),
  low_stock_threshold numeric(12,2) not null default 5,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_products_business on products(business_id);

-- ----------------------------------------------------------------------------
-- SALES (invoice header) + SALE_ITEMS (lines)
-- ----------------------------------------------------------------------------
create sequence if not exists invoice_seq;

create table sales (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  customer_id     uuid references customers(id) on delete set null,
  invoice_no      text not null,
  subtotal        numeric(12,2) not null default 0,
  discount        numeric(12,2) not null default 0 check (discount >= 0),
  tax_amount      numeric(12,2) not null default 0 check (tax_amount >= 0),
  total           numeric(12,2) not null default 0,
  paid_amount     numeric(12,2) not null default 0 check (paid_amount >= 0),
  due_amount      numeric(12,2) not null default 0,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (business_id, invoice_no)
);

create index idx_sales_business on sales(business_id, created_at desc);
create index idx_sales_customer on sales(customer_id);

create table sale_items (
  id                  uuid primary key default gen_random_uuid(),
  sale_id             uuid not null references sales(id) on delete cascade,
  product_id          uuid not null references products(id),
  quantity            numeric(12,2) not null check (quantity > 0),
  unit_price          numeric(12,2) not null check (unit_price >= 0),
  purchase_price_snap numeric(12,2) not null default 0, -- profit calc uses this snapshot, never recalculated later
  line_total          numeric(12,2) not null
);

create index idx_sale_items_sale on sale_items(sale_id);
create index idx_sale_items_product on sale_items(product_id);

-- ----------------------------------------------------------------------------
-- PAYMENTS (money received against a customer's due, optionally tied to a sale)
-- ----------------------------------------------------------------------------
create table payments (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade,
  sale_id         uuid references sales(id) on delete set null,
  amount          numeric(12,2) not null check (amount > 0),
  method          text not null default 'cash',
  note            text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index idx_payments_business on payments(business_id, created_at desc);
create index idx_payments_customer on payments(customer_id);

-- ----------------------------------------------------------------------------
-- EXPENSES
-- ----------------------------------------------------------------------------
create table expenses (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  category        text not null,
  amount          numeric(12,2) not null check (amount > 0),
  note            text,
  expense_date    date not null default current_date,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index idx_expenses_business on expenses(business_id, expense_date desc);

-- ----------------------------------------------------------------------------
-- CUSTOMER DUE REMINDERS / NOTIFICATIONS (WhatsApp)
-- ----------------------------------------------------------------------------
create table due_notifications (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references businesses(id) on delete cascade,
  customer_id         uuid not null references customers(id) on delete cascade,
  due_amount_snapshot numeric(12,2) not null,
  scheduled_for        date not null,
  status              text not null default 'pending'
                        check (status in ('pending','sent','failed','skipped')),
  attempt_count       int not null default 0,
  whatsapp_message_id text,       -- set ONLY when WhatsApp API confirms acceptance
  error               text,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  -- Prevents duplicate reminders for the same customer on the same day
  unique (business_id, customer_id, scheduled_for)
);

create index idx_due_notif_business on due_notifications(business_id);
create index idx_due_notif_status on due_notifications(status, scheduled_for);

-- ----------------------------------------------------------------------------
-- AI QUERY LOG (optional audit trail — what data was used to answer)
-- ----------------------------------------------------------------------------
create table ai_query_log (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  user_id         uuid references auth.users(id),
  question        text not null,
  answer          text not null,
  data_snapshot   jsonb not null, -- the exact numbers fed to the model, for auditability
  created_at      timestamptz not null default now()
);

create index idx_ai_log_business on ai_query_log(business_id, created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY — every business only ever sees its own rows
-- ============================================================================
alter table businesses enable row level security;
alter table business_users enable row level security;
alter table customers enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table due_notifications enable row level security;
alter table ai_query_log enable row level security;

-- businesses: a user can see/update only businesses they belong to
create policy biz_select on businesses for select
  using (is_business_member(id));
create policy biz_update on businesses for update
  using (is_business_member(id));

-- business_users: a user can see membership rows for their own business
create policy bu_select on business_users for select
  using (is_business_member(business_id));

create policy cust_all on customers for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy prod_all on products for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy sales_all on sales for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

-- sale_items has no business_id directly; check via parent sale
create policy sale_items_all on sale_items for all
  using (exists (select 1 from sales s where s.id = sale_id and is_business_member(s.business_id)))
  with check (exists (select 1 from sales s where s.id = sale_id and is_business_member(s.business_id)));

create policy payments_all on payments for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy expenses_all on expenses for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy due_notif_all on due_notifications for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy ai_log_all on ai_query_log for all
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

-- ============================================================================
-- TRANSACTIONAL RPC FUNCTIONS
-- These are the ONLY way sales/payments should be written — they run inside
-- a single Postgres transaction so stock, due, and totals can never drift.
-- SECURITY DEFINER + explicit membership check so RLS can't be bypassed by
-- calling with a mismatched business_id.
-- ============================================================================

-- ---- create_sale --------------------------------------------------------
-- items: jsonb array of {product_id, quantity, unit_price}
create or replace function create_sale(
  p_business_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_discount numeric,
  p_tax_amount numeric,
  p_paid_amount numeric,
  p_created_by uuid
) returns sales
language plpgsql
security definer
as $$
declare
  v_item jsonb;
  v_product products%rowtype;
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_due numeric(12,2);
  v_sale sales%rowtype;
  v_invoice_no text;
  v_line_total numeric(12,2);
begin
  if not is_business_member(p_business_id) then
    raise exception 'not authorized for this business';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'sale must have at least one item';
  end if;

  -- Lock and validate every product row first (prevents overselling under concurrency)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products
      where id = (v_item->>'product_id')::uuid
        and business_id = p_business_id
      for update;

    if not found then
      raise exception 'product % not found for this business', v_item->>'product_id';
    end if;

    if v_product.stock_qty < (v_item->>'quantity')::numeric then
      raise exception 'insufficient stock for product %: have %, need %',
        v_product.name, v_product.stock_qty, (v_item->>'quantity')::numeric;
    end if;

    v_line_total := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  v_total := v_subtotal - coalesce(p_discount,0) + coalesce(p_tax_amount,0);
  if v_total < 0 then
    raise exception 'total cannot be negative';
  end if;
  v_due := v_total - coalesce(p_paid_amount,0);
  if v_due < 0 then
    raise exception 'paid amount cannot exceed total';
  end if;

  v_invoice_no := 'INV-' || to_char(now(),'YYYYMMDD') || '-' || lpad(nextval('invoice_seq')::text, 5, '0');

  insert into sales (business_id, customer_id, invoice_no, subtotal, discount, tax_amount, total, paid_amount, due_amount, created_by)
  values (p_business_id, p_customer_id, v_invoice_no, v_subtotal, coalesce(p_discount,0), coalesce(p_tax_amount,0), v_total, coalesce(p_paid_amount,0), v_due, p_created_by)
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from products where id = (v_item->>'product_id')::uuid for update;

    insert into sale_items (sale_id, product_id, quantity, unit_price, purchase_price_snap, line_total)
    values (
      v_sale.id,
      v_product.id,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      v_product.purchase_price,
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
    );

    update products
      set stock_qty = stock_qty - (v_item->>'quantity')::numeric,
          updated_at = now()
      where id = v_product.id;
  end loop;

  -- If customer paid something immediately, record it as a payment too
  if p_customer_id is not null and coalesce(p_paid_amount,0) > 0 then
    insert into payments (business_id, customer_id, sale_id, amount, method, note, created_by)
    values (p_business_id, p_customer_id, v_sale.id, p_paid_amount, 'cash', 'Paid at sale', p_created_by);
  end if;

  return v_sale;
end;
$$;

-- ---- receive_payment ------------------------------------------------------
-- Applies a payment to a customer's oldest outstanding sales first (FIFO),
-- reducing due_amount on each sale until the payment is exhausted.
create or replace function receive_payment(
  p_business_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_method text,
  p_note text,
  p_created_by uuid
) returns payments
language plpgsql
security definer
as $$
declare
  v_payment payments%rowtype;
  v_remaining numeric(12,2) := p_amount;
  v_sale sales%rowtype;
  v_apply numeric(12,2);
begin
  if not is_business_member(p_business_id) then
    raise exception 'not authorized for this business';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into payments (business_id, customer_id, amount, method, note, created_by)
  values (p_business_id, p_customer_id, p_amount, coalesce(p_method,'cash'), p_note, p_created_by)
  returning * into v_payment;

  for v_sale in
    select * from sales
      where business_id = p_business_id
        and customer_id = p_customer_id
        and due_amount > 0
      order by created_at asc
      for update
  loop
    exit when v_remaining <= 0;
    v_apply := least(v_remaining, v_sale.due_amount);
    update sales set due_amount = due_amount - v_apply where id = v_sale.id;
    v_remaining := v_remaining - v_apply;
  end loop;

  return v_payment;
end;
$$;

-- ---- customer_balance (read helper — always derived, never stored redundantly)
create or replace function customer_balance(p_customer_id uuid)
returns table(total_sales numeric, total_paid numeric, current_due numeric)
language sql
stable
as $$
  select
    coalesce(sum(s.total),0) as total_sales,
    coalesce(sum(s.paid_amount),0) + coalesce((select sum(p.amount) from payments p where p.customer_id = p_customer_id and p.sale_id is null),0) as total_paid,
    coalesce(sum(s.due_amount),0) as current_due
  from sales s
  where s.customer_id = p_customer_id;
$$;
