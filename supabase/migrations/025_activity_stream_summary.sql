-- 025: activity_stream의 memo title을 AI 요약(memo_summary) 우선
-- 카드 제목이 길고 정리 안 된 raw_text 대신 짧은 요약으로 표시

DROP VIEW IF EXISTS activity_stream;

CREATE VIEW activity_stream AS

-- 1. 메모 (시작점) — title은 AI 요약 우선
SELECT
  'memo'::TEXT          AS stream_type,
  m.id,
  COALESCE(
    NULLIF(m.parsed_result->>'memo_summary', ''),
    CASE
      WHEN LENGTH(m.raw_text) > 80 THEN LEFT(m.raw_text, 80) || '…'
      ELSE m.raw_text
    END
  )                     AS title,
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

SELECT
  'event'::TEXT, e.id, e.title, e.client_id, c.name, e.project_id, p.name,
  e.memo_id, e.user_id, e.created_at, e.location, NULL::TEXT
FROM calendar_events e
LEFT JOIN clients c  ON c.id = e.client_id
LEFT JOIN projects p ON p.id = e.project_id

UNION ALL

SELECT
  'todo'::TEXT, t.id, t.title, t.client_id, c.name, t.project_id, p.name,
  t.memo_id, t.user_id, t.created_at, t.priority, NULL::TEXT
FROM todos t
LEFT JOIN clients c  ON c.id = t.client_id
LEFT JOIN projects p ON p.id = t.project_id

UNION ALL

SELECT
  'milestone'::TEXT, ms.id, ms.title, p.client_id, c.name, ms.project_id, p.name,
  ms.memo_id, p.user_id, ms.created_at, ms.due_date::TEXT, NULL::TEXT
FROM milestones ms
JOIN projects p      ON p.id = ms.project_id
LEFT JOIN clients c  ON c.id = p.client_id

UNION ALL

SELECT
  'activity'::TEXT, al.id, al.entity_name,
  CASE WHEN al.entity_type = 'client'  THEN al.entity_id ELSE NULL END,
  CASE WHEN al.entity_type = 'client'  THEN al.entity_name ELSE NULL END,
  CASE WHEN al.entity_type = 'project' THEN al.entity_id ELSE NULL END,
  CASE WHEN al.entity_type = 'project' THEN al.entity_name ELSE NULL END,
  NULL::UUID, al.user_id, al.created_at, al.action, al.entity_type
FROM activity_logs al;
