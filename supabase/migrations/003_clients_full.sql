-- 거래처 테이블 전체 확장
alter table clients
  add column if not exists entity_type text default '법인',        -- 법인 / 개인
  add column if not exists client_type text default '매출처',      -- 매출처 / 매입처 / 공통
  add column if not exists corp_number text,                        -- 법인번호
  add column if not exists fss_number text,                         -- 금감원 고유번호
  add column if not exists address text,                            -- 주소
  add column if not exists contract_date date,                      -- 계약일
  add column if not exists service_category text,                   -- 제공 용역 대분류
  add column if not exists service_detail text,                     -- 상세분류
  add column if not exists tax_type text,                           -- 과세유형
  add column if not exists withholding_type text,                   -- 원천세신고유형
  add column if not exists manager text,                            -- 담당자 (내부)
  add column if not exists memo text,                               -- 비고
  add column if not exists bank_name text,                          -- 은행명
  add column if not exists account_number text,                     -- 계좌번호
  add column if not exists account_holder text;                     -- 예금주

-- 관할 세무서
alter table clients add column if not exists tax_office text;
