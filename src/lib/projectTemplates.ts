// 회계법인 업무 유형별 프로젝트 템플릿
// DB 저장 없이 TypeScript 상수로 관리 — 사용자 정의 템플릿은 추후 확장

export interface TemplateStage {
  title: string
  offset_days: number   // start_date 기준 경과일
}

export interface TemplateTask {
  title: string
  priority: 'high' | 'medium' | 'low'
  offset_days: number
}

export interface ProjectTemplate {
  id: string
  name: string
  type: string
  type_detail: string
  description: string
  color: string         // Tailwind bg class
  duration_days: number
  stages: TemplateStage[]
  tasks: TemplateTask[]
}

// ── 날짜 유틸 ─────────────────────────────────────────────────────────

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function shiftYear(dateStr: string, years: number): string {
  if (!dateStr) return dateStr
  const d = new Date(dateStr + 'T00:00:00')
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().split('T')[0]
}

// ── 템플릿에서 마일스톤 생성 ──────────────────────────────────────────

export function generateMilestones(
  template: ProjectTemplate,
  startDate: string,
): { title: string; due_date: string }[] {
  return template.stages.map(stage => ({
    title: stage.title,
    due_date: addDays(startDate, stage.offset_days),
  }))
}

// ── 내장 템플릿 정의 ──────────────────────────────────────────────────

export const BUILTIN_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'corporate-tax',
    name: '법인세 신고',
    type: '세무대리',
    type_detail: '신고대리',
    description: '법인세 신고 전 과정 — 자료 수집부터 신고 완료까지',
    color: 'bg-blue-500',
    duration_days: 90,
    stages: [
      { title: '자료 요청서 발송', offset_days: 0 },
      { title: '세무조정 자료 수집 마감', offset_days: 30 },
      { title: '세무조정계산서 작성', offset_days: 50 },
      { title: '세무조정계산서 검토', offset_days: 65 },
      { title: '신고서 최종 확인', offset_days: 80 },
      { title: '법인세 신고 완료', offset_days: 90 },
    ],
    tasks: [
      { title: '재무제표 수령 확인', priority: 'high', offset_days: 5 },
      { title: '퇴직급여충당금 검토', priority: 'medium', offset_days: 20 },
      { title: '세무조정 항목 검토', priority: 'high', offset_days: 55 },
      { title: '신고서 서명 확인', priority: 'high', offset_days: 85 },
    ],
  },
  {
    id: 'external-audit',
    name: '외부감사',
    type: '외부감사',
    type_detail: '법정감사',
    description: '연간 외부감사 전 과정 — 계획 수립부터 감사보고서 확정까지',
    color: 'bg-purple-500',
    duration_days: 180,
    stages: [
      { title: '감사계획 수립', offset_days: 0 },
      { title: '예비조사 완료', offset_days: 30 },
      { title: '중간감사 실시', offset_days: 90 },
      { title: '기말감사 실시', offset_days: 150 },
      { title: '감사보고서 초안 작성', offset_days: 165 },
      { title: '감사보고서 확정', offset_days: 180 },
    ],
    tasks: [
      { title: '감사계획서 검토', priority: 'high', offset_days: 5 },
      { title: '내부통제 평가', priority: 'medium', offset_days: 60 },
      { title: '중요 계정 분석', priority: 'high', offset_days: 100 },
      { title: '감사보고서 서명 확인', priority: 'high', offset_days: 175 },
    ],
  },
  {
    id: 'interim-audit',
    name: '중간감사',
    type: '외부감사',
    type_detail: '법정감사',
    description: '반기 중간감사 — 계획부터 보고까지',
    color: 'bg-indigo-500',
    duration_days: 30,
    stages: [
      { title: '중간감사 계획 수립', offset_days: 0 },
      { title: '현장 감사 실시', offset_days: 10 },
      { title: '감사 결과 검토', offset_days: 20 },
      { title: '중간감사 보고서 완료', offset_days: 30 },
    ],
    tasks: [
      { title: '감사 체크리스트 준비', priority: 'high', offset_days: 2 },
      { title: '현장 감사 현황 점검', priority: 'medium', offset_days: 15 },
    ],
  },
  {
    id: 'vat-return',
    name: '부가세 신고',
    type: '세무대리',
    type_detail: '신고대리',
    description: '분기/반기 부가세 신고 — 자료 수집부터 신고 완료까지',
    color: 'bg-emerald-500',
    duration_days: 25,
    stages: [
      { title: '매입/매출 자료 요청', offset_days: 0 },
      { title: '자료 수집 마감', offset_days: 15 },
      { title: '신고서 작성 완료', offset_days: 20 },
      { title: '부가세 신고 완료', offset_days: 25 },
    ],
    tasks: [
      { title: '세금계산서 누락 여부 확인', priority: 'high', offset_days: 10 },
      { title: '신고서 최종 검토', priority: 'high', offset_days: 22 },
    ],
  },
  {
    id: 'income-tax',
    name: '종합소득세 신고',
    type: '세무대리',
    type_detail: '신고대리',
    description: '개인 종합소득세 신고 — 수입 자료 수집부터 신고 완료까지',
    color: 'bg-amber-500',
    duration_days: 60,
    stages: [
      { title: '소득 자료 요청', offset_days: 0 },
      { title: '수입 자료 수집 마감', offset_days: 20 },
      { title: '신고서 작성 완료', offset_days: 40 },
      { title: '신고서 최종 검토', offset_days: 55 },
      { title: '종합소득세 신고 완료', offset_days: 60 },
    ],
    tasks: [
      { title: '근로/사업소득 자료 취합', priority: 'high', offset_days: 5 },
      { title: '공제 항목 검토', priority: 'medium', offset_days: 30 },
      { title: '신고서 서명 확인', priority: 'high', offset_days: 58 },
    ],
  },
  {
    id: 'tax-audit',
    name: '세무조사 대응',
    type: '세무대리',
    type_detail: '기타',
    description: '세무조사 통지부터 처리 완료까지 전 과정 대응',
    color: 'bg-red-500',
    duration_days: 60,
    stages: [
      { title: '조사통지 접수 및 검토', offset_days: 0 },
      { title: '자료 준비 완료', offset_days: 7 },
      { title: '현장 조사 대응', offset_days: 14 },
      { title: '추가 자료 제출', offset_days: 30 },
      { title: '결과 검토 및 이의제기 검토', offset_days: 50 },
      { title: '세무조사 처리 완료', offset_days: 60 },
    ],
    tasks: [
      { title: '조사 항목 사전 파악', priority: 'high', offset_days: 2 },
      { title: '관련 계정 자료 정리', priority: 'high', offset_days: 5 },
      { title: '이의제기 여부 검토', priority: 'medium', offset_days: 45 },
    ],
  },
]

// 이름 + 연도로 프로젝트명 자동 생성
export function buildProjectName(
  clientName: string,
  templateName: string,
  startDate: string,
): string {
  const year = startDate ? new Date(startDate + 'T00:00:00').getFullYear() : new Date().getFullYear()
  return `${clientName} ${templateName} ${year}`
}
