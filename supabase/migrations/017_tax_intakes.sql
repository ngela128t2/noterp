-- 017: 세무대리 신규 접수함
CREATE TABLE IF NOT EXISTS tax_intakes (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) NOT NULL,
  status          text NOT NULL DEFAULT 'receiving'
                    CHECK (status IN ('receiving','reviewing','approved','rejected')),
  source          text,                    -- 다울/카톡/메일/직접방문/기타
  client_name     text,
  business_number text,
  representative  text,
  phone           text,
  email           text,
  address         text,
  entity_type     text,                    -- 법인/개인사업자/개인
  tax_type        text,                    -- 일반과세/간이과세/면세
  service_detail  text,                    -- 기장/조정/신고대리
  bookkeeping_fee integer,
  withdrawal_day  integer,
  bank_info       text,
  documents       jsonb NOT NULL DEFAULT '{}',
                                           -- {application, business_license, id_card, bank_account, consultation_memo}
  risk_points     text[] NOT NULL DEFAULT '{}',
  notes           text,
  client_id       uuid REFERENCES clients(id), -- 승인 후 연결된 거래처
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE tax_intakes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tax_intakes' AND policyname = 'tax_intakes_user'
  ) THEN
    EXECUTE 'CREATE POLICY "tax_intakes_user" ON tax_intakes USING (user_id = auth.uid())';
  END IF;
END $$;
