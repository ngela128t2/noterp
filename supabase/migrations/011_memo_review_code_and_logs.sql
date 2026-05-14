-- Memo-created review items should stay unnumbered until reviewed.
alter table clients
  add column if not exists needs_review boolean default false,
  add column if not exists source text;

alter table projects
  add column if not exists needs_review boolean default false,
  add column if not exists source text;

alter table contacts
  add column if not exists needs_review boolean default false,
  add column if not exists source text;

update clients
set code = null
where coalesce(needs_review, false) = true
   or source = 'memo';

create or replace function auto_generate_client_code()
returns trigger as $$
declare
  prefix text;
  next_num integer;
begin
  if coalesce(NEW.needs_review, false) or NEW.source = 'memo' then
    NEW.code := null;
    return NEW;
  end if;

  if NEW.code is null then
    prefix := case when NEW.entity_type = '법인' then 'CL' else 'IN' end;

    select coalesce(max(cast(substring(code from 4) as integer)), 0) + 1
    into next_num
    from clients
    where user_id = NEW.user_id
      and code like prefix || '-%'
      and code ~ ('^' || prefix || '-[0-9]+$');

    NEW.code := prefix || '-' || lpad(next_num::text, 3, '0');
  end if;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trigger_client_code on clients;
create trigger trigger_client_code
  before insert on clients
  for each row execute function auto_generate_client_code();

drop trigger if exists trigger_client_code_on_update on clients;
create trigger trigger_client_code_on_update
  before update on clients
  for each row
  when (old.needs_review is true and new.needs_review is false)
  execute function auto_generate_client_code();
