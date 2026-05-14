-- 거래처 테이블 컬럼 추가
alter table clients
  add column if not exists code text,                  -- IN-001, CL-001
  add column if not exists business_number text,        -- 사업자번호
  add column if not exists representative text,         -- 대표자
  add column if not exists established_date date,       -- 개업일
  add column if not exists services text,               -- 제공 용역 (세무대리·기장 등)
  add column if not exists fiscal_month integer;        -- 결산월 (1~12)

-- 코드 자동 채번 함수
create or replace function generate_client_code(user_uuid uuid, biz_type text)
returns text as $$
declare
  prefix text;
  next_num integer;
begin
  prefix := case when biz_type = '외부감사' then 'CL' else 'IN' end;
  select coalesce(max(cast(substring(code, 4) as integer)), 0) + 1
    into next_num
    from clients
    where user_id = user_uuid and code like prefix || '-%';
  return prefix || '-' || lpad(next_num::text, 3, '0');
end;
$$ language plpgsql;
