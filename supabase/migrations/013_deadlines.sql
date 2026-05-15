-- Migration 013: 마감 기한 관리 (deadlines)

create table if not exists deadline_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  recurrence text not null check (recurrence in ('yearly', 'quarterly', 'monthly')),
  month int check (month between 1 and 12),
  day int not null check (day between 1 and 31),
  alert_days int[] default '{}',
  created_at timestamptz default now()
);

create table if not exists deadline_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  template_id uuid references deadline_templates on delete set null,
  client_id uuid references clients on delete cascade not null,
  name text not null,
  due_date date not null,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table deadline_templates enable row level security;
alter table deadline_instances enable row level security;

create policy "users own deadline_templates" on deadline_templates for all using (auth.uid() = user_id);
create policy "users own deadline_instances" on deadline_instances for all using (auth.uid() = user_id);

create index if not exists deadline_instances_due on deadline_instances (user_id, due_date);
create index if not exists deadline_instances_client on deadline_instances (client_id);
create index if not exists deadline_instances_pending on deadline_instances (user_id, completed, due_date);
