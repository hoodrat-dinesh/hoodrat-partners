create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'influencer');
create type public.approval_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.promotion_status as enum ('draft', 'active', 'paused', 'archived');
create type public.commission_basis as enum ('net_revenue', 'gross_margin');
create type public.order_status as enum ('paid', 'partially_refunded', 'refunded', 'cancelled');
create type public.ledger_entry_type as enum ('earn', 'refund', 'adjustment', 'payout');
create type public.payout_status as enum ('pending', 'paid', 'rejected', 'cancelled');
create type public.webhook_status as enum ('processing', 'processed', 'ignored');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role public.user_role not null default 'influencer',
  approval_status public.approval_status not null default 'pending',
  onboarding_completed boolean not null default false,
  terms_accepted_at timestamptz,
  terms_version text,
  full_name text check (full_name is null or char_length(full_name) between 2 and 120),
  instagram_handle text check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  follower_count bigint check (follower_count is null or follower_count between 0 and 2000000000),
  upi_payout_id text check (upi_payout_id is null or upi_payout_id ~ '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$'),
  rejection_notes text check (rejection_notes is null or char_length(rejection_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  brand_name text not null default 'Common Thread' check (char_length(brand_name) between 1 and 100),
  logo_url text,
  tagline text not null default 'Partnership, made measurable.' check (char_length(tagline) <= 200),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  payout_threshold_minor bigint not null default 200000 check (payout_threshold_minor > 0),
  default_discount_percent numeric(5,2) not null default 10 check (default_discount_percent > 0 and default_discount_percent <= 100),
  primary_color text not null default '#14213D' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#E65336' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  support_email text,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (1);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shopify_product_id text not null unique,
  shopify_product_gid text not null unique,
  shopify_variant_gid text,
  title text not null,
  handle text not null,
  product_url text not null,
  image_url text,
  price_minor bigint not null check (price_minor >= 0),
  cost_minor bigint check (cost_minor is null or cost_minor >= 0),
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  active boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  influencer_id uuid not null references public.profiles(id) on delete restrict,
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 100),
  shopify_discount_id text unique,
  status public.promotion_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_code_upper check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,64}$'),
  constraint promotions_dates_valid check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index promotions_code_case_insensitive_idx on public.promotions (upper(code));

