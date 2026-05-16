-- 014: calendar_events에 완료 상태 추가
-- timeline의 '업무 이벤트 완료' 처리를 위해 completed 컬럼 추가

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
