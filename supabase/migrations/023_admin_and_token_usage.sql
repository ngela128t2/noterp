-- 023: 관리자 권한 + AI 토큰 사용량 추적
--
-- ⚠️ 주의: profiles.role은 이미 "직책(job title)" 용도로 사용 중이므로
-- 권한용 컬럼은 충돌 방지를 위해 app_role로 분리합니다.

-- ──────────────────────────────────────────────────────────────────────
-- 1) profiles.app_role 컬럼 추가 (admin / user)
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS app_role TEXT NOT NULL DEFAULT 'user';

-- CHECK 제약 조건 (이미 있으면 스킵)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_app_role_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_app_role_check CHECK (app_role IN ('admin', 'user'));
  END IF;
END $$;

-- ngela128@gmail.com을 admin으로 지정
UPDATE profiles
SET app_role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'ngela128@gmail.com'
);

-- ──────────────────────────────────────────────────────────────────────
-- 2) is_admin() 헬퍼 함수 (RLS 정책에서 사용)
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND app_role = 'admin'
  );
$$;

-- ──────────────────────────────────────────────────────────────────────
-- 3) token_usage 테이블
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  provider        TEXT NOT NULL,                  -- 'anthropic' | 'gemini' | 'openai'
  model           TEXT NOT NULL,                  -- 'claude-haiku-4-5-20251001' 등
  feature         TEXT NOT NULL,                  -- 'parse_memo' | 'today_briefing' | ...
  input_tokens    INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  total_tokens    INTEGER DEFAULT 0,
  estimated_cost  NUMERIC(10, 6) DEFAULT 0,       -- USD
  metadata        JSONB,                          -- 추가 메타 (캐시 토큰, error 등)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 조회 성능
CREATE INDEX IF NOT EXISTS idx_token_usage_user_created
  ON token_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_feature_created
  ON token_usage(feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_created
  ON token_usage(created_at DESC);

-- ──────────────────────────────────────────────────────────────────────
-- 4) token_usage RLS
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS token_usage_select ON token_usage;
CREATE POLICY token_usage_select ON token_usage
  FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS token_usage_insert ON token_usage;
CREATE POLICY token_usage_insert ON token_usage
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
-- Edge Function은 service role로 INSERT하므로 RLS 우회됨

-- ──────────────────────────────────────────────────────────────────────
-- 5) profiles에 admin SELECT 허용 (Admin이 전체 사용자 목록 보기 위함)
-- ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_admin_read_all'
  ) THEN
    EXECUTE '
      CREATE POLICY profiles_admin_read_all ON profiles
      FOR SELECT
      USING (public.is_admin())
    ';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────
-- 6) Admin용 사용량 집계 뷰 (사용자별 요약)
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW token_usage_by_user AS
SELECT
  tu.user_id,
  COALESCE(tu.email, u.email) AS email,
  COALESCE(p.full_name, u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name') AS full_name,
  COUNT(*)                       AS call_count,
  SUM(tu.input_tokens)           AS total_input_tokens,
  SUM(tu.output_tokens)          AS total_output_tokens,
  SUM(tu.total_tokens)           AS total_tokens,
  SUM(tu.estimated_cost)         AS total_cost,
  MAX(tu.created_at)             AS last_call_at
FROM token_usage tu
LEFT JOIN auth.users u ON u.id = tu.user_id
LEFT JOIN profiles p   ON p.id = tu.user_id
GROUP BY tu.user_id, tu.email, u.email, p.full_name, u.raw_user_meta_data;

-- ──────────────────────────────────────────────────────────────────────
-- 7) Admin용 사용량 집계 뷰 (기능별)
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW token_usage_by_feature AS
SELECT
  feature,
  provider,
  model,
  COUNT(*)               AS call_count,
  SUM(input_tokens)      AS total_input_tokens,
  SUM(output_tokens)     AS total_output_tokens,
  SUM(total_tokens)      AS total_tokens,
  SUM(estimated_cost)    AS total_cost
FROM token_usage
GROUP BY feature, provider, model;

-- 사용 예시:
--   본인 사용량: SELECT * FROM token_usage WHERE user_id = auth.uid() ORDER BY created_at DESC
--   Admin 전체:  SELECT * FROM token_usage_by_user ORDER BY total_cost DESC
--   기능별:      SELECT * FROM token_usage_by_feature ORDER BY total_cost DESC
