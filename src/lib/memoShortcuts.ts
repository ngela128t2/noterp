export type MemoShortcutHints = {
  clients: string[]
  projects: string[]
  dates: string[]
  times: string[]
  priorities: Array<'high' | 'medium' | 'low'>
}

const RELATIVE_DAYS: Record<string, number> = { 오늘: 0, 내일: 1, 모레: 2 }
const WEEKDAYS: Record<string, number> = {
  일: 0, 일요일: 0,
  월: 1, 월요일: 1,
  화: 2, 화요일: 2,
  수: 3, 수요일: 3,
  목: 4, 목요일: 4,
  금: 5, 금요일: 5,
  토: 6, 토요일: 6,
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeekDate(weekLabel: string, weekdayLabel: string) {
  const today = new Date()
  const todayDay = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() + (todayDay === 0 ? -6 : 1 - todayDay))

  const target = new Date(monday)
  const weekday = WEEKDAYS[weekdayLabel]
  const offsetFromMonday = weekday === 0 ? 6 : weekday - 1
  target.setDate(monday.getDate() + offsetFromMonday + (weekLabel.replace(/\s/g, '') === '다음주' ? 7 : 0))
  return toDateString(target)
}

function normalizeDateToken(token: string) {
  const today = new Date()
  const trimmed = token.trim()

  if (trimmed in RELATIVE_DAYS) {
    const date = new Date(today)
    date.setDate(today.getDate() + RELATIVE_DAYS[trimmed])
    return toDateString(date)
  }

  const weekMatch = trimmed.match(/^(이번\s*주|다음\s*주)\s*(일요일|월요일|화요일|수요일|목요일|금요일|토요일|일|월|화|수|목|금|토)$/)
  if (weekMatch) return getWeekDate(weekMatch[1], weekMatch[2])

  // bare 요일 → 오늘 이후 가장 가까운 해당 요일
  if (trimmed in WEEKDAYS) {
    const targetDay = WEEKDAYS[trimmed]
    const todayDay = today.getDay()
    let daysAhead = targetDay - todayDay
    if (daysAhead <= 0) daysAhead += 7
    const date = new Date(today)
    date.setDate(today.getDate() + daysAhead)
    return toDateString(date)
  }

  const iso = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const monthDay = trimmed.match(/^(\d{1,2})[-./월\s](\d{1,2})일?$/)
  if (monthDay) return `${today.getFullYear()}-${monthDay[1].padStart(2, '0')}-${monthDay[2].padStart(2, '0')}`

  return trimmed
}

function normalizeTimeToken(token: string) {
  const trimmed = token.trim()
  const ampm = trimmed.match(/^(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분?)?$/)
  if (ampm) {
    let hour = Number(ampm[2])
    if (ampm[1] === '오후' && hour < 12) hour += 12
    if (ampm[1] === '오전' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${String(Number(ampm[3] ?? 0)).padStart(2, '0')}`
  }

  const korean = trimmed.match(/^(\d{1,2})시(?:\s*(\d{1,2})분?)?$/)
  if (korean) return `${String(Number(korean[1])).padStart(2, '0')}:${String(Number(korean[2] ?? 0)).padStart(2, '0')}`

  const clock = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (clock) return `${clock[1].padStart(2, '0')}:${clock[2]}`

  return trimmed
}

export function parseMemoShortcuts(text: string): MemoShortcutHints {
  const clients = [
    ...Array.from(text.matchAll(/#\[([^\]]+)\]/g), match => match[1]),
    ...Array.from(text.matchAll(/#([^\s/@#!]+)/g), match => match[1]),
    ...Array.from(text.matchAll(/\/거래처\s*([^\n/@#!]+)/g), match => match[1]),
  ]

  const projects = [
    ...Array.from(text.matchAll(/\/\[([^\]]+)\]/g), match => match[1]),
    ...Array.from(text.matchAll(/\/프로젝트:\s*([^\n/@#!]+)/g), match => match[1]),
    ...Array.from(text.matchAll(/\/([^\s/@#!]+)/g), match => match[1]),
  ].filter(value => !value.startsWith('거래처') && !value.startsWith('프로젝트:'))

  const dateTokens = [
    ...Array.from(text.matchAll(/@\[([^\]]+)\]/g), match => match[1]),
    ...Array.from(text.matchAll(/@(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./월\s]\d{1,2}일?|오늘|내일|모레|(이번\s*주|다음\s*주)\s*(?:일요일|월요일|화요일|수요일|목요일|금요일|토요일|일|월|화|수|목|금|토))/g), match => match[1]),
    // @ 없이도 날짜 표현 캡처
    ...Array.from(text.matchAll(/(오늘|내일|모레|(이번\s*주|다음\s*주)\s*(?:일요일|월요일|화요일|수요일|목요일|금요일|토요일|일|월|화|수|목|금|토))/g), match => match[1]),
    // bare 요일 (이번주/다음주 없이)
    ...Array.from(text.matchAll(/(?<![주\w])(일요일|월요일|화요일|수요일|목요일|금요일|토요일)/g), match => match[1]),
  ]

  const timeTokens = [
    ...Array.from(text.matchAll(/@(\d{1,2}:\d{2}|오전\s*\d{1,2}시(?:\s*\d{1,2}분?)?|오후\s*\d{1,2}시(?:\s*\d{1,2}분?)?|\d{1,2}시(?:\s*\d{1,2}분?)?)/g), match => match[1]),
    ...Array.from(text.matchAll(/(오전\s*\d{1,2}시(?:\s*\d{1,2}분?)?|오후\s*\d{1,2}시(?:\s*\d{1,2}분?)?|\d{1,2}시(?:\s*\d{1,2}분?)?|\d{1,2}:\d{2})/g), match => match[1]),
  ]

  const priorities: MemoShortcutHints['priorities'] = []
  if (/[!！](높음|긴급|중요|high)/i.test(text)) priorities.push('high')
  if (/[!！](보통|medium)/i.test(text)) priorities.push('medium')
  if (/[!！](낮음|low)/i.test(text)) priorities.push('low')

  return {
    clients: unique(clients),
    projects: unique(projects),
    dates: unique(dateTokens.map(normalizeDateToken)),
    times: unique(timeTokens.map(normalizeTimeToken)),
    priorities: Array.from(new Set(priorities)),
  }
}

export function hasMemoShortcuts(hints: MemoShortcutHints) {
  return hints.clients.length > 0 || hints.projects.length > 0 || hints.dates.length > 0 || hints.times.length > 0 || hints.priorities.length > 0
}

export function formatShortcutHints(hints: MemoShortcutHints) {
  return [
    hints.clients.length ? `거래처: ${hints.clients.join(', ')}` : null,
    hints.projects.length ? `프로젝트: ${hints.projects.join(', ')}` : null,
    hints.dates.length ? `날짜: ${hints.dates.join(', ')}` : null,
    hints.times.length ? `시간: ${hints.times.join(', ')}` : null,
    hints.priorities.length ? `우선순위: ${hints.priorities.join(', ')}` : null,
  ].filter(Boolean).join('\n')
}

export function normalizeMemoName(value: string) {
  return value
    .replace(/[\[\]【】()（）{}]/g, '')
    .replace(/[\s·ㆍ,._-]+/g, '')
    .toLowerCase()
}
