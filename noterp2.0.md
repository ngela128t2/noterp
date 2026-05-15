# Noterp 2.0 기획서

> **작성일**: 2026-05-15  
> **대상**: 회계법인 성지  
> **목표**: AI 메모 기반 ERP → 회계법인 전용 업무 플랫폼으로 고도화

---

## 1. v1 현황 요약

### 구현 완료 기능

| 모듈 | 기능 |
|------|------|
| **메모 AI** | 자유형 텍스트 → Claude Sonnet 4.6 파싱 → 거래처·프로젝트·일정·할 일·연락처 자동 분류 |
| **단축 문법** | `#거래처` `/프로젝트` `@날짜` `@이름` `*개별일정` `!우선순위` |
| **거래처 관리** | OCR(사업자등록증), 즐겨찾기 고정, 상세 패널(정보/업무), 코드 자동 생성(CL-/IN-) |
| **프로젝트** | 타임라인 빠른 입력 `(26/5/22) 오후3시 내용`, 마일스톤 날짜+시간 분리 저장 |
| **캘린더** | FullCalendar, 날짜 클릭 일정 보기, 날짜 숫자 클릭 입력 폼 |
| **N-CRM** | 명함 OCR(Gemini), 다중 명함 일괄 업로드, 거래처·프로젝트 연결 |
| **대시보드** | KPI 4종, 미니 캘린더(날짜 클릭 → 일정 패널), 오늘 일정·이번 주·미완료 할 일 |
| **할 일** | 우선순위, 마감일, 거래처·프로젝트 연결 |
| **AI 검토** | `needs_review` 플래그, 메모 출처 표시, 수정 전 검토 필요 UI |

### 기술 스택 (v1)

```
Frontend  : React 18 + Vite + TypeScript + Tailwind CSS v4
State     : TanStack React Query
DB/Auth   : Supabase (PostgreSQL + RLS)
AI        : Claude Sonnet 4.6 (메모 파싱) + Gemini 2.5 Flash (OCR)
Calendar  : FullCalendar
Deploy    : Vercel + noterp.co.kr
```

### v1 DB 스키마 (핵심 테이블)

```
clients       : 거래처 (code, entity_type, service_category, is_pinned, needs_review)
projects      : 프로젝트 (status, type, memo, needs_review)
milestones    : 타임라인 항목 (due_date, time, completed)
calendar_events : 일정 (date, time, location, client_id, project_id)
todos         : 할 일 (priority, due_date, client_id, project_id)
contacts      : N-CRM 연락처 (company, client_id, tags, source)
memos         : 메모 로그 (raw_text, parsed_result, status)
activity_logs : 활동 로그 (action, entity_type, entity_id)
```

---

## 2. v2.0 핵심 방향

> **"메모 하나로 모든 업무 흐름을 만든다"** → **"법인 전체의 업무를 한 화면에서 본다"**

v1이 개인 사용자의 메모 → 데이터 자동 저장에 집중했다면, v2.0은 **팀 협업 + 업무 자동화 + 보고서**로 확장한다.

---

## 3. v2.0 신규 기능 목록

### 3-1. 이메일 연동 (Email → 메모 자동 입력)

**배경**: 사용자가 대학교 원격수업 신청 이메일처럼, 수신 메일을 그대로 메모에 붙여넣어 파싱하는 유스케이스 확인.

**기능 명세**
- 이메일 본문 붙여넣기 → AI 파싱 (마감일, 담당자, 할 일 자동 추출)
- Gmail/Outlook 웹훅 연동 (선택): 특정 폴더 수신 메일 → 메모 자동 생성
- 첨부 파일(Excel/PDF) → Gemini OCR → 내용 요약 추출
- 이메일 스레드 연결 (거래처 이메일 도메인 → 클라이언트 자동 매칭)

**DB 추가**
```sql
ALTER TABLE memos ADD COLUMN source_type text; -- 'manual' | 'email' | 'ocr'
ALTER TABLE memos ADD COLUMN source_ref text;  -- 이메일 메시지 ID 등
```

---

### 3-2. 팀 협업 (다중 사용자)

**배경**: 현재 `user_id` 기반 단일 사용자. 법인 내 여러 담당자가 공유해야 함.

**기능 명세**
- 조직(organization) 개념 도입: `org_id` 로 데이터 공유
- 역할(role): `admin` / `manager` / `staff`
- 거래처별 담당자 배정 (clients.manager_id → FK to users)
- 메모 작성자 표시 (누가 언제 입력했는지)
- 실시간 알림: 내가 담당인 거래처/프로젝트가 업데이트되면 알림

**DB 추가**
```sql
CREATE TABLE organizations (id uuid, name text, created_at timestamptz);
CREATE TABLE org_members (org_id uuid, user_id uuid, role text, joined_at timestamptz);
ALTER TABLE clients ADD COLUMN org_id uuid REFERENCES organizations(id);
ALTER TABLE projects ADD COLUMN assigned_to uuid REFERENCES auth.users(id);
```

---

### 3-3. 용역 수금 관리 (Billing)

**배경**: 회계법인 핵심 업무 = 용역료 청구 및 수금 추적.

