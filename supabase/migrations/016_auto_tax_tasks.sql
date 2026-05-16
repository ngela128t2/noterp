-- 016: 세무대리 테이블 생성 + 월별 업무 자동 생성 함수

-- ── tax_tasks 테이블 ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_tasks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id),
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  month       text NOT NULL,
  task_type   text NOT NULL CHECK (task_type IN ('원천세','부가세','법인세','종소세','기장')),
  status      text NOT NULL DEFAULT '대기'
                CHECK (status IN ('대기','요청함','일부수신','완료','해당없음','지연','위험')),
  due_date    date,
  requested_at date,
  received_at  date,
  memo        text,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE tax_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_tasks_user" ON tax_tasks
  USING (user_id = auth.uid() OR user_id IS NULL);

-- ── labor_checks 테이블 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labor_checks (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES auth.users(id),
  client_id        uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  employee_count   integer NOT NULL DEFAULT 0,
  new_hire         boolean NOT NULL DEFAULT false,
  resignation      boolean NOT NULL DEFAULT false,
  contract_status  text NOT NULL DEFAULT '미확인'
                     CHECK (contract_status IN ('완료','일부','미확인')),
  has_salary_ledger boolean NOT NULL DEFAULT false,
  insurance_filed   boolean NOT NULL DEFAULT false,
  annual_leave_issue boolean NOT NULL DEFAULT false,
  memo             text,
  updated_at       timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE labor_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "labor_checks_user" ON labor_checks
  USING (user_id = auth.uid() OR user_id IS NULL);

-- ── 자동생성 함수 ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_monthly_tax_tasks(target_month TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month TEXT;
  v_mon   INTEGER;
  v_client RECORD;
BEGIN
  v_month := COALESCE(
    target_month,
    TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM')
  );
  v_mon := EXTRACT(MONTH FROM (v_month || '-01')::DATE)::INTEGER;

  FOR v_client IN
    SELECT id, service_detail, tax_type, entity_type
    FROM clients
    WHERE service_category = '세무대리'
      AND COALESCE(status, 'active') != 'inactive'
  LOOP

    -- ── 기장 ────────────────────────────────────────────────────────────────
    IF v_client.service_detail = '기장' THEN

      INSERT INTO tax_tasks (client_id, month, task_type, status)
      SELECT v_client.id, v_month, '기장', '대기'
      WHERE NOT EXISTS (
        SELECT 1 FROM tax_tasks
        WHERE client_id = v_client.id AND month = v_month AND task_type = '기장'
      );

      INSERT INTO tax_tasks (client_id, month, task_type, status)
      SELECT v_client.id, v_month, '원천세', '대기'
      WHERE NOT EXISTS (
        SELECT 1 FROM tax_tasks
        WHERE client_id = v_client.id AND month = v_month AND task_type = '원천세'
      );

      IF (v_client.tax_type = '일반과세' OR v_client.entity_type = '법인')
         AND v_mon = ANY(ARRAY[1,4,7,10]) THEN
        INSERT INTO tax_tasks (client_id, month, task_type, status)
        SELECT v_client.id, v_month, '부가세', '대기'
        WHERE NOT EXISTS (
          SELECT 1 FROM tax_tasks
          WHERE client_id = v_client.id AND month = v_month AND task_type = '부가세'
        );
      ELSIF v_client.tax_type = '간이과세' AND v_mon = 1 THEN
        INSERT INTO tax_tasks (client_id, month, task_type, status)
        SELECT v_client.id, v_month, '부가세', '대기'
        WHERE NOT EXISTS (
          SELECT 1 FROM tax_tasks
          WHERE client_id = v_client.id AND month = v_month AND task_type = '부가세'
        );
      END IF;

      IF v_client.entity_type = '법인' AND v_mon = 3 THEN
        INSERT INTO tax_tasks (client_id, month, task_type, status)
        SELECT v_client.id, v_month, '법인세', '대기'
        WHERE NOT EXISTS (
          SELECT 1 FROM tax_tasks
          WHERE client_id = v_client.id AND month = v_month AND task_type = '법인세'
        );
      END IF;

      IF COALESCE(v_client.entity_type, '') != '법인' AND v_mon = 5 THEN
        INSERT INTO tax_tasks (client_id, month, task_type, status)
        SELECT v_client.id, v_month, '종소세', '대기'
        WHERE NOT EXISTS (
          SELECT 1 FROM tax_tasks
          WHERE client_id = v_client.id AND month = v_month AND task_type = '종소세'
        );
      END IF;

    END IF;

    -- ── 조정 ────────────────────────────────────────────────────────────────
    IF v_client.service_detail = '조정' THEN

      IF v_client.entity_type = '법인' AND v_mon = 3 THEN
        INSERT INTO tax_tasks (client_id, month, task_type, status)
        SELECT v_client.id, v_month, '법인세', '대기'
        WHERE NOT EXISTS (
          SELECT 1 FROM tax_tasks
          WHERE client_id = v_client.id AND month = v_month AND task_type = '법인세'
        );
      END IF;

      IF COALESCE(v_client.entity_type, '') != '법인' AND v_mon = 5 THEN
        INSERT INTO tax_tasks (client_id, month, task_type, status)
        SELECT v_client.id, v_month, '종소세', '대기'
        WHERE NOT EXISTS (
          SELECT 1 FROM tax_tasks
          WHERE client_id = v_client.id AND month = v_month AND task_type = '종소세'
        );
      END IF;

    END IF;

    -- ── 신고대리 ─────────────────────────────────────────────────────────────
    IF v_client.service_detail = '신고대리' THEN

      INSERT INTO tax_tasks (client_id, month, task_type, status)
      SELECT v_client.id, v_month, '원천세', '대기'
      WHERE NOT EXISTS (
        SELECT 1 FROM tax_tasks
        WHERE client_id = v_client.id AND month = v_month AND task_type = '원천세'
      );

      IF v_client.tax_type = '일반과세' AND v_mon = ANY(ARRAY[1,4,7,10]) THEN
        INSERT INTO tax_tasks (client_id, month, task_type, status)
        SELECT v_client.id, v_month, '부가세', '대기'
        WHERE NOT EXISTS (
          SELECT 1 FROM tax_tasks
          WHERE client_id = v_client.id AND month = v_month AND task_type = '부가세'
        );
      ELSIF v_client.tax_type = '간이과세' AND v_mon = 1 THEN
        INSERT INTO tax_tasks (client_id, month, task_type, status)
        SELECT v_client.id, v_month, '부가세', '대기'
        WHERE NOT EXISTS (
          SELECT 1 FROM tax_tasks
          WHERE client_id = v_client.id AND month = v_month AND task_type = '부가세'
        );
      END IF;

    END IF;

  END LOOP;

  RETURN json_build_object('month', v_month, 'status', 'ok');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_monthly_tax_tasks(TEXT) TO authenticated;

-- pg_cron: 매월 1일 00:00 UTC (= 한국시간 09:00)
-- Supabase 대시보드 Database > Extensions에서 pg_cron이 활성화되어 있어야 합니다
SELECT cron.schedule(
  'auto-tax-tasks-monthly',
  '0 0 1 * *',
  'SELECT generate_monthly_tax_tasks()'
);