create table public.promotion_products (
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  commission_percent numeric(5,2) not null check (commission_percent >= 0 and commission_percent <= 100),
  commission_basis public.commission_basis not null default 'net_revenue',
  cost_basis_minor bigint check (cost_basis_minor is null or cost_basis_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (promotion_id, product_id)
);

create table public.webhook_events (
  webhook_delivery_id text primary key,
  correlation_id text,
  topic text not null,
  resource_key text,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  status public.webhook_status not null default 'processing',
  detail text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index webhook_events_resource_idx
  on public.webhook_events (topic, resource_key)
  where resource_key is not null;

create table public.attributed_orders (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text not null unique,
  shopify_order_gid text unique,
  promotion_id uuid not null references public.promotions(id) on delete restrict,
  influencer_id uuid not null references public.profiles(id) on delete restrict,
  discount_code text not null,
  currency char(3) not null check (currency = upper(currency)),
  attributed_revenue_minor bigint not null default 0 check (attributed_revenue_minor >= 0),
  commission_minor bigint not null default 0 check (commission_minor >= 0),
  status public.order_status not null default 'paid',
  paid_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attributed_order_lines (
  id uuid primary key default gen_random_uuid(),
  attributed_order_id uuid not null references public.attributed_orders(id) on delete restrict,
  shopify_line_id text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  title text not null,
  quantity integer not null check (quantity > 0),
  refunded_quantity integer not null default 0 check (refunded_quantity >= 0 and refunded_quantity <= quantity),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  net_revenue_minor bigint not null check (net_revenue_minor >= 0),
  cost_basis_minor bigint not null default 0 check (cost_basis_minor >= 0),
  commission_basis public.commission_basis not null,
  commission_percent numeric(5,2) not null check (commission_percent >= 0 and commission_percent <= 100),
  commission_minor bigint not null check (commission_minor >= 0),
  reversed_commission_minor bigint not null default 0 check (reversed_commission_minor >= 0 and reversed_commission_minor <= commission_minor),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attributed_order_id, shopify_line_id)
);

create table public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.profiles(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency = upper(currency)),
  status public.payout_status not null default 'pending',
  payout_reference text,
  notes text check (notes is null or char_length(notes) <= 1000),
  recorded_by uuid references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  recorded_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint paid_payout_has_record check (
    status <> 'paid' or
    (payout_reference is not null and recorded_by is not null and recorded_at is not null)
  )
);

create unique index one_pending_payout_per_influencer_idx
  on public.payout_requests (influencer_id) where status = 'pending';

create table public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.profiles(id) on delete restrict,
  entry_type public.ledger_entry_type not null,
  amount_minor bigint not null,
  currency char(3) not null check (currency = upper(currency)),
  attributed_order_id uuid references public.attributed_orders(id) on delete restrict,
  attributed_order_line_id uuid references public.attributed_order_lines(id) on delete restrict,
  payout_request_id uuid references public.payout_requests(id) on delete restrict,
  source_key text not null unique,
  description text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint ledger_amount_sign check (
    (entry_type = 'earn' and amount_minor > 0) or
    (entry_type in ('refund', 'payout') and amount_minor < 0) or
    (entry_type = 'adjustment' and amount_minor <> 0)
  ),
  constraint ledger_source_shape check (
    (entry_type in ('earn', 'refund') and attributed_order_id is not null and attributed_order_line_id is not null and payout_request_id is null) or
    (entry_type = 'payout' and payout_request_id is not null and attributed_order_id is null and attributed_order_line_id is null) or
    (entry_type = 'adjustment' and payout_request_id is null)
  )
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index profiles_approval_idx on public.profiles (approval_status);
create index products_active_idx on public.products (active);
create index promotions_influencer_idx on public.promotions (influencer_id, status);
create index promotion_products_product_idx on public.promotion_products (product_id);
create index attributed_orders_influencer_idx on public.attributed_orders (influencer_id, paid_at desc);
create index attributed_order_lines_order_idx on public.attributed_order_lines (attributed_order_id);
create index ledger_influencer_created_idx on public.commission_ledger (influencer_id, created_at desc);
create index payout_requests_influencer_idx on public.payout_requests (influencer_id, requested_at desc);
create index payout_requests_status_idx on public.payout_requests (status, requested_at);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index webhook_events_received_idx on public.webhook_events (received_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger platform_settings_updated_at before update on public.platform_settings
for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger promotions_updated_at before update on public.promotions
for each row execute function public.set_updated_at();
create trigger promotion_products_updated_at before update on public.promotion_products
for each row execute function public.set_updated_at();
create trigger attributed_orders_updated_at before update on public.attributed_orders
for each row execute function public.set_updated_at();
create trigger attributed_order_lines_updated_at before update on public.attributed_order_lines
for each row execute function public.set_updated_at();
create trigger payout_requests_updated_at before update on public.payout_requests
for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and approval_status = 'approved'
  );
$$;

create function public.prevent_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'commission ledger entries are immutable';
end;
$$;

create trigger commission_ledger_immutable
before update or delete on public.commission_ledger
for each row execute function public.prevent_ledger_mutation();

create view public.influencer_balances
with (security_invoker = true)
as
select
  p.id as influencer_id,
  coalesce(sum(l.amount_minor), 0)::bigint as balance_minor,
  coalesce(sum(l.amount_minor) filter (where l.entry_type = 'earn'), 0)::bigint as lifetime_earned_minor,
  abs(coalesce(sum(l.amount_minor) filter (where l.entry_type = 'refund'), 0))::bigint as refunded_minor,
  abs(coalesce(sum(l.amount_minor) filter (where l.entry_type = 'payout'), 0))::bigint as paid_minor,
  coalesce(sum(l.amount_minor) filter (where l.entry_type in ('earn', 'refund', 'adjustment')), 0)::bigint as total_commission_minor,
  coalesce((
    select sum(pr.amount_minor)
    from public.payout_requests pr
    where pr.influencer_id = p.id and pr.currency = s.currency and pr.status = 'pending'
  ), 0)::bigint as pending_payout_minor,
  greatest(
    coalesce(sum(l.amount_minor), 0) - coalesce((
      select sum(pr.amount_minor)
      from public.payout_requests pr
      where pr.influencer_id = p.id and pr.currency = s.currency and pr.status = 'pending'
    ), 0),
    0
  )::bigint as available_minor,
  s.currency
from public.profiles p
cross join public.platform_settings s
left join public.commission_ledger l on l.influencer_id = p.id and l.currency = s.currency
where p.role = 'influencer'
group by p.id, s.currency;

create function public.request_payout(p_amount_minor bigint)
returns public.payout_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_balance bigint;
  v_pending bigint;
  v_threshold bigint;
  v_currency char(3);
  v_result public.payout_requests;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  if not exists (
    select 1 from public.profiles
    where id = v_user and role = 'influencer' and approval_status = 'approved'
  ) then
    raise exception 'approved influencer required';
  end if;

  select payout_threshold_minor, currency
    into v_threshold, v_currency
  from public.platform_settings where id = 1;

  if p_amount_minor < v_threshold then
    raise exception 'payout amount is below threshold';
  end if;

  select coalesce(sum(amount_minor), 0) into v_balance
  from public.commission_ledger
  where influencer_id = v_user and currency = v_currency;

  select coalesce(sum(amount_minor), 0) into v_pending
  from public.payout_requests
  where influencer_id = v_user and status = 'pending' and currency = v_currency;

  if p_amount_minor > v_balance - v_pending then
    raise exception 'insufficient available balance';
  end if;

  insert into public.payout_requests (influencer_id, amount_minor, currency)
  values (v_user, p_amount_minor, v_currency)
  returning * into v_result;
  return v_result;
end;
$$;

create function public.record_payout(
  p_request_id uuid,
  p_reference text,
  p_notes text default null
)
returns public.payout_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.payout_requests;
  v_balance bigint;
begin
  if not public.is_admin() then raise exception 'administrator required'; end if;
  if nullif(trim(p_reference), '') is null then raise exception 'payout reference required'; end if;

  select * into v_request
  from public.payout_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'payout request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'payout request is not pending'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_request.influencer_id::text, 0));
  select coalesce(sum(amount_minor), 0) into v_balance
  from public.commission_ledger
  where influencer_id = v_request.influencer_id
    and currency = v_request.currency;
  if v_balance < v_request.amount_minor then raise exception 'insufficient current balance'; end if;

  insert into public.commission_ledger (
    influencer_id, entry_type, amount_minor, currency,
    payout_request_id, source_key, description, created_by
  ) values (
    v_request.influencer_id, 'payout', -v_request.amount_minor, v_request.currency,
    v_request.id, 'payout:' || v_request.id::text, 'Payout ' || trim(p_reference), auth.uid()
  );

  update public.payout_requests
  set status = 'paid',
      payout_reference = trim(p_reference),
      notes = p_notes,
      recorded_by = auth.uid(),
      recorded_at = now()
  where id = p_request_id
  returning * into v_request;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'payout.recorded', 'payout_request', p_request_id::text,
          jsonb_build_object('amount_minor', v_request.amount_minor, 'reference', trim(p_reference)));
  return v_request;
