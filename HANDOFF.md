# Noterp 프로젝트 인수인계 문서
> 작성일: 2026-05-14 | 상태: Phase 1 대부분 완성, 개발 진행 중

---

## 1. 프로젝트 개요

**Noterp** — 회계법인 성지 전용 AI 메모→ERP 자동화 앱  
핵심 컨셉: 자유형 텍스트 메모 입력 → Claude AI가 자동 분류 → 거래처/프로젝트/캘린더/투두/인맥에 저장

**작업 디렉토리:** `c:\Users\User\Desktop\claude_noterp\noterp`  
**기획서 위치:** `c:\Users\User\Desktop\claude_noterp\noterp_clone\note_erp_plan.md`

---

## 2. 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS v4 |
| 라우팅 | React Router v6 |
| 서버 상태 | TanStack React Query |
| Backend/DB | Supabase (PostgreSQL + Auth + RLS + Realtime) |
| AI 오케스트레이터 | Claude Sonnet 4.6 (`@anthropic-ai/sdk`, dangerouslyAllowBrowser) |
| AI 서브에이전트 | Gemini 2.5 Flash (`@google/genai`) |
| 캘린더 | FullCalendar (dayGrid, timeGrid, interaction) |
| 배포 | Vercel (vercel.json SPA rewrite 설정 완료) |

---

## 3. 환경변수 (.env)

```
VITE_SUPABASE_URL=https://xbzkxefwrpaqdaxacgmr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_eRp32eUTvP00zPbpMR6T8g_CsulFPZo
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...
VITE_GEMINI_API_KEY=AIzaSy...
```

---

## 4. 파일 구조

```
noterp/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.tsx        # 사이드바 + 헤더 레이아웃, MemoFab 포함
│   │   │   ├── Sidebar.tsx       # 흰색 사이드바, 토글 시 콘텐츠 밀림
│   │   │   └── Header.tsx        # 모바일 햄버거 헤더
│   │   ├── ui/
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── MemoFab.tsx       # 우하단 연필 FAB (메모 페이지로 이동)
│   │   │   ├── PageHeader.tsx
│   │   │   └── Skeleton.tsx
│   │   ├── dashboard/
│   │   │   └── MiniCalendar.tsx  # 대시보드용 미니 캘린더
│   │   ├── clients/
│   │   │   ├── ClientFormModal.tsx  # 탭 구조 (기본/용역/계좌/기타)
│   │   │   └── ClientDetailPanel.tsx # 우측 슬라이드 상세 패널 + 활동 로그
│   │   ├── memo/
│   │   │   ├── MemoInput.tsx     # 자유형 입력, 2초 debounce 자동파싱
│   │   │   └── ParseResultCard.tsx  # 파싱 결과 카드 (승인/거부)
│   │   └── projects/
│   │       └── ProjectFormModal.tsx # 마일스톤 인라인 입력 포함
│   ├── hooks/
│   │   ├── useCalendarEvents.ts
│   │   ├── useClients.ts
│   │   ├── useContacts.ts
│   │   ├── useDashboard.ts
│   │   ├── useLogs.ts            # 활동 로그 (useRecentLogs, useClientLogs)
│   │   ├── useProjects.ts
│   │   └── useTodos.ts
│   ├── lib/
│   │   ├── claude.ts             # Claude Sonnet 메모 파싱 오케스트레이터
│   │   ├── gemini.ts             # Gemini Flash: 거래처 매칭 + 사업자등록증 OCR
│   │   └── supabase.ts
│   ├── pages/
│   │   ├── Dashboard.tsx         # KPI 4개 + 미니캘린더 + 오늘 일정/투두
│   │   ├── MemoPage.tsx          # 메모 입력 → AI 파싱 → 승인/거부 → Supabase 저장
│   │   ├── ClientsPage.tsx       # 테이블 + 우측 상세 패널, 사업자등록증 OCR
│   │   ├── ProjectsPage.tsx      # 프로젝트 카드 + 마일스톤 체크
│   │   ├── CalendarPage.tsx      # FullCalendar 월간/주간
│   │   ├── TodosPage.tsx         # 기한초과/오늘/예정/완료 섹션
│   │   ├── ContactsPage.tsx      # N-CRM 카드 그리드
│   │   └── LoginPage.tsx         # 이메일 로그인/회원가입
│   ├── types/index.ts            # 전체 TypeScript 타입
│   └── App.tsx                   # 라우팅 + Auth 가드
├── supabase/migrations/
│   ├── 001_initial_schema.sql    # 기본 테이블 + RLS
│   ├── 002_clients_extended.sql  # 거래처 확장 필드
│   ├── 003_clients_full.sql      # 거래처 전체 필드 + tax_office
│   ├── 004_project_types.sql     # 프로젝트 타입 제약 제거
│   ├── 005_client_code_trigger.sql # 거래처 코드 자동 채번 트리거 (CL-/IN-)
│   └── 006_activity_logs.sql     # 활동 로그 테이블 + 트리거
├── vercel.json                   # SPA rewrite 설정
└── .env                          # API 키 (gitignore)
```

