-- Note ERP 초기 스키마 (Phase 1)

-- 거래처
create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  industry text,
  audit_type text,  -- 외부감사/세무/컨설팅
  contact_name text,
  contact_phone text,
  contact_email text,
  status text default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now()
);

-- 프로젝트
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  client_id uuid references clients on delete set null,
  name text not null,
  type text check (type in ('audit', 'tax', 'consulting')),
  start_date date,
  end_date date,
  status text default 'preparing' check (status in ('preparing', 'in_progress', 'review', 'completed')),
  manager_id uuid references auth.users on delete set null,
  created_at timestamptz default now()
);

-- 마일스톤
create table milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  title text not null,
  due_date date,
  completed boolean default false,
  created_at timestamptz default now()
);

-- 캘린더 이벤트
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  date date not null,
  time time,
  location text,
  client_id uuid references clients on delete set null,
  project_id uuid references projects on delete set null,
  created_at timestamptz default now()
);

-- 투두
create table todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  due_date date,
  priority text default 'medium' check (priority in ('high', 'medium', 'low')),
  completed boolean default false,
  client_id uuid references clients on delete set null,
  project_id uuid references projects on delete set null,
  created_at timestamptz default now()
);

-- 인맥 CRM
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  company text,
  title text,
  phone text,
  email text,
  client_id uuid references clients on delete set null,
  tags text[] default '{}',
  note text,
  created_at timestamptz default now()
);

-- 메모 히스토리
create table memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  raw_text text not null,
  parsed_result jsonb,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- Row Level Security 활성화
alter table clients enable row level security;
alter table projects enable row level security;
alter table milestones enable row level security;
alter table calendar_events enable row level security;
alter table todos enable row level security;
alter table contacts enable row level security;
alter table memos enable row level security;

-- RLS 정책: 본인 데이터만 접근
create policy "users can manage own clients" on clients for all using (auth.uid() = user_id);
create policy "users can manage own projects" on projects for all using (auth.uid() = user_id);
create policy "users can manage own milestones" on milestones for all
  using (exists (select 1 from projects where projects.id = milestones.project_id and projects.user_id = auth.uid()));
create policy "users can manage own events" on calendar_events for all using (auth.uid() = user_id);
create policy "users can manage own todos" on todos for all using (auth.uid() = user_id);
create policy "users can manage own contacts" on contacts for all using (auth.uid() = user_id);
create policy "users can manage own memos" on memos for all using (auth.uid() = user_id);
