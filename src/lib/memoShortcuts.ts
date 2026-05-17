export type MemoShortcutHints = {
  clients: string[]
  projects: string[]
  dates: string[]
  times: string[]
  priorities: Array<'high' | 'medium' | 'low'>
  people: string[]        // @이름 형식의 담당자/연락처
  scheduleItems: string[] // * 로 시작하는 개별 일정 항목
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

export function normalizeTimeToken(token: string) {
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

// @이름 에서 날짜/시간 키워드를 제외하기 위한 집합
const AT_DATE_WORDS = new Set([
  '오늘', '내일', '모레',
  '이번', '다음', '이번주', '다음주',
  '오전', '오후',
  '월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일',
  '월', '화', '수', '목', '금', '토', '일',
])

export function parseMemoShortcuts(text: string): MemoShortcutHints {
  const clients = [
    ...Array.from(text.matchAll(/#\[([^\]]+)\]/g), match => match[1]),
    ...Array.from(text.matchAll(/#([^\s/@#!*]+)/g), match => match[1]),
    ...Array.from(text.matchAll(/\/거래처\s*([^\n/@#!*]+)/g), match => match[1]),
  ]

  const projects = [
    ...Array.from(text.matchAll(/\/\[([^\]]+)\]/g), match => match[1]),
    ...Array.from(text.matchAll(/\/프로젝트:\s*([^\n/@#!*]+)/g), match => match[1]),
    ...Array.from(text.matchAll(/\/([^\s/@#!*]+)/g), match => match[1]),
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

  // @이름: 날짜/시간 키워드가 아닌 2~5자 한글 이름
  const people = Array.from(
    text.matchAll(/@([가-힣]{2,5})/g),
    match => match[1],
  ).filter(name => !AT_DATE_WORDS.has(name) && !AT_DATE_WORDS.has(name.slice(0, 2)))

  // * 로 시작하는 개별 일정 항목
  const scheduleItems = Array.from(
    text.matchAll(/^\*[ \t]+(.+)$/gm),
    match => match[1].trim(),
  ).filter(Boolean)

  return {
    clients: unique(clients),
    projects: unique(projects),
    dates: unique(dateTokens.map(normalizeDateToken)),
    times: unique(timeTokens.map(normalizeTimeToken)),
    priorities: Array.from(new Set(priorities)),
    people: unique(people),
    scheduleItems,
  }
}

export function hasMemoShortcuts(hints: MemoShortcutHints) {
  return hints.clients.length > 0 || hints.projects.length > 0 || hints.dates.length > 0 || hints.times.length > 0 || hints.priorities.length > 0 || hints.people.length > 0 || hints.scheduleItems.length > 0
}

export function formatShortcutHints(hints: MemoShortcutHints) {
  return [
    hints.clients.length ? `거래처: ${hints.clients.join(', ')}` : null,
    hints.projects.length ? `프로젝트: ${hints.projects.join(', ')}` : null,
    hints.dates.length ? `날짜: ${hints.dates.join(', ')}` : null,
    hints.times.length ? `시간: ${hints.times.join(', ')}` : null,
    hints.priorities.length ? `우선순위: ${hints.priorities.join(', ')}` : null,
    hints.people.length ? `담당자/연락처: ${hints.people.join(', ')}` : null,
    hints.scheduleItems.length ? `일정항목:\n${hints.scheduleItems.map(s => `- ${s}`).join('\n')}` : null,
  ].filter(Boolean).join('\n')
}

// 거래처명 끝의 호칭 (있어도/없어도 동일 거래처로 매칭되도록 정규화 시 제거)
const HONORIFIC_SUFFIX_RE = /\s*(대표님|대표|사장님|사장|회장님|회장|부장님|부장|과장님|과장|차장님|차장|이사님|이사|대리님|대리|주임님|주임|팀장님|팀장|실장님|실장|원장님|원장|선생님|선생)\s*$/

// 거래처명 끝의 일반 법인 접미사 (㈜/주식회사 등)
const LEGAL_SUFFIX_RE = /(㈜|\(주\)|\(유\)|주식회사|유한회사|유한책임회사|합자회사|합명회사|법인)\s*$/

export function normalizeMemoName(value: string) {
  if (!value) return ''
  let v = value
    .replace(/[\[\]【】()（）{}]/g, '')

  // 호칭/법인 접미사를 반복적으로 제거 (예: "미분당 강남구청역점 대표님" → "미분당 강남구청역점")
  for (let i = 0; i < 3; i++) {
    const before = v
    v = v.replace(HONORIFIC_SUFFIX_RE, '').replace(LEGAL_SUFFIX_RE, '')
    if (v === before) break
  }

  return v
    .replace(/[\s·ㆍ,._-]+/g, '')
    .toLowerCase()
}