---

## 5. DB 스키마 요약

### clients (거래처)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| code | text | 자동 채번 (CL-001 법인, IN-001 개인) |
| entity_type | text | 법인 / 개인 |
| client_type | text | 매출처 / 매입처 / 공통 |
| business_number | text | 사업자번호 |
| corp_number | text | 법인번호 |
| fss_number | text | 금감원 고유번호 |
| representative | text | 대표자 |
| established_date | date | 개업일 |
| fiscal_month | int | 결산월 |
| tax_office | text | 관할 세무서 |
| contract_date | date | 계약일 (기본값: 오늘) |
| service_category | text | 제공 용역 대분류 |
| service_detail | text | 상세분류 |
| tax_type | text | 과세유형 (일반과세/간이과세/면세/비사업자) |
| withholding_type | text | 원천세신고유형 |
| bank_name/account_number/account_holder | text | 계좌 정보 |
| address | text | 주소 |

### projects (프로젝트)
- type: string (세무대리/외부감사/컨설팅/자문/한공회/중회협/강의/기타)
- status: preparing / in_progress / review / completed
- milestones 별도 테이블 (cascade delete)

### activity_logs (활동 로그)
- action: created / updated / deleted / approved / rejected
- entity_type: client / project / memo / todo / calendar_event / contact
- DB 트리거로 clients, projects, memos 자동 기록

---

## 6. 주요 기능 구현 상태

| 기능 | 상태 | 비고 |
|------|------|------|
| 이메일 로그인/회원가입 | ✅ 완료 | 이메일 인증 안내 포함 |
| 메모 AI 파싱 | ✅ 완료 | Claude Sonnet, 2초 debounce, JSON 추출 안전처리 |
| 거래처 CRUD | ✅ 완료 | 탭 폼, OCR 사업자등록증, 코드 자동채번 |
| 거래처 상세 패널 | ✅ 완료 | 우측 슬라이드, 활동 로그 포함 |
| 프로젝트 CRUD | ✅ 완료 | 마일스톤 인라인 입력, 유형 8가지 |
| 캘린더 | ✅ 완료 | FullCalendar 월간/주간, 날짜 클릭 등록 |
| 투두 | ✅ 완료 | 기한초과/오늘/예정/완료 자동 분류 |
| N-CRM | ✅ 완료 | 카드 그리드, 태그, 거래처 연결 |
| 대시보드 | ✅ 완료 | KPI 4개, 미니캘린더, 오늘 일정/투두 |
| 활동 로그 | ✅ 완료 | DB 트리거, 거래처 상세 패널에 표시 |
| 모바일 반응형 | ✅ 완료 | 사이드바 토글, 콘텐츠 밀림 |
| FAB 메모 버튼 | ✅ 완료 | 우하단 인디고 연필 버튼 |
| Gemini OCR | ✅ 완료 | 사업자등록증 → 거래처 자동입력 |

---

## 7. 미완성 / 향후 작업

- [ ] Phase 2: 사전심리 탭, 세무대리 탭, 커뮤니케이션 탭
- [ ] Google Calendar MCP 연동
- [ ] D3.js 인맥 관계도 시각화
- [ ] 대시보드 최근 메모 히스토리 섹션
- [ ] Vercel + Supabase Cloud 배포
- [ ] 전체 연동 QA 테스트

---

## 8. 현재 이슈 / 주의사항

