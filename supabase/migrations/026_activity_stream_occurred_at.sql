-- 026: activity_stream에 occurred_at 컬럼 추가 — "실제 발생 시간" 기준 정렬
-- created_at(입력 시간) 대신 occurred_at(일정/마감 시간)으로 Today Flow 정렬 가능

DROP VIEW IF EXISTS activity_stream;

CREATE VIEW activity_stream AS

-- 1. 메모 — occurred_at = created_at
SELECT
  'memo'::TEXT AS stream_type, m.id,
  COALESCE(
    NULLIF(m.parsed_result->>'memo_summary', ''),
    CASE WHEN LENGTH(m.raw_text) > 80 THEN LEFT(m.raw_text, 80) || '…' ELSE m.raw_text END
  ) AS title,
  NULL::UUID AS client_id, NULL::TEXT AS client_name,
  NULL::UUID AS project_id, NULL::TEXT AS project_name,
  m.id AS memo_id, m.user_id, m.created_at,
  m.created_at AS occurred_at,
  NULL::TEXT AS extra,
  (m.parsed_result->>'memo_type')::TEXT AS meta_type
FROM memos m WHERE m.status = 'approved'

UNION ALL

-- 2. 이벤트 — occurred_at = date + time (실제 일정 시간)
SELECT
  'event'::TEXT, e.id, e.title, e.client_id, c.name, e.project_id, p.name,
  e.memo_id, e.user_id, e.created_at,
  (e.date::TEXT || ' ' || COALESCE(e.time::TEXT, '00:00:00'))::TIMESTAMPTZ AS occurred_at,
  e.location, NULL::TEXT
FROM calendar_events e
LEFT JOIN clients c ON c.id = e.client_id
LEFT JOIN projects p ON p.id = e.project_id

UNION ALL

-- 3. 할 일 — occurred_at = due_date (마감일 우선, 없으면 created_at)
SELECT
  'todo'::TEXT, t.id, t.title, t.client_id, c.name, t.project_id, p.name,
  t.memo_id, t.user_id, t.created_at,
  COALESCE(t.due_date::TIMESTAMPTZ, t.created_at) AS occurred_at,
  t.priority, NULL::TEXT
FROM todos t
LEFT JOIN clients c ON c.id = t.client_id
LEFT JOIN projects p ON p.id = t.project_id

UNION ALL

-- 4. 마일스톤 — occurred_at = due_date
SELECT
  'milestone'::TEXT, ms.id, ms.title, p.client_id, c.name, ms.project_id, p.name,
  ms.memo_id, p.user_id, ms.created_at,
  COALESCE(ms.due_date::TIMESTAMPTZ, ms.created_at) AS occurred_at,
  ms.due_date::TEXT, NULL::TEXT
FROM milestones ms
JOIN projects p ON p.id = ms.project_id
LEFT JOIN clients c ON c.id = p.client_id

UNION ALL

-- 5. 활동 로그 — occurred_at = created_at
SELECT
  'activity'::TEXT, al.id, al.entity_name,
  CASE WHEN al.entity_type = 'client' THEN al.entity_id ELSE NULL END,
  CASE WHEN al.entity_type = 'client' THEN al.entity_name ELSE NULL END,
  CASE WHEN al.entity_type = 'project' THEN al.entity_id ELSE NULL END,
  CASE WHEN al.entity_type = 'project' THEN al.entity_name ELSE NULL END,
  NULL::UUID, al.user_id, al.created_at,
  al.created_at AS occurred_at,
  al.action, al.entity_type
FROM activity_logs al;
