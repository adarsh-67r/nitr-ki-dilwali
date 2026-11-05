-- NITR ki Dilwali: full database setup (schema, RLS, RPCs, storage, seed).
-- Run once on a fresh Supabase project, in the SQL editor or with `supabase db query`.

-- Admins: write access is gated on this list, not on "any logged-in user".
-- One superadmin manages the list; regular admins manage the shop only.
create table public.admins (
  email text primary key check (email = lower(email)),
  super boolean not null default false
);
alter table public.admins enable row level security;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where email = lower(auth.jwt() ->> 'email'));
$$;

create function public.is_super() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where email = lower(auth.jwt() ->> 'email') and super);
$$;

create policy "admins read" on public.admins for select to authenticated using ((select public.is_admin()));
create policy "admins add" on public.admins for insert to authenticated
  with check ((select public.is_super()) and not super);
create policy "admins remove" on public.admins for delete to authenticated
  using ((select public.is_super()) and not super);
-- No update grant: the super flag can only be changed from the database itself.
grant select, insert, delete on public.admins to authenticated;

-- Products. price = selling price; mrp = optional struck-out price.
create table public.products (
  id bigint generated always as identity primary key,
  name text not null check (length(name) between 1 and 80),
  category text not null default 'Sparklers',
  description text,
  price int not null check (price >= 0),
  mrp int check (mrp is null or mrp >= price),
  image_url text,
  in_stock boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "products public read" on public.products for select using (true);
create policy "products admin insert" on public.products for insert to authenticated with check ((select public.is_admin()));
create policy "products admin update" on public.products for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products admin delete" on public.products for delete to authenticated using ((select public.is_admin()));
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

-- Coupons: never readable by the public. min_amount = minimum subtotal;
-- auto = applies itself once the subtotal reaches min_amount, no code needed.
create table public.coupons (
  code text primary key check (code = upper(code) and length(code) between 2 and 30),
  percent_off int not null check (percent_off between 1 and 90),
  active boolean not null default true,
  min_amount int not null default 0 check (min_amount >= 0),
  auto boolean not null default false
);
alter table public.coupons enable row level security;
create policy "coupons admin all" on public.coupons for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, insert, update, delete on public.coupons to authenticated;

create function public.apply_coupon(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select (select jsonb_build_object('percent', percent_off, 'min_amount', min_amount)
          from public.coupons where code = upper(trim(p_code)) and active);
$$;

-- Auto offers are advertised, so they are public.
create function public.auto_offers() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('percent', percent_off, 'min_amount', min_amount) order by min_amount), '[]'::jsonb)
  from public.coupons where active and auto;
$$;

-- Orders: created only through place_order()
create sequence public.order_seq start 1001;
create table public.orders (
  id text primary key default 'DW-' || nextval('public.order_seq'),
  name text not null,
  phone text not null,
  address text not null,
  payment_mode text not null check (payment_mode in ('UPI', 'Cash')),
  items jsonb not null,
  coupon text,
  subtotal int not null,
  discount int not null,
  total int not null,
  created_at timestamptz not null default now()
);
create index orders_phone_created on public.orders (phone, created_at);
alter table public.orders enable row level security;
create policy "orders admin read" on public.orders for select to authenticated using ((select public.is_admin()));
grant select on public.orders to authenticated;

create function public.place_order(
  p_name text, p_phone text, p_address text, p_payment text, p_items jsonb, p_coupon text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_sub int := 0;
  v_pct int := 0;
  v_auto int := 0;
  v_disc int := 0;
  v_code text := nullif(upper(trim(coalesce(p_coupon, ''))), '');
  v_coupon jsonb;
  v_id text;
  r record;
begin
  p_name := trim(coalesce(p_name, ''));
  p_address := trim(coalesce(p_address, ''));
  if length(p_name) not between 2 and 60 then raise exception 'Please enter your name'; end if;
  if coalesce(p_phone, '') !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit phone number'; end if;
  if length(p_address) not between 3 and 200 then raise exception 'Enter your hostel and room number'; end if;
  if coalesce(p_payment, '') <> 'UPI' then raise exception 'Payment is by UPI only'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Your cart is empty';
  end if;
  if (select count(*) from public.orders where phone = p_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many orders from this number. Message us on WhatsApp.';
  end if;
  -- Phone numbers are free to invent, so also cap the whole shop (spam guard; real rush is far below this).
  if (select count(*) from public.orders where created_at > now() - interval '10 minutes') >= 100 then
    raise exception 'Lots of orders right now. Please try again in a few minutes.';
  end if;

  -- Prices always come from the DB, never from the client.
  for r in
    select i.id, i.qty, p.name, p.price, p.in_stock
    from jsonb_to_recordset(p_items) as i(id bigint, qty int)
    left join public.products p on p.id = i.id
  loop
    if r.name is null then raise exception 'An item in your cart is no longer available'; end if;
    if not r.in_stock then raise exception '% is sold out', r.name; end if;
    if r.qty is null or r.qty not between 1 and 99 then raise exception 'Invalid quantity for %', r.name; end if;
    v_lines := v_lines || jsonb_build_object('id', r.id, 'name', r.name, 'price', r.price, 'qty', r.qty);
    v_sub := v_sub + r.price * r.qty;
  end loop;

  if v_code is not null then
    v_coupon := public.apply_coupon(v_code);
    if v_coupon is null then raise exception 'Coupon % is not valid', v_code; end if;
    if v_sub < (v_coupon ->> 'min_amount')::int then
      raise exception 'Coupon % needs an order of at least ₹%', v_code, v_coupon ->> 'min_amount';
    end if;
    v_pct := (v_coupon ->> 'percent')::int;
  end if;

  -- The buyer gets whichever is better: their code or the best auto offer they qualify for.
  select coalesce(max(percent_off), 0) into v_auto from public.coupons where active and auto and min_amount <= v_sub;
  if v_auto > v_pct then v_pct := v_auto; v_code := null; end if;
  v_disc := v_sub * v_pct / 100;

  insert into public.orders (name, phone, address, payment_mode, items, coupon, subtotal, discount, total)
  values (p_name, p_phone, p_address, p_payment, v_lines, coalesce(v_code, case when v_pct > 0 then 'AUTO' end), v_sub, v_disc, v_sub - v_disc)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'items', v_lines, 'subtotal', v_sub,
    'discount', v_disc, 'percent', v_pct, 'coupon', v_code, 'total', v_sub - v_disc);
end;
$$;

revoke execute on function public.place_order, public.apply_coupon, public.auto_offers, public.is_admin, public.is_super from public;
grant execute on function public.place_order, public.apply_coupon, public.auto_offers to anon, authenticated;
grant execute on function public.is_admin, public.is_super to authenticated;

-- Storage: public-read bucket, admin-only writes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cracker-images', 'cracker-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
create policy "images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'cracker-images' and (select public.is_admin()));
create policy "images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'cracker-images' and (select public.is_admin()));
create policy "images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'cracker-images' and (select public.is_admin()));

-- Seed
-- Change this to the superadmin's email (lowercase) before running.
insert into public.admins (email, super) values ('you@example.com', true);
insert into public.coupons (code, percent_off) values ('DIWALI10', 10);