1. **Anthropic SDK 브라우저 경고** — `dangerouslyAllowBrowser: true` 사용 중. 프로덕션에서는 Supabase Edge Function으로 이전 권장
2. **번들 사이즈** — 500KB 초과 경고 있음. FullCalendar + Anthropic SDK 때문. code splitting 필요
3. **Gemini API 형식** — `@google/genai` SDK, contents는 `role/parts` 구조 사용
4. **Claude 응답 JSON 파싱** — `raw.match(/\{[\s\S]*\}/)` 로 코드블록 제거 후 파싱

---

## 9. 브랜드 / UI 규칙

- 브랜드명: **Noterp** (N 대문자, rp 소문자)
- 주 컬러: **indigo-600** (`#4f46e5`)
- 사이드바: 흰색 배경, 활성 메뉴 indigo-50
- 모달 저장 버튼: `bg-indigo-600`
- 거래처 메뉴명: **N-CRM**
- 프로젝트 유형: 세무대리/외부감사/컨설팅/자문/한공회/중회협/강의/기타

---

## 10. 2026-05-15 최근 작업 로그 / Claude 인수인계

### 작업 폴더
- 실제 본앱 위치: `C:\Users\User\Desktop\claude_noterp\noterp`
- 현재 IDE가 `noterp-agent`를 열고 있어도, Noterp 본앱은 위 폴더임.
- 최근 수정은 모두 본앱(`claude_noterp\noterp`) 기준으로 진행됨.

### 최근 완료된 UI/기능 수정
- 모바일 하단 메뉴 수정
  - `src/components/layout/BottomNav.tsx`
  - 모바일 하단 메뉴에서 `메모` 제거.
  - `N-CRM` 추가.
  - 검토 필요 항목(`needs_review=true`)이 있으면 거래처/프로젝트/N-CRM에 빨간 점 표시.
- 모바일 헤더 수정
  - `src/components/layout/Header.tsx`
  - 모바일에서 햄버거 버튼 숨김.
  - 모바일에서는 헤더가 고정되지 않도록 `lg:sticky`로 변경.
- 전역 메모 FAB 수정
  - `src/components/ui/MemoFab.tsx`
  - PC와 모바일 모두에서 메모 버튼 표시.
  - 모바일 하단 메뉴와 겹치지 않도록 `bottom-20`, 데스크톱은 `lg:bottom-6`.
- 프로젝트 탭 검색/필터 추가
  - `src/pages/ProjectsPage.tsx`
  - 프로젝트명/메모 검색, 거래처별 필터, 기간별 필터, 초기화 버튼 추가.
  - 프로젝트 상세 펼침 시 `프로젝트 메모` 표와 `타임라인` 영역 표시.

### 메모 저장 로직 관련 최근 수정
- 주요 파일: `src/pages/MemoPage.tsx`
- 중복 거래처 생성 문제를 줄이도록 수정함.
  - 기존에는 AI가 `clients`로 추출한 이름을 모두 거래처 후보로 넣어서 메모를 쓸 때마다 거래처가 생겼음.
  - 이제 `#거래처명`으로 명시한 경우 또는 일정/프로젝트에 참조된 거래처만 연결 대상으로 봄.
  - 기존 거래처가 있으면 새로 만들지 않고, 해당 거래처 `memo`와 `activity_logs`에 `memo_linked` 로그만 남김.
  - 새 거래처는 `#새거래처`를 명시했고 기존에 없을 때만 `needs_review=true`, `source='memo'`, `code=null`로 생성.
- 이름 정규화 수정
  - `src/lib/memoShortcuts.ts`
  - `[중소회계법인협의회]`, `중소회계법인협의회`처럼 괄호/공백/기호 차이가 있어도 같은 이름으로 매칭되도록 `normalizeMemoName()` 개선.
- 프로젝트 메모/타임라인 자동 반영
  - `/프로젝트명`으로 연결된 기존 프로젝트가 있으면 프로젝트 `memo`에 기록.
  - 날짜가 있으면 해당 프로젝트에 마일스톤을 자동 생성하도록 `ensureMilestone()` 추가.
  - 새 프로젝트는 `/새프로젝트`를 명시했고 기존에 없을 때만 `needs_review=true`, `source='memo'`로 생성.