end;
$$;

create function public.reject_payout(
  p_request_id uuid,
  p_notes text
)
returns public.payout_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.payout_requests;
begin
  if not public.is_admin() then raise exception 'administrator required'; end if;
  if nullif(trim(p_notes), '') is null then raise exception 'rejection notes required'; end if;

  select * into v_request
  from public.payout_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'payout request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'payout request is not pending'; end if;

  update public.payout_requests
  set status = 'rejected',
      notes = trim(p_notes),
      recorded_by = auth.uid(),
      recorded_at = now()
  where id = p_request_id
  returning * into v_request;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'payout.rejected',
    'payout_request',
    p_request_id::text,
    jsonb_build_object('amount_minor', v_request.amount_minor, 'notes', trim(p_notes))
  );
  return v_request;
end;
$$;

create function public.process_shopify_paid_order(
  p_webhook_delivery_id text,
  p_correlation_id text,
  p_payload_sha256 text,
  p_shopify_order_id text,
  p_shopify_order_gid text,
  p_currency text,
  p_discount_codes jsonb,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promotion public.promotions;
  v_order public.attributed_orders;
  v_line jsonb;
  v_product public.products;
  v_assignment public.promotion_products;
  v_quantity integer;
  v_unit bigint;
  v_discount bigint;
  v_net bigint;
  v_cost bigint;
  v_commissionable bigint;
  v_commission bigint;
  v_line_row public.attributed_order_lines;
  v_total_revenue bigint := 0;
  v_total_commission bigint := 0;
  v_match_count integer;
begin
  insert into public.webhook_events (webhook_delivery_id, correlation_id, topic, resource_key, payload_sha256)
  values (p_webhook_delivery_id, p_correlation_id, 'orders/paid', p_shopify_order_id, p_payload_sha256)
  on conflict do nothing;
  if not found then return jsonb_build_object('duplicate', true); end if;

  select count(*) into v_match_count
  from public.promotions p
  where p.status = 'active'
    and (p.starts_at is null or p.starts_at <= now())
    and (p.ends_at is null or p.ends_at > now())
    and exists (
      select 1 from jsonb_array_elements_text(p_discount_codes) c
      where upper(c.value) = p.code
    );

  if v_match_count <> 1 then
    update public.webhook_events
    set status = 'ignored',
        detail = case when v_match_count = 0
          then 'No active promotion code matched'
          else 'Multiple promotion codes matched'
        end,
        processed_at = now()
    where webhook_delivery_id = p_webhook_delivery_id;
    return jsonb_build_object('attributed', false, 'promotion_matches', v_match_count);
  end if;

  select p.* into v_promotion
  from public.promotions p
  where p.status = 'active'
    and (p.starts_at is null or p.starts_at <= now())
    and (p.ends_at is null or p.ends_at > now())
    and exists (
      select 1 from jsonb_array_elements_text(p_discount_codes) c
      where upper(c.value) = p.code
    )
  limit 1;

  insert into public.attributed_orders (
    shopify_order_id, shopify_order_gid, promotion_id, influencer_id,
    discount_code, currency
  ) values (
    p_shopify_order_id, p_shopify_order_gid, v_promotion.id, v_promotion.influencer_id,
    v_promotion.code, upper(p_currency)
  )
  on conflict (shopify_order_id) do nothing
  returning * into v_order;

  if not found then
    update public.webhook_events
    set status = 'ignored', detail = 'Order was already attributed', processed_at = now()
    where webhook_delivery_id = p_webhook_delivery_id;
    return jsonb_build_object('duplicate_order', true);
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    select * into v_product
    from public.products
    where shopify_product_gid = v_line ->> 'shopifyProductGid'
      and active = true;
    if not found then continue; end if;

    select * into v_assignment
    from public.promotion_products
    where promotion_id = v_promotion.id and product_id = v_product.id;
    if not found then continue; end if;

    v_quantity := (v_line ->> 'quantity')::integer;
    v_unit := (v_line ->> 'unitPriceMinor')::bigint;
    v_discount := (v_line ->> 'discountMinor')::bigint;
    if v_quantity <= 0 or v_unit < 0 or v_discount < 0 then
      raise exception 'invalid attributed order line';
    end if;
    v_net := greatest(v_unit * v_quantity - least(v_discount, v_unit * v_quantity), 0);
    v_cost := coalesce(v_assignment.cost_basis_minor, v_product.cost_minor, 0);
    v_commissionable := case
      when v_assignment.commission_basis = 'gross_margin'
        then greatest(v_net - v_cost * v_quantity, 0)
      else v_net
    end;
    v_commission := round(v_commissionable * v_assignment.commission_percent / 100.0);
    if v_net = 0 then continue; end if;

    insert into public.attributed_order_lines (
      attributed_order_id, shopify_line_id, product_id, title, quantity,
      unit_price_minor, discount_minor, net_revenue_minor, cost_basis_minor,
      commission_basis, commission_percent, commission_minor
    ) values (
      v_order.id, v_line ->> 'shopifyLineId', v_product.id,
      left(coalesce(v_line ->> 'title', v_product.title), 500), v_quantity,
      v_unit, v_discount, v_net, v_cost,
      v_assignment.commission_basis, v_assignment.commission_percent, v_commission
    )
    returning * into v_line_row;

    v_total_revenue := v_total_revenue + v_net;
    v_total_commission := v_total_commission + v_commission;
    if v_commission > 0 then
      insert into public.commission_ledger (
        influencer_id, entry_type, amount_minor, currency,
        attributed_order_id, attributed_order_line_id, source_key, description
      ) values (
        v_promotion.influencer_id, 'earn', v_commission, upper(p_currency),
        v_order.id, v_line_row.id,
        'order:' || p_shopify_order_id || ':line:' || (v_line ->> 'shopifyLineId'),
        'Commission earned on order ' || p_shopify_order_id
      );
    end if;
  end loop;

  if v_total_revenue = 0 then
    delete from public.attributed_orders where id = v_order.id;
    update public.webhook_events
    set status = 'ignored', detail = 'No assigned product lines matched', processed_at = now()
    where webhook_delivery_id = p_webhook_delivery_id;
    return jsonb_build_object('attributed', false);
  end if;

  update public.attributed_orders
  set attributed_revenue_minor = v_total_revenue,
      commission_minor = v_total_commission
  where id = v_order.id;
  update public.webhook_events
  set status = 'processed', processed_at = now()
  where webhook_delivery_id = p_webhook_delivery_id;
  return jsonb_build_object(
    'attributed', true,
    'order_id', v_order.id,
    'revenue_minor', v_total_revenue,
    'commission_minor', v_total_commission
  );
end;
$$;

create function public.process_shopify_refund(
  p_webhook_delivery_id text,
  p_correlation_id text,
  p_payload_sha256 text,
  p_shopify_refund_id text,
  p_shopify_order_id text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.attributed_orders;
  v_payload_line jsonb;
  v_line public.attributed_order_lines;
  v_add_quantity integer;
  v_target_quantity integer;
  v_target_reversal bigint;
  v_delta bigint;
  v_reversed bigint := 0;
begin
  insert into public.webhook_events (webhook_delivery_id, correlation_id, topic, resource_key, payload_sha256)
  values (p_webhook_delivery_id, p_correlation_id, 'refunds/create', p_shopify_refund_id, p_payload_sha256)
  on conflict do nothing;
  if not found then return jsonb_build_object('duplicate', true); end if;

  select * into v_order from public.attributed_orders
  where shopify_order_id = p_shopify_order_id for update;
  if not found then
    update public.webhook_events
    set status = 'ignored', detail = 'Order was not attributed', processed_at = now()
    where webhook_delivery_id = p_webhook_delivery_id;
    return jsonb_build_object('attributed', false);
  end if;

  for v_payload_line in select value from jsonb_array_elements(p_lines)
  loop
    select * into v_line
    from public.attributed_order_lines
    where attributed_order_id = v_order.id
      and shopify_line_id = v_payload_line ->> 'shopifyLineId'
    for update;
    if not found then continue; end if;

    v_add_quantity := (v_payload_line ->> 'quantity')::integer;
    if v_add_quantity <= 0 then raise exception 'invalid refund quantity'; end if;
    v_target_quantity := least(v_line.refunded_quantity + v_add_quantity, v_line.quantity);
    v_target_reversal := round(v_line.commission_minor * v_target_quantity::numeric / v_line.quantity);
    v_delta := greatest(v_target_reversal - v_line.reversed_commission_minor, 0);

    update public.attributed_order_lines
    set refunded_quantity = v_target_quantity,
        reversed_commission_minor = v_target_reversal
    where id = v_line.id;

    if v_delta > 0 then
      insert into public.commission_ledger (
        influencer_id, entry_type, amount_minor, currency,
        attributed_order_id, attributed_order_line_id, source_key, description
      ) values (
        v_order.influencer_id, 'refund', -v_delta, v_order.currency,
        v_order.id, v_line.id,
        'refund:' || p_shopify_refund_id || ':line:' || (v_payload_line ->> 'shopifyRefundLineId'),
        'Refund reversal for order ' || p_shopify_order_id
      );
      v_reversed := v_reversed + v_delta;
    end if;
  end loop;

  update public.attributed_orders
  set status = case
    when not exists (
      select 1 from public.attributed_order_lines
      where attributed_order_id = v_order.id and refunded_quantity < quantity
    ) then 'refunded'::public.order_status
    else 'partially_refunded'::public.order_status
  end
  where id = v_order.id;

  update public.webhook_events
  set status = 'processed', processed_at = now()
  where webhook_delivery_id = p_webhook_delivery_id;
  return jsonb_build_object('attributed', true, 'reversed_minor', v_reversed);
end;
$$;

create function public.process_shopify_cancellation(
  p_webhook_delivery_id text,
  p_correlation_id text,
  p_payload_sha256 text,
  p_shopify_order_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.attributed_orders;
begin
  insert into public.webhook_events (webhook_delivery_id, correlation_id, topic, resource_key, payload_sha256)
  values (p_webhook_delivery_id, p_correlation_id, 'orders/cancelled', p_shopify_order_id, p_payload_sha256)
  on conflict do nothing;
  if not found then return jsonb_build_object('duplicate', true); end if;

  select * into v_order from public.attributed_orders
  where shopify_order_id = p_shopify_order_id for update;
  if not found then
    update public.webhook_events
    set status = 'ignored', detail = 'Order was not attributed', processed_at = now()
    where webhook_delivery_id = p_webhook_delivery_id;
    return jsonb_build_object('attributed', false);
  end if;

  if v_order.status = 'cancelled' then
    update public.webhook_events
    set status = 'ignored', detail = 'Order already cancelled', processed_at = now()
    where webhook_delivery_id = p_webhook_delivery_id;
    return jsonb_build_object('duplicate_cancellation', true);
  end if;

  update public.attributed_orders
  set status = 'cancelled', cancelled_at = now()
  where id = v_order.id;
  update public.webhook_events
  set status = 'processed', processed_at = now()
  where webhook_delivery_id = p_webhook_delivery_id;
  return jsonb_build_object('attributed', true, 'reversed_minor', 0);
end;
$$;

create function public.replace_promotion_products(
  p_promotion_id uuid,
  p_products jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_products) <> 'array' or jsonb_array_length(p_products) = 0 then
    raise exception 'at least one promotion product is required';
  end if;

  delete from public.promotion_products where promotion_id = p_promotion_id;
  insert into public.promotion_products (
    promotion_id, product_id, commission_percent, commission_basis, cost_basis_minor
  )
  select
    p_promotion_id,
    (item ->> 'product_id')::uuid,
    (item ->> 'commission_percent')::numeric,
    (item ->> 'commission_basis')::public.commission_basis,
    nullif(item ->> 'cost_basis_minor', '')::bigint
  from jsonb_array_elements(p_products) item;
end;
$$;

alter table public.profiles enable row level security;
alter table public.platform_settings enable row level security;
alter table public.products enable row level security;
alter table public.promotions enable row level security;
alter table public.promotion_products enable row level security;
alter table public.webhook_events enable row level security;
alter table public.attributed_orders enable row level security;
alter table public.attributed_order_lines enable row level security;
alter table public.commission_ledger enable row level security;
alter table public.payout_requests enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy settings_read on public.platform_settings for select to anon, authenticated using (true);
create policy settings_admin_all on public.platform_settings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select to authenticated
using (active or public.is_admin());
create policy products_admin_all on public.products for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy promotions_read on public.promotions for select to authenticated
using (influencer_id = auth.uid() or public.is_admin());
create policy promotions_admin_all on public.promotions for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy promotion_products_read on public.promotion_products for select to authenticated
using (
  public.is_admin() or exists (
    select 1 from public.promotions
    where id = promotion_id and influencer_id = auth.uid()
  )
);
create policy promotion_products_admin_all on public.promotion_products for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy orders_read on public.attributed_orders for select to authenticated
using (influencer_id = auth.uid() or public.is_admin());
create policy orders_admin_all on public.attributed_orders for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy order_lines_read on public.attributed_order_lines for select to authenticated
using (
  public.is_admin() or exists (
    select 1 from public.attributed_orders
    where id = attributed_order_id and influencer_id = auth.uid()
  )
);
create policy order_lines_admin_all on public.attributed_order_lines for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy ledger_read on public.commission_ledger for select to authenticated
using (influencer_id = auth.uid() or public.is_admin());
create policy payout_requests_read on public.payout_requests for select to authenticated
using (influencer_id = auth.uid() or public.is_admin());
create policy audit_admin_read on public.audit_log for select to authenticated using (public.is_admin());
create policy webhook_admin_read on public.webhook_events for select to authenticated using (public.is_admin());

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on public.platform_settings to anon, authenticated;
grant select on public.profiles, public.products, public.promotions, public.promotion_products,
  public.attributed_orders, public.attributed_order_lines, public.commission_ledger,
  public.payout_requests, public.influencer_balances to authenticated;
grant update (full_name, instagram_handle, follower_count, upi_payout_id, onboarding_completed) on public.profiles to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.request_payout(bigint) to authenticated;
grant execute on function public.record_payout(uuid, text, text) to authenticated;
grant execute on function public.reject_payout(uuid, text) to authenticated;
grant execute on function public.process_shopify_paid_order(text, text, text, text, text, text, jsonb, jsonb) to service_role;
grant execute on function public.process_shopify_refund(text, text, text, text, text, jsonb) to service_role;
grant execute on function public.process_shopify_cancellation(text, text, text, text) to service_role;
grant execute on function public.replace_promotion_products(uuid, jsonb) to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
