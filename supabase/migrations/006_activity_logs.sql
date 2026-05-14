-- 활동 로그 테이블
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  action text not null,           -- created / updated / deleted / approved / rejected
  entity_type text not null,      -- client / project / todo / memo / calendar_event / contact
  entity_id uuid,
  entity_name text,               -- 거래처명, 프로젝트명 등 사람이 읽기 쉬운 이름
  detail jsonb,                   -- 변경 전후 데이터 등 메타
  created_at timestamptz default now()
);

alter table activity_logs enable row level security;
create policy "users can manage own logs" on activity_logs for all using (auth.uid() = user_id);

-- 인덱스
create index activity_logs_user_id_idx on activity_logs (user_id, created_at desc);
create index activity_logs_entity_idx on activity_logs (entity_type, entity_id);

-- ── 거래처 자동 로그 트리거 ──────────────────────────────────────────

create or replace function log_client_change()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into activity_logs (user_id, action, entity_type, entity_id, entity_name)
    values (NEW.user_id, 'created', 'client', NEW.id, NEW.name);
  elsif TG_OP = 'UPDATE' then
    insert into activity_logs (user_id, action, entity_type, entity_id, entity_name)
    values (NEW.user_id, 'updated', 'client', NEW.id, NEW.name);
  elsif TG_OP = 'DELETE' then
    insert into activity_logs (user_id, action, entity_type, entity_id, entity_name)
    values (OLD.user_id, 'deleted', 'client', OLD.id, OLD.name);
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_log_client on clients;
create trigger trigger_log_client
  after insert or update or delete on clients
  for each row execute function log_client_change();

-- ── 프로젝트 자동 로그 트리거 ─────────────────────────────────────────

create or replace function log_project_change()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into activity_logs (user_id, action, entity_type, entity_id, entity_name)
    values (NEW.user_id, 'created', 'project', NEW.id, NEW.name);
  elsif TG_OP = 'UPDATE' then
    insert into activity_logs (user_id, action, entity_type, entity_id, entity_name, detail)
    values (NEW.user_id, 'updated', 'project', NEW.id, NEW.name,
      case when OLD.status <> NEW.status
        then jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status)
        else null
      end);
  elsif TG_OP = 'DELETE' then
    insert into activity_logs (user_id, action, entity_type, entity_id, entity_name)
    values (OLD.user_id, 'deleted', 'project', OLD.id, OLD.name);
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_log_project on projects;
create trigger trigger_log_project
  after insert or update or delete on projects
  for each row execute function log_project_change();

-- ── 메모 자동 로그 트리거 ─────────────────────────────────────────────

create or replace function log_memo_change()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into activity_logs (user_id, action, entity_type, entity_id, entity_name)
    values (NEW.user_id, NEW.status, 'memo', NEW.id,
      left(NEW.raw_text, 40) || case when length(NEW.raw_text) > 40 then '...' else '' end);
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_log_memo on memos;
create trigger trigger_log_memo
  after insert on memos
  for each row execute function log_memo_change();
