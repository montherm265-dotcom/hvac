-- AirDesk — customers, jobs, scheduling, and invoicing for HVAC/field-
-- service contractors. Apply via `supabase db push` or the SQL editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  company_address text,
  company_phone text,
  company_logo_url text,
  default_currency text not null default 'USD',
  default_tax_rate numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_self" on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
create index customers_owner_id_idx on public.customers(owner_id);
alter table public.customers enable row level security;
create policy "customers_owner" on public.customers for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  title text not null,
  service_type text not null default 'repair' check (service_type in ('installation', 'repair', 'maintenance', 'inspection', 'duct_cleaning', 'other')),
  status text not null default 'requested' check (status in ('requested', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_date date,
  scheduled_time text,
  technician_name text,
  notes text,
  tax_rate numeric not null default 0,
  invoice_status text not null default 'not_invoiced' check (invoice_status in ('not_invoiced', 'invoiced', 'paid')),
  share_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index jobs_share_token_idx on public.jobs(share_token);
create index jobs_owner_id_idx on public.jobs(owner_id);
create index jobs_customer_id_idx on public.jobs(customer_id);
create index jobs_scheduled_date_idx on public.jobs(scheduled_date);
alter table public.jobs enable row level security;
create policy "jobs_owner" on public.jobs for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create trigger set_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

create table public.job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index job_items_job_id_idx on public.job_items(job_id);
alter table public.job_items enable row level security;
create policy "job_items_owner" on public.job_items for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Public, read-only invoice view for a customer — no login required, and
-- no direct anon table access; keyed by the job's own random share_token.
create or replace function public.get_public_invoice(token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'job', json_build_object(
      'title', j.title,
      'service_type', j.service_type,
      'scheduled_date', j.scheduled_date,
      'notes', j.notes,
      'tax_rate', j.tax_rate,
      'invoice_status', j.invoice_status
    ),
    'customer', json_build_object('name', c.name, 'address', c.address),
    'company', json_build_object(
      'company_name', p.company_name,
      'company_address', p.company_address,
      'company_phone', p.company_phone,
      'default_currency', p.default_currency
    ),
    'items', (
      select coalesce(json_agg(json_build_object(
        'description', i.description,
        'quantity', i.quantity,
        'unit_price', i.unit_price
      ) order by i.sort_order), '[]'::json)
      from public.job_items i where i.job_id = j.id
    )
  ) into result
  from public.jobs j
  join public.customers c on c.id = j.customer_id
  join public.profiles p on p.id = j.owner_id
  where j.share_token = token;

  return result;
end;
$$;

grant execute on function public.get_public_invoice(uuid) to anon, authenticated;
