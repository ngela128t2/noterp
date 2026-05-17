import Anthropic from 'npm:@anthropic-ai/sdk'
import { getUserFromRequest, logTokenUsage, checkRateLimit } from '../_shared/usage.ts'
import { corsHeaders as buildCors, errResp as buildErrResp, getAllowedOrigin } from '../_shared/common.ts'

const MAX_ITEMS_SIZE = 8_000  // items 텍스트 최대 8KB
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
    const { contextName, contextType, items } = await req.json()

    if (typeof items !== 'string' || items.length > MAX_ITEMS_SIZE) {
      return errResp('size_limit', '요약할 항목이 너무 많습니다.', 413)
    }

    const user = await getUserFromRequest(req).catch(() => null)
    if (!user) return errResp('auth', '로그인이 필요합니다.', 401)
    const rateLimited = await checkRateLimit(user.id, RATE_LIMIT, RATE_WINDOW_SEC)
    if (rateLimited) return errResp('rate_limit', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429)

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
    const MODEL = 'claude-haiku-4-5-20251001'

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: `회계법인 업무 비서. ${contextType === 'client' ? '거래처' : '프로젝트'} "${contextName}"의 업무 흐름을 4~6개 항목으로 복원하세요.\n각 항목 앞에 반드시 아래 마커 중 하나를 붙이세요:\n  [Done]        완료된 일\n  [In Progress] 현재 진행·예정 중인 일\n  [Pending]     아직 시작 안 됨·미확정·follow-up 필요\n형식: "[마커] 한 줄 행동 중심 텍스트"`,
      messages: [{ role: 'user', content: `최근 활동 (최신순):\n${items}` }],
    })

    if (message.usage) {
      logTokenUsage({
        userId: user.id,
        email: user.email,
        provider: 'anthropic',
        model: MODEL,
        feature: 'workspace_summary',
        inputTokens: message.usage.input_tokens ?? 0,
        outputTokens: message.usage.output_tokens ?? 0,
        metadata: { context_type: contextType },
      }).catch(err => console.error('[workspace-summary] usage log fail:', err))
    }

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response')

    return new Response(JSON.stringify({ text: content.text.trim() }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[workspace-summary] error:', err)
    return errResp('claude_api', 'AI 요약 생성 중 오류가 발생했습니다.')
  }
})