**기능 명세**
- 거래처별 계약 용역료 등록 (월정액/건별)
- 청구 일정 자동 생성 (매월 N일 → 캘린더 연동)
- 수금 현황 대시보드: 청구 완료 / 미수금 / 수금 완료
- 세금계산서 발행 연동 (홈택스 API or 외부 연동 준비)
- 미수금 알림 자동화 (D+30일 이상 → 할 일 자동 생성)

**DB 추가**
```sql
CREATE TABLE billing_contracts (
  id uuid, client_id uuid, 
  service_category text, amount integer,
  billing_cycle text, -- 'monthly' | 'quarterly' | 'once'
  billing_day integer, -- 매월 몇 일
  start_date date, end_date date
);
CREATE TABLE billing_records (
  id uuid, contract_id uuid, client_id uuid,
  amount integer, billed_at date, 
  paid_at date, status text -- 'pending' | 'billed' | 'paid' | 'overdue'
);
```

---

### 3-4. 마감 기한 자동 알림

**배경**: 세무신고, 감사보고서 등 법정 기한을 놓치면 과태료 발생.

**기능 명세**
- 거래처별 정기 마감 일정 템플릿 (부가세 신고, 법인세 신고, 감사보고서 등)
- D-7, D-3, D-1 자동 알림 → 할 일 생성 + 앱 내 알림
- 브라우저 푸시 알림 (PWA)
- 슬랙/카카오 알림 연동 (옵션)

**DB 추가**
```sql
CREATE TABLE deadline_templates (
  id uuid, org_id uuid,
  name text, -- '부가세 1기 예정신고'
  recurrence text, -- 'yearly' | 'quarterly' | 'monthly'
  month integer, day integer, -- 매년 4월 25일
  alert_days integer[] -- [7, 3, 1]
);
CREATE TABLE deadline_instances (
  id uuid, template_id uuid, client_id uuid,
  due_date date, completed boolean, notified_at timestamptz
);
```

---

### 3-5. 통합 검색 (Unified Search)

**배경**: 현재 각 화면에서만 검색 가능. 거래처명으로 관련된 모든 것(메모, 일정, 할 일)을 한번에 볼 수 없음.

**기능 명세**
- 글로벌 검색창 (Cmd+K): 거래처·프로젝트·메모·연락처·일정 통합 검색
- 검색 결과 카테고리별 그룹핑
- 최근 검색어 저장
- 거래처 클릭 시 해당 거래처의 전체 히스토리 타임라인 보기

---

### 3-6. 보고서 / 통계

**기능 명세**
- 월별 업무 현황 리포트 (처리한 메모 수, 신규 거래처, 완료 프로젝트)
- 거래처별 업무량 분석
- 담당자별 업무 현황 (팀 협업 전제)
- PDF 내보내기

---

### 3-7. 메모 AI 고도화

**기능 명세**
- **문서 첨부 파싱**: PDF 계약서·공문 → AI 요약 → 주요 날짜·조건 추출
- **반복 일정 인식**: "매주 수요일 오전 10시 정례회의" → 반복 캘린더 이벤트 자동 생성
- **메모 검색**: 과거 메모를 자연어로 검색 ("지난달 안진회계법인 미팅 언제였지?")
- **자동 완성 개선**: 거래처명·프로젝트명 입력 시 fuzzy 매칭 + 최근 사용 우선
- **메모 템플릿**: 자주 쓰는 메모 패턴을 템플릿으로 저장

---

### 3-8. 모바일 PWA

**배경**: 외근 중 명함 찍기, 미팅 후 바로 메모 입력 유스케이스.

**기능 명세**
- PWA(Progressive Web App) 설정: 홈 화면 설치, 오프라인 기본 동작
- 모바일 카메라 → 명함 OCR 원터치
- 하단 탭 네비게이션 최적화 (이미 `BottomNav` 존재)
- 음성 메모 입력 → STT → AI 파싱

---

### 3-9. 캘린더 고도화

**기능 명세**
- 반복 일정 지원 (매주/매월/매년)
- 구글 캘린더 양방향 동기화
- 일정 참석자 추가 (N-CRM 연락처 연동)
- 회의 준비 체크리스트 자동 생성

---

### 3-10. 거래처 고도화

**기능 명세**
- 거래처 그룹핑 (계열사, 파트너, VIP 등)
- 거래처 체인지로그: 정보 변경 이력 추적
- 이관 이력 관리 (담당자 변경 시 히스토리 보존)
- 거래처 건강지수: 최근 미팅 일수, 미완료 할 일 수 등 종합 지표

---

## 4. v2.0 기술 개선 사항

### 4-1. 성능 최적화

- 번들 사이즈 분할 (현재 1.25MB → code splitting으로 초기 로드 개선)
- React Query 캐시 전략 고도화 (staleTime 설정)
- Supabase Realtime 구독 (다중 사용자 동시성)
- 이미지 최적화 (명함 이미지 리사이즈 후 OCR)

### 4-2. 보안 강화

