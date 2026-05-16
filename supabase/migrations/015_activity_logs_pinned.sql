-- 015: activity_logs에 pinned 컬럼 추가
-- 업무 흐름 타임라인에서 중요 이벤트를 고정하기 위한 필드

ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

-- pinned 항목 빠른 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_activity_logs_pinned ON activity_logs(user_id, pinned) WHERE pinned = true;
