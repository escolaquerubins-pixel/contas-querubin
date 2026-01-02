create table if not exists public.accounts_payable (
  id bigint primary key,
  description text not null,
  group_dre text not null,
  subgroup text not null,
  cta text,
  person_supplier text,
  due_date date not null,
  amount numeric(14,2) not null default 0,
  payment_method text,
  bank text,
  obs text,
  expense_type text not null default 'fixa',
  recurring text not null default 'nao',
  payment_date date,
  payment_obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dre_configs (
  id integer primary key,
  config jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.accounts_payable enable row level security;
alter table public.dre_configs enable row level security;

create policy "accounts_payable_select" on public.accounts_payable
  for select to authenticated using (auth.uid() is not null);

create policy "accounts_payable_insert" on public.accounts_payable
  for insert to authenticated with check (auth.uid() is not null);

create policy "accounts_payable_update" on public.accounts_payable
  for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "accounts_payable_delete" on public.accounts_payable
  for delete to authenticated using (auth.uid() is not null);

create policy "dre_configs_select" on public.dre_configs
  for select to authenticated using (auth.uid() is not null);

create policy "dre_configs_insert" on public.dre_configs
  for insert to authenticated with check (auth.uid() is not null);

create policy "dre_configs_update" on public.dre_configs
  for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
