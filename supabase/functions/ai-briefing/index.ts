import Anthropic from 'npm:@anthropic-ai/sdk'
import { getUserFromRequest, logTokenUsage, checkRateLimit } from '../_shared/usage.ts'
import { corsHeaders as buildCors, errResp as buildErrResp, getAllowedOrigin } from '../_shared/common.ts'

const MAX_EVENTS = 100
const RATE_LIMIT = 20
const RATE_WINDOW_SEC = 60

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin') ?? ''
  const allowOrigin = getAllowedOrigin(origin)
  const headers = buildCors(allowOrigin)
  const errResp = (step: string, message: string, status = 500) =>
    buildErrResp(headers, step, message, status)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const { date, todayEvents, weekEventCount, overdueCount, pendingCount, deadlineCount } = await req.json()

    if (!Array.isArray(todayEvents) || todayEvents.length > MAX_EVENTS) {
      return errResp('size_limit', '입력 데이터가 너무 큽니다.', 400)
    }

    const user = await getUserFromRequest(req).catch(() => null)
    if (!user) return errResp('auth', '로그인이 필요합니다.', 401)
    const rateLimited = await checkRateLimit(user.id, RATE_LIMIT, RATE_WINDOW_SEC)
    if (rateLimited) return errResp('rate_limit', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429)

    const eventsText = todayEvents.length > 0
      ? todayEvents.map((e: any) => `${e.time ? e.time.slice(0, 5) + ' ' : ''}${e.title}${e.clientName ? `(${e.clientName})` : ''}`).join(', ')
      : '없음'

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
    const MODEL = 'claude-haiku-4-5-20251001'

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `오늘(${date}) 업무 현황:
- 오늘 일정: ${todayEvents.length}건 — ${eventsText}
- 이번 주 총 일정: ${weekEventCount}건
- 미완료 할 일: ${pendingCount}건
- 연체/긴급: ${overdueCount}건
- 마감 임박: ${deadlineCount}건

위 현황을 업무 비서처럼 4~6개 항목으로 분류하세요.
각 항목 앞에 반드시 아래 3가지 마커 중 하나를 붙이세요:
  [Done]        완료된 일
  [In Progress] 현재 진행·예정 중인 일
  [Pending]     아직 시작 안 됨·미확정·follow-up 필요
형식: "[마커] 한 줄 행동 중심 텍스트"`,
      }],
    })

    if (message.usage) {
      logTokenUsage({
        userId: user.id,
        email: user.email,
        provider: 'anthropic',
        model: MODEL,
        feature: 'today_briefing',
        inputTokens: message.usage.input_tokens ?? 0,
        outputTokens: message.usage.output_tokens ?? 0,
      }).catch(err => console.error('[ai-briefing] usage log fail:', err))
    }

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response')

    return new Response(JSON.stringify({ text: content.text.trim() }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[ai-briefing] error:', err)
    return errResp('claude_api', 'AI 브리핑 생성 중 오류가 발생했습니다.')
  }
})
