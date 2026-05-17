-- activity_stream VIEW: 모든 업무 흐름을 단일 스트림으로 통합
-- Dashboard, WorkspacePage Timeline, Client Timeline, Project Timeline이 동일 구조를 사용
--
-- stream_type 값:
--   'memo'      — 승인된 메모 (모든 활동의 시작점)
--   'event'     — 캘린더 일정
--   'todo'      — 할 일
--   'milestone' — 마일스톤
--   'activity'  — 시스템 자동 로그 (생성/수정/삭제)

CREATE OR REPLACE VIEW activity_stream AS

-- 1. 메모 (시작점)
SELECT
  'memo'::TEXT          AS stream_type,
  m.id,
  CASE
    WHEN LENGTH(m.raw_text) > 80 THEN LEFT(m.raw_text, 80) || '…'
    ELSE m.raw_text
  END                   AS title,
  NULL::UUID            AS client_id,
  NULL::UUID            AS project_id,
  m.id                  AS memo_id,
  m.user_id,
  m.created_at,
  NULL::TEXT            AS extra,
  (m.parsed_result->>'memo_type')::TEXT AS meta_type
FROM memos m
WHERE m.status = 'approved'

UNION ALL

-- 2. 캘린더 일정
SELECT
  'event'::TEXT         AS stream_type,
  e.id,
  e.title,
  e.client_id,
  e.project_id,
  e.memo_id,
  e.user_id,
  e.created_at,
  e.location            AS extra,
  NULL::TEXT            AS meta_type
FROM calendar_events e

UNION ALL

-- 3. 할 일
SELECT
  'todo'::TEXT          AS stream_type,
  t.id,
  t.title,
  t.client_id,
  t.project_id,
  t.memo_id,
  t.user_id,
  t.created_at,
  t.priority            AS extra,
  NULL::TEXT            AS meta_type
FROM todos t

UNION ALL

-- 4. 마일스톤 (프로젝트 → 거래처 join으로 client_id 추론)
SELECT
  'milestone'::TEXT     AS stream_type,
  ms.id,
  ms.title,
  p.client_id,
  ms.project_id,
  ms.memo_id,
  p.user_id,
  ms.created_at,
  ms.due_date::TEXT     AS extra,
  NULL::TEXT            AS meta_type
FROM milestones ms
JOIN projects p ON p.id = ms.project_id

UNION ALL

-- 5. 활동 로그 (시스템 자동 기록)
SELECT
  'activity'::TEXT      AS stream_type,
  al.id,
  al.entity_name        AS title,
  CASE WHEN al.entity_type = 'client'  THEN al.entity_id ELSE NULL END AS client_id,
  CASE WHEN al.entity_type = 'project' THEN al.entity_id ELSE NULL END AS project_id,
  NULL::UUID            AS memo_id,
  al.user_id,
  al.created_at,
  al.action             AS extra,
  al.entity_type        AS meta_type
FROM activity_logs al;

-- 주석: RLS는 각 기반 테이블에서 적용됨 (security invoker 기본값)
-- 사용 예시:
--   전체 스트림: SELECT * FROM activity_stream WHERE user_id = auth.uid() ORDER BY created_at DESC
--   거래처 스트림: SELECT * FROM activity_stream WHERE user_id = auth.uid() AND client_id = $1 ORDER BY created_at DESC
--   프로젝트 스트림: SELECT * FROM activity_stream WHERE user_id = auth.uid() AND project_id = $1 ORDER BY created_at DESC
--   메모 파생 조회: SELECT * FROM activity_stream WHERE memo_id = $1 ORDER BY created_at DESC
