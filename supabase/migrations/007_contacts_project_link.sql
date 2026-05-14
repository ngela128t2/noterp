alter table contacts
  add column if not exists project_id uuid references projects on delete set null;
