-- 프로젝트 유형 제약 완화 (한국어 값 직접 사용)
alter table projects drop constraint if exists projects_type_check;
