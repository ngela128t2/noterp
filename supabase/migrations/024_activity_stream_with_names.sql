-- 024: activity_stream VIEW에 client_name / project_name 추가
-- Today Flow / Workspace Timeline에서 거래처/프로젝트 context를 즉시 표시 가능

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
  NULL::TEXT            AS client_name,
  NULL::UUID            AS project_id,
  NULL::TEXT            AS project_name,
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
  c.name                AS client_name,
  e.project_id,
  p.name                AS project_name,
  e.memo_id,
  e.user_id,
  e.created_at,
  e.location            AS extra,
  NULL::TEXT            AS meta_type
FROM calendar_events e
LEFT JOIN clients c  ON c.id = e.client_id
LEFT JOIN projects p ON p.id = e.project_id

UNION ALL

-- 3. 할 일
SELECT
  'todo'::TEXT          AS stream_type,
  t.id,
  t.title,
  t.client_id,
  c.name                AS client_name,
  t.project_id,
  p.name                AS project_name,
  t.memo_id,
  t.user_id,
  t.created_at,
  t.priority            AS extra,
  NULL::TEXT            AS meta_type
FROM todos t
LEFT JOIN clients c  ON c.id = t.client_id
LEFT JOIN projects p ON p.id = t.project_id

UNION ALL

-- 4. 마일스톤 (프로젝트 → 거래처 join)
SELECT
  'milestone'::TEXT     AS stream_type,
  ms.id,
  ms.title,
  p.client_id,
  c.name                AS client_name,
  ms.project_id,
  p.name                AS project_name,
  ms.memo_id,
  p.user_id,
  ms.created_at,
  ms.due_date::TEXT     AS extra,
  NULL::TEXT            AS meta_type
FROM milestones ms
JOIN projects p      ON p.id = ms.project_id
LEFT JOIN clients c  ON c.id = p.client_id

UNION ALL

-- 5. 활동 로그 (시스템 자동)
SELECT
  'activity'::TEXT      AS stream_type,
  al.id,
  al.entity_name        AS title,
  CASE WHEN al.entity_type = 'client'  THEN al.entity_id ELSE NULL END AS client_id,
  CASE WHEN al.entity_type = 'client'  THEN al.entity_name ELSE NULL END AS client_name,
  CASE WHEN al.entity_type = 'project' THEN al.entity_id ELSE NULL END AS project_id,
  CASE WHEN al.entity_type = 'project' THEN al.entity_name ELSE NULL END AS project_name,
  NULL::UUID            AS memo_id,
  al.user_id,
  al.created_at,
  al.action             AS extra,
  al.entity_type        AS meta_type
FROM activity_logs al;
