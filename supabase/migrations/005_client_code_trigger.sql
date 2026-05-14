-- 거래처 코드 자동 채번 트리거
-- 법인 → CL-001, 개인 → IN-001

create or replace function auto_generate_client_code()
returns trigger as $$
declare
  prefix text;
  next_num integer;
begin
  if NEW.code is null then
    prefix := case when NEW.entity_type = '법인' then 'CL' else 'IN' end;

    select coalesce(
      max(cast(substring(code from 4) as integer)), 0
    ) + 1
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
