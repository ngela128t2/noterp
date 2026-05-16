-- 018: 습관 루틴 시스템
CREATE TABLE IF NOT EXISTS habits (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) NOT NULL,
  title           text NOT NULL,
  category        text,                          -- 운동/독서/업무/건강/기타
  color           text NOT NULL DEFAULT 'indigo',-- indigo/emerald/amber/red/purple/pink
  repeat_rule     text NOT NULL DEFAULT 'daily', -- daily/weekdays/weekends/custom
  repeat_days     int[],                         -- 0=일 1=월 ... 6=토 (custom용)
  target_time     text,                          -- HH:mm (선택)
  linked_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  streak          integer NOT NULL DEFAULT 0,
  best_streak     integer NOT NULL DEFAULT 0,
  last_completed_at date,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) NOT NULL,
  habit_id     uuid REFERENCES habits(id) ON DELETE CASCADE NOT NULL,
  completed_at date NOT NULL,
  note         text,
  created_at   timestamptz DEFAULT now() NOT NULL,
  UNIQUE (habit_id, completed_at)
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='habits' AND policyname='habits_user') THEN
    EXECUTE 'CREATE POLICY habits_user ON habits USING (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='habit_logs' AND policyname='habit_logs_user') THEN
    EXECUTE 'CREATE POLICY habit_logs_user ON habit_logs USING (user_id = auth.uid())';
  END IF;
END $$;
