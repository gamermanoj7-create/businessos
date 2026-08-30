-- ============================================================================
-- Dashboard + Reports — read-only aggregate functions, date-range aware.
-- All numbers are computed live from sales/payments/expenses/products —
-- never cached or invented.
-- ============================================================================

create or replace function dashboard_summary(
  p_business_id uuid,
  p_start date,
  p_end date
) returns table (
  sales_total numeric,
  collected_total numeric,
  due_total numeric,
  expenses_total numeric,
  profit_total numeric,
  low_stock_count int
)
language plpgsql
stable
security definer
as $$
begin
  if not is_business_member(p_business_id) then
    raise exception 'not authorized for this business';
  end if;

  return query
  with period_sales as (
    select * from sales
    where business_id = p_business_id
      and created_at::date between p_start and p_end
  ),
  period_payments as (
    select * from payments
    where business_id = p_business_id
      and created_at::date between p_start and p_end
  ),
  period_expenses as (
    select * from expenses
    where business_id = p_business_id
      and expense_date between p_start and p_end
  ),
  cogs as (
    select coalesce(sum(si.quantity * si.purchase_price_snap),0) as total_cogs
    from sale_items si
    join sales s on s.id = si.sale_id
    where s.business_id = p_business_id
      and s.created_at::date between p_start and p_end
  )
  select
    coalesce((select sum(total) from period_sales),0) as sales_total,
    coalesce((select sum(amount) from period_payments),0) as collected_total,
    -- outstanding due is a point-in-time balance, not period-bound
    coalesce((select sum(due_amount) from sales where business_id = p_business_id),0) as due_total,
    coalesce((select sum(amount) from period_expenses),0) as expenses_total,
    (coalesce((select sum(total) from period_sales),0)
      - (select total_cogs from cogs)
      - coalesce((select sum(amount) from period_expenses),0)) as profit_total,
    (select count(*)::int from products where business_id = p_business_id and stock_qty <= low_stock_threshold) as low_stock_count;
end;
$$;

create or replace function report_sales(p_business_id uuid, p_start date, p_end date)
returns table(day date, sales_total numeric, orders_count int)
language sql stable security definer as $$
  select
    s.created_at::date as day,
    sum(s.total) as sales_total,
    count(*)::int as orders_count
  from sales s
  where s.business_id = p_business_id
    and is_business_member(p_business_id)
    and s.created_at::date between p_start and p_end
  group by 1 order by 1;
$$;

create or replace function report_profit(p_business_id uuid, p_start date, p_end date)
returns table(day date, revenue numeric, cogs numeric, profit numeric)
language sql stable security definer as $$
  select
    s.created_at::date as day,
    sum(si.line_total) as revenue,
    sum(si.quantity * si.purchase_price_snap) as cogs,
    sum(si.line_total - (si.quantity * si.purchase_price_snap)) as profit
  from sale_items si
  join sales s on s.id = si.sale_id
  where s.business_id = p_business_id
    and is_business_member(p_business_id)
    and s.created_at::date between p_start and p_end
  group by 1 order by 1;
$$;

create or replace function report_expenses(p_business_id uuid, p_start date, p_end date)
returns table(category text, amount numeric)
language sql stable security definer as $$
  select category, sum(amount) as amount
  from expenses
  where business_id = p_business_id
    and is_business_member(p_business_id)
    and expense_date between p_start and p_end
  group by 1 order by 2 desc;
$$;

create or replace function report_customer_due(p_business_id uuid)
returns table(customer_id uuid, customer_name text, phone text, current_due numeric)
language sql stable security definer as $$
  select c.id, c.name, c.phone, coalesce(sum(s.due_amount),0) as current_due
  from customers c
  left join sales s on s.customer_id = c.id
  where c.business_id = p_business_id
    and is_business_member(p_business_id)
  group by c.id, c.name, c.phone
  having coalesce(sum(s.due_amount),0) > 0
  order by current_due desc;
$$;

create or replace function report_stock(p_business_id uuid)
returns table(product_id uuid, name text, stock_qty numeric, low_stock_threshold numeric, is_low boolean)
language sql stable security definer as $$
  select id, name, stock_qty, low_stock_threshold, (stock_qty <= low_stock_threshold) as is_low
  from products
  where business_id = p_business_id
    and is_business_member(p_business_id)
  order by is_low desc, stock_qty asc;
$$;
