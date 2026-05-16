// 날짜 유틸 — 모든 날짜 연산은 로컬 시각 기준
//
// 왜 필요한가:
//   new Date().toISOString() → UTC 자정 기준 문자열
//   한국(UTC+9)에서 오전 9시 이전에 실행하면 전날 날짜 반환 → 캘린더/선택일 오차
//   모든 "오늘" 계산은 getLocalDate()를 사용할 것

/** 로컬 시각 기준 오늘 날짜 → "YYYY-MM-DD" */
export function getLocalDate(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** "YYYY-MM-DD" 문자열을 로컬 자정 Date로 파싱 (UTC 자정이 아님) */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 오늘 기준 N일 후/전 날짜 → "YYYY-MM-DD" (로컬) */
export function localDateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return getLocalDate(d)
}

/** "YYYY-MM-DD" → 한국어 표시 "5월 16일 (금)" */
export function formatLocalDate(dateStr: string): string {
  const DAYS = ['일', '월', '화', '수', '목', '금', '토']
  const d = parseLocalDate(dateStr)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`
}
