-- Migration 012: 수금 관리 (billing)

create table if not exists billing_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  client_id uuid references clients on delete cascade not null,
  service_category text not null,
  amount numeric(15,2) not null,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'quarterly', 'once')),
  billing_day int check (billing_day between 1 and 31),
  start_date date not null,
  end_date date,
  memo text,
  created_at timestamptz default now()
);

create table if not exists billing_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  contract_id uuid references billing_contracts on delete cascade,
  client_id uuid references clients on delete cascade not null,
  amount numeric(15,2) not null,
  billed_at date,
  paid_at date,
  status text not null default 'pending' check (status in ('pending', 'billed', 'paid', 'overdue')),
  memo text,
  created_at timestamptz default now()
);

alter table billing_contracts enable row level security;
alter table billing_records enable row level security;

create policy "users own billing_contracts" on billing_contracts for all using (auth.uid() = user_id);
create policy "users own billing_records" on billing_records for all using (auth.uid() = user_id);

create index if not exists billing_records_client_status on billing_records (user_id, status);
create index if not exists billing_records_billed_at on billing_records (user_id, billed_at desc);
create index if not exists billing_contracts_client on billing_contracts (client_id);