### 거래처 코드/검토 알림 관련 수정
- 화면 표시
  - `src/pages/ClientsPage.tsx`
  - `src/components/clients/ClientDetailPanel.tsx`
  - `needs_review=true` 또는 `source='memo'` 거래처는 화면에서 코드 대신 `-` 표시.
  - 검토 필요 거래처명 옆에 빨간 점 표시.
- 리뷰 배지 훅
  - `src/hooks/useReviewBadges.ts`
  - Supabase 쿼리 에러를 throw하도록 수정해 오류가 조용히 묻히지 않게 함.
- 로그 포맷
  - `src/hooks/useLogs.ts`
  - `memo_linked` 액션 표시 추가: `거래처 "..."에 메모 연결: ...`.

### 새로 추가한 Supabase 마이그레이션
- `supabase/migrations/011_memo_review_code_and_logs.sql`
- 목적
  - `clients/projects/contacts`에 `needs_review`, `source` 컬럼 보장.
  - 기존 `needs_review=true` 또는 `source='memo'` 거래처의 `code`를 `null`로 정리.
  - `auto_generate_client_code()` 트리거를 교체해서 `needs_review=true` 또는 `source='memo'`이면 코드가 자동 채번되지 않도록 함.
  - 코드 채번 시 `entity_type = '법인'`이면 `CL`, 그 외는 `IN`.
- 중요
  - 이 SQL은 아직 사용자가 Supabase에 반영했다고 확인하지 않음.
  - Supabase SQL Editor에서 반드시 실행해야 빨간 알림/코드 미부여가 DB에서도 정상 작동함.

### 현재 주의사항 / 아직 남은 이슈
- 기존 DB에 이미 생긴 중복 거래처는 자동 삭제하지 않았음.
  - 예: `[중소회계법인협의회]`, `네일블린` 중복 등.
  - 삭제/병합은 데이터 손실 위험이 있어 수동 확인 필요.
- `source='memo'` 또는 `needs_review=true`인데 이미 코드가 붙은 기존 거래처는 011 SQL 실행 후 `code=null`로 정리됨.
- `activity_logs`에 `memo_linked` 액션을 앱에서 직접 insert함.
  - RLS 정책상 `auth.uid() = user_id`면 insert 가능해야 함.
  - 만약 로그가 안 남으면 `activity_logs` RLS/policy 확인 필요.
- 프로젝트 타임라인은 현재 `milestones` 기반임.
  - AI가 “도식화”까지 자동으로 풍부하게 해주는 수준은 아직 아님.
  - 현재는 메모에서 날짜/프로젝트/내용을 바탕으로 마일스톤 1개를 자동 생성하는 단계.
  - 더 고도화하려면 Claude 파싱 결과에 `timeline_items` 또는 `milestones` 구조를 추가하는 것이 좋음.
- 일부 기존 파일은 한글 인코딩이 깨져 있었음.
  - 최근 손댄 파일 일부는 깨끗한 UTF-8 한글로 복구됨.
  - 아직 `Sidebar.tsx`, `Layout.tsx`, `claude.ts`, 일부 migration 등은 깨진 한글이 남아 있을 수 있음.

### 검증 결과
- 마지막 빌드 명령:
  - `& "C:\Program Files\nodejs\npm.cmd" run build`
- 결과:
  - TypeScript/Vite 빌드 통과.
  - 기존 경고만 남음: Anthropic SDK의 browser externalized 경고, 번들 500KB 초과 경고.

### 다음 Claude에게 요청할 추천 작업
1. Supabase SQL Editor에 `011_memo_review_code_and_logs.sql` 실행 여부 확인.
2. 기존 중복 거래처 병합/삭제 UI 또는 SQL 정리 방안 제안.
3. 프로젝트 타임라인 고도화:
   - `ParsedResult.projects`에 `milestones` 배열 또는 `timeline_items` 필드 추가.
   - Claude prompt(`src/lib/claude.ts`)와 타입(`src/types/index.ts`) 확장.
   - 메모 승인 시 여러 마일스톤 자동 생성.
4. 깨진 한글 파일 정리:
   - `Sidebar.tsx`, `Layout.tsx`, `MemoInput.tsx`, `claude.ts`, migration 주석 등.
5. 배포 전 확인:
   - DB 마이그레이션 적용 후 빌드/실사용 테스트.
   - 그 다음 Vercel 배포.