- RLS 정책 조직 단위로 확장 (`org_id` 기반)
- API 키 서버 사이드 이전 (현재 `dangerouslyAllowBrowser: true` → Edge Function으로)
- 감사 로그 강화 (모든 데이터 변경 이력)

### 4-3. AI 비용 최적화

- 메모 파싱에 캐싱 적용 (동일 텍스트 재파싱 방지)
- 짧은 메모는 Claude 호출 없이 shortcut 파서로만 처리
- Gemini Flash → OCR 전용 / Claude → 복잡한 파싱 전용으로 역할 분리

### 4-4. 개발자 경험

- E2E 테스트 추가 (Playwright)
- Storybook 컴포넌트 문서화
- GitHub Actions CI 파이프라인
- Supabase 마이그레이션 자동화 (`supabase db push`)

---

## 5. v2.0 DB 마이그레이션 로드맵

```sql
-- Migration 012: organizations (팀 협업)
CREATE TABLE organizations (...);
CREATE TABLE org_members (...);

-- Migration 013: billing (수금 관리)
CREATE TABLE billing_contracts (...);
CREATE TABLE billing_records (...);

-- Migration 014: deadlines (마감 알림)
CREATE TABLE deadline_templates (...);
CREATE TABLE deadline_instances (...);

-- Migration 015: enhanced clients
ALTER TABLE clients ADD COLUMN org_id uuid;
ALTER TABLE clients ADD COLUMN group_id uuid;  -- 거래처 그룹
ALTER TABLE clients ADD COLUMN health_score integer;

-- Migration 016: enhanced memos
ALTER TABLE memos ADD COLUMN source_type text DEFAULT 'manual';
ALTER TABLE memos ADD COLUMN attachments jsonb;

-- Migration 017: recurring events
ALTER TABLE calendar_events ADD COLUMN recurrence text;
ALTER TABLE calendar_events ADD COLUMN recurrence_end date;
ALTER TABLE calendar_events ADD COLUMN parent_event_id uuid;
```

---

## 6. v2.0 화면 구성 변경

### 신규 화면

| 화면 | 설명 |
|------|------|
| `/billing` | 수금 관리 대시보드 |
| `/deadlines` | 마감 기한 캘린더 |
| `/reports` | 월별 업무 리포트 |
| `/search` | 통합 검색 결과 |
| `/settings` | 조직 설정, 팀원 관리, 알림 설정 |

### 변경 화면

| 화면 | 변경 내용 |
|------|---------|
| `/dashboard` | 수금 현황 KPI 추가, 팀 업무 현황 추가 |
| `/clients` | 거래처 그룹 필터, 건강지수 표시 |
| `/memo` | 이메일 붙여넣기 모드, 문서 첨부 파싱 |
| `/calendar` | 반복 일정, 마감 기한 레이어 |

---

## 7. v2.0 출시 로드맵 (안)

| 기간 | 스프린트 | 주요 작업 |
|------|---------|---------|
| 1주차 | Sprint 1 | 팀 협업 기반 (organizations + org_members + RLS) |
| 2주차 | Sprint 2 | 이메일 연동 (붙여넣기 파싱 + 도메인 매칭) |
| 3~4주차 | Sprint 3 | 수금 관리 (billing_contracts + billing_records + 대시보드) |
| 5주차 | Sprint 4 | 마감 기한 자동 알림 (templates + 푸시 알림) |
| 6주차 | Sprint 5 | 통합 검색 (Cmd+K 글로벌 검색) |
| 7~8주차 | Sprint 6 | 보고서 / 통계 + PDF 내보내기 |
| 9주차 | Sprint 7 | AI 고도화 (문서 첨부, 반복 일정 인식, 메모 검색) |
| 10주차 | Sprint 8 | PWA + 모바일 최적화 + 성능 개선 |

---

## 8. v1 잔여 기술 부채

완료 전에 정리해야 할 v1 이슈:

- [ ] `projects.user_id` 컬럼 추가 (현재 RLS 정책에 user_id 없음)
- [ ] `ParsedResult.contacts` null name 방어 코드 (현재 null guard 추가됨)
- [ ] 거래처 메모 중복 저장 버그 (normalized key 중복 제거로 수정됨)
- [ ] 연락처 `user_id: ''` 업데이트 버그 (수정됨)
- [ ] 번들 크기 경고 (1.25MB → code splitting 적용 필요)
- [ ] `milestones.time` 컬럼 기존 항목 마이그레이션 (시간이 title에 내장된 구 항목 정리)
- [ ] N-CRM 거래처 필터: `client_id` + 회사명 fuzzy 매칭 (적용됨)

---

## 9. 우선순위 결정 기준

```
P0 (즉시): 수익에 직결 - 수금 관리, 마감 알림
P1 (단기): 팀 효율 - 팀 협업, 이메일 연동
P2 (중기): 사용성 - 통합 검색, 보고서
P3 (장기): 확장성 - PWA, 외부 연동, AI 고도화
```

---

*이 문서는 noterp.co.kr 운영 중인 v1 기반으로 작성되었습니다.*  
*기술 스택 및 DB 스키마는 현재 구현된 코드(`src/types/index.ts`, `src/hooks/`) 기준입니다.*
