import Anthropic from '@anthropic-ai/sdk'
import type { ParsedResult } from '../types'
import { formatShortcutHints, hasMemoShortcuts, type MemoShortcutHints } from './memoShortcuts'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const SYSTEM_PROMPT = `당신은 회계법인의 업무 메모를 분석하는 AI 에이전트입니다.
입력된 자유형 텍스트에서 일정, 할 일, 거래처, 프로젝트, 연락처를 추출해 JSON으로 반환하세요.
오늘 날짜를 기준으로 상대 날짜와 요일 표현을 YYYY-MM-DD로 변환하세요.
시간 표현이 있으면 24시간 HH:mm 형식으로 변환하세요. 예: "오늘 2시에"는 오늘 날짜와 14:00이 아니라 문맥상 오전/오후가 불명확하면 02:00으로 두고, "오후 2시"는 14:00입니다.

빠른 입력 문법:
- /프로젝트명 은 프로젝트 힌트입니다.
- #거래처명 은 거래처 힌트입니다.
- @5/20, @오늘, 이번주 일요일 등은 날짜 힌트입니다.
- @홍길동, @이부장 등 한글 이름은 담당자/연락처 힌트입니다.
- 2시, 오후 2시, 14:30 등은 시간 힌트입니다.
- !높음, !보통, !낮음 은 할 일 우선순위 힌트입니다.
- * 로 시작하는 줄은 개별 일정 항목입니다. 각 항목을 별도 이벤트로 추출하세요.

빠른 입력 힌트가 있으면 일반 문장보다 우선해서 해석하세요.

반환 형식:
{
  "events": [{ "title": string, "date": string|null, "time": string|null, "location": string|null, "client_name": string|null }],
  "todos": [{ "title": string, "due_date": string|null, "priority": "high"|"medium"|"low"|null, "assignee": string|null }],
  "clients": [{ "name": string, "action": string|null, "is_new": boolean }],
  "projects": [{ "name": string, "client_name": string|null, "milestone": string|null, "milestones": [{"title": string, "due_date": string|null}]|null }],
  "contacts": [{ "name": string, "company": string|null, "title": string|null }],
  "raw_memo": string
}

프로젝트의 milestones는 메모에서 날짜/일정이 언급된 경우 배열로 추출하세요. 예: "5/20 감사보고서 제출, 6/1 최종 서명" → milestones: [{title:"감사보고서 제출", due_date:"2026-05-20"}, {title:"최종 서명", due_date:"2026-06-01"}].
JSON만 반환하고, 확실하지 않은 필드는 null로 설정하세요. 마크다운 코드블록 없이 순수 JSON만 반환하세요.`

export async function generateDailyBriefing(context: {
  date: string
  todayEvents: Array<{ title: string; time: string | null; clientName: string | null }>
  weekEventCount: number
  overdueCount: number
  pendingCount: number
  deadlineCount: number
}): Promise<string> {
  const eventsText = context.todayEvents.length > 0
    ? context.todayEvents.map(e => `${e.time ? e.time.slice(0, 5) + ' ' : ''}${e.title}${e.clientName ? `(${e.clientName})` : ''}`).join(', ')
    : '없음'

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `오늘(${context.date}) 업무 현황:
- 오늘 일정: ${context.todayEvents.length}건 — ${eventsText}
- 이번 주 총 일정: ${context.weekEventCount}건
- 미완료 할 일: ${context.pendingCount}건
- 연체/긴급: ${context.overdueCount}건
- 마감 임박: ${context.deadlineCount}건

위 현황을 업무 비서처럼 4~6개 항목으로 분류하세요.
각 항목 앞에 반드시 아래 3가지 마커 중 하나를 붙이세요:
  [Done]        완료된 일
  [In Progress] 현재 진행·예정 중인 일
  [Pending]     아직 시작 안 됨·미확정·follow-up 필요
형식: "[마커] 한 줄 행동 중심 텍스트"
예시: "[Done] 조사자료 v1 발송 완료", "[In Progress] 안진 미팅 오전 10시 예정", "[Pending] 네일블린 연락 일정 미확정"`,
    }],
  })
  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response')
  return content.text.trim()
}

export async function parseMemo(text: string, shortcuts?: MemoShortcutHints): Promise<ParsedResult> {
  const today = new Date().toISOString().split('T')[0]
  const shortcutText = shortcuts && hasMemoShortcuts(shortcuts)
    ? `\n\n빠른 입력 힌트:\n${formatShortcutHints(shortcuts)}\n\n위 힌트를 우선 적용해서 거래처명, 프로젝트명, 일정일자, 일정시간, 할 일 마감일을 해석하세요.`
    : ''

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `오늘 날짜: ${today}${shortcutText}\n\n메모:\n${text}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  const raw = content.text.trim()
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`JSON 추출 실패: ${raw.slice(0, 100)}`)

  return JSON.parse(jsonMatch[0]) as ParsedResult
}
