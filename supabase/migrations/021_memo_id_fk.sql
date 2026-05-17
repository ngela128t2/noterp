-- memo_id FK: 메모에서 생성된 파생 데이터가 원본 메모를 기억하도록 연결
-- "메모가 모든 업무 맥락의 시작점" 철학을 데이터 레벨에서 구현

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS memo_id UUID REFERENCES memos(id) ON DELETE SET NULL;

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS memo_id UUID REFERENCES memos(id) ON DELETE SET NULL;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS memo_id UUID REFERENCES memos(id) ON DELETE SET NULL;

-- 프로젝트는 여러 메모에서 업데이트될 수 있으므로 created_from_memo_id (최초 생성 메모만)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS created_from_memo_id UUID REFERENCES memos(id) ON DELETE SET NULL;

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS memo_id UUID REFERENCES memos(id) ON DELETE SET NULL;

-- 조회 성능 인덱스 (memo_id가 있는 행만 인덱싱)
CREATE INDEX IF NOT EXISTS idx_calendar_events_memo_id
  ON calendar_events(memo_id) WHERE memo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_todos_memo_id
  ON todos(memo_id) WHERE memo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_memo_id
  ON contacts(memo_id) WHERE memo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_created_from_memo_id
  ON projects(created_from_memo_id) WHERE created_from_memo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_milestones_memo_id
  ON milestones(memo_id) WHERE memo_id IS NOT NULL;
