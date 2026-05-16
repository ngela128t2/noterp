-- 016: 월별 세무업무 자동 생성
-- 서비스유형(service_detail) + 세금유형(tax_type) + 거래처유형(entity_type) 기준으로
-- 이번 달 누락된 업무를 자동 생성하는 함수 + pg_cron 스케줄

-- user_id nullable 허용 (자동생성 업무는 시스템 생성이므로)
ALTER TABLE tax_tasks ALTER COLUMN user_id DROP NOT NULL;

-- 자동생성 함수
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
  -- 기본값: 한국시간 기준 현재 월
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

    -- ── 기장 ──────────────────────────────────────────────────────────────
    IF v_client.service_detail = '기장' THEN

      -- 기장: 매월
      INSERT INTO tax_tasks (client_id, month, task_type, status)
      SELECT v_client.id, v_month, '기장', '대기'
      WHERE NOT EXISTS (
        SELECT 1 FROM tax_tasks
        WHERE client_id = v_client.id AND month = v_month AND task_type = '기장'
      );

      -- 원천세: 매월
      INSERT INTO tax_tasks (client_id, month, task_type, status)
      SELECT v_client.id, v_month, '원천세', '대기'
      WHERE NOT EXISTS (
        SELECT 1 FROM tax_tasks
        WHERE client_id = v_client.id AND month = v_month AND task_type = '원천세'
      );

      -- 부가세: 일반과세/법인 → 1·4·7·10월 / 간이과세 → 1월
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

      -- 법인세: 법인 3월
      IF v_client.entity_type = '법인' AND v_mon = 3 THEN
        INSERT INTO tax_tasks (client_id, month, task_type, status)
        SELECT v_client.id, v_month, '법인세', '대기'
        WHERE NOT EXISTS (
          SELECT 1 FROM tax_tasks
          WHERE client_id = v_client.id AND month = v_month AND task_type = '법인세'
        );
      END IF;

      -- 종소세: 개인·개인사업자 5월
      IF COALESCE(v_client.entity_type, '') != '법인' AND v_mon = 5 THEN
        INSERT INTO tax_tasks (client_id, month, task_type, status)
        SELECT v_client.id, v_month, '종소세', '대기'
        WHERE NOT EXISTS (
          SELECT 1 FROM tax_tasks
          WHERE client_id = v_client.id AND month = v_month AND task_type = '종소세'
        );
      END IF;

    END IF;

    -- ── 조정 ──────────────────────────────────────────────────────────────
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

    -- ── 신고대리 ───────────────────────────────────────────────────────────
    IF v_client.service_detail = '신고대리' THEN

      -- 원천세: 매월
      INSERT INTO tax_tasks (client_id, month, task_type, status)
      SELECT v_client.id, v_month, '원천세', '대기'
      WHERE NOT EXISTS (
        SELECT 1 FROM tax_tasks
        WHERE client_id = v_client.id AND month = v_month AND task_type = '원천세'
      );

      -- 부가세: 일반과세 분기 / 간이 1월
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

-- authenticated 사용자가 RPC로 호출 가능하도록 권한 부여
GRANT EXECUTE ON FUNCTION generate_monthly_tax_tasks(TEXT) TO authenticated;

-- pg_cron: 매월 1일 00:00 UTC (= 한국시간 09:00)
-- Supabase 대시보드 Database > Extensions에서 pg_cron이 활성화되어 있어야 합니다
SELECT cron.schedule(
  'auto-tax-tasks-monthly',
  '0 0 1 * *',
  'SELECT generate_monthly_tax_tasks()'
);
