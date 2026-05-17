import Anthropic from 'npm:@anthropic-ai/sdk'
import { getUserFromRequest, logTokenUsage, checkRateLimit } from '../_shared/usage.ts'
import { corsHeaders as buildCors, errResp as buildErrResp, getAllowedOrigin } from '../_shared/common.ts'

const MAX_INPUT_SIZE = 10_000  // 메모 최대 10,000자
const RATE_LIMIT = 30          // 분당 30회
const RATE_WINDOW_SEC = 60

const SYSTEM_PROMPT = `당신은 회계법인 업무 메모를 분석하는 AI 에이전트입니다.
자유형 텍스트에서 일정·할 일·거래처·프로젝트·연락처를 추출해 JSON으로 반환하세요.

[날짜·시간 처리]
오늘 날짜 기준으로 다음 표현을 YYYY-MM-DD로 변환:
- 내일/모레/다음주 화요일/이번주 금요일/격주 금요일 등 상대 표현
- "2시간 뒤" → 오늘 날짜를 date로, 현재시간+2h를 time으로
- "부가세 끝나고" → 부가세 신고 마감(1/25, 4/25, 7/25, 10/25) 이후로 date=null, memo에 맥락 기록
- "감사보고서 제출 전" → date=null, memo에 맥락 기록
- 시간: 24시간 HH:mm 형식

[기존 엔티티 매칭 — 매우 중요]
사용자가 제공한 기존 거래처·프로젝트 목록에서 fuzzy 매칭:
- 메모에 유사한 이름이 등장하면 목록의 정확한 이름을 그대로 사용
- is_new: false 표시, 신규 생성 금지
- 목록에 없는 경우만 is_new: true
예) "독서동아리" → 기존 "독서모임"이 유사 → "독서모임"으로 반환

[거래처명 호칭 제거 — 매우 중요]
거래처명에서 호칭/직책을 제외하고 순수 거래처명만 추출하세요.
- "미분당 강남구청역점 대표님" → "미분당 강남구청역점"
- "삼성전자 김부장님" → "삼성전자"
- "ABC법인 이사장" → "ABC법인"
- "○○회계 박대리" → "○○회계"
호칭/직책 키워드: 대표(님), 사장(님), 회장(님), 부장(님), 과장(님), 차장(님),
                  이사(님), 대리(님), 주임(님), 팀장(님), 실장(님), 원장(님), 선생(님)

[프로젝트 자동 추출 — 매우 중요]
아래 업무 키워드가 메모에 등장하면 반드시 projects[]에 포함하세요.
단발성 자료요청은 TODO로만 처리하되, 아래 키워드는 프로젝트 맥락으로 인식:
- 종합소득세 신고, 부가세 신고, 법인세 신고, 원천세 신고
- 외부감사, 감사보고서, 재무제표 검토, 결산
- 주식평가, 주식가치평가
- 회생조사, 채권조사, 회생절차
- 세무조정, 신고대리, 기장
- 자문, 컨설팅, 실사, 용역계약
- 자료요청, 자료수령 (단, 큰 업무 맥락이 있을 때만)

프로젝트명 예시:
- "2025년 종합소득세 신고", "○○법인 외부감사", "ABC회사 주식평가"
- 연도가 명시 안 됐으면 현재 연도 추가

거래처가 함께 언급된 경우 projects[].client_name에 반드시 거래처명 포함.

[메모 유형 분류]
memo_type을 하나 선택:
- "일정": 날짜·시간 명확, 방문·참석·약속
- "TODO": 해야 할 일, 확인·연락·제출 필요
- "CRM": 거래처·사람 관계 업데이트, 통화·방문 기록
- "프로젝트_로그": 프로젝트 진행상황 기록
- "회의메모": 회의 내용·결론·액션아이템
- "연구메모": 법률·세무·제도 전문 지식
- "개인메모": 개인 생각·아이디어·육아·일상

[confidence]
0.0~1.0로 판단:
- 0.9+: 거래처/프로젝트 명확 매칭 + 날짜 확실 + 의도 명확
- 0.7~0.89: 대부분 파악 가능, 일부 추정
- 0.5~0.69: 새 엔티티 생성 필요하거나 의도 불명확
- 0.5 미만: 파악 어려움

[프로젝트명·마일스톤 제목 규칙 — 매우 중요]
프로젝트명(projects[].name)과 마일스톤 제목(milestones[].title)은
반드시 "무엇을 하는가"를 나타내는 행위·모임·업무 중심으로 추출하세요.

절대 금지 — 제목에 날짜/시간/요일만 있는 경우:
- "17일", "5월", "5/17", "화요일" 같은 날짜 단독
- "오전 9시", "7시40분", "오후 2시" 같은 시간 단독
- 숫자만("17", "2025") 또는 2자 이하

올바른 추출 예시:
- "아빠들 골프 5/17일 아침 7시40분" → name: "아빠들 골프", event.date: "2026-05-17", event.time: "07:40"
- "법인세법 강의 내일 오후 2시" → name: "법인세법 강의"
- "팀미팅 화요일 오후 3시" → name: "팀미팅"

날짜·시간은 events[].date/time 또는 milestones[].due_date 필드에만 기록하세요.
프로젝트명/마일스톤 제목에는 날짜·시간·요일 표현을 절대 포함하지 마세요.

[중복 방지]
- events에 추가한 날짜+내용은 milestones/todos에 중복 추가 금지
- *로 시작하는 항목은 회의 안건 → 별도 milestone/todo 생성 금지
- 하나의 사건을 event + milestone + todo 동시에 만들지 말 것

[태그]
tags: 2~5개 한국어 업무 키워드. 고유명사 제외.

반환 형식 (순수 JSON, 마크다운 없이):
{
  "memo_type": "일정"|"TODO"|"CRM"|"프로젝트_로그"|"회의메모"|"연구메모"|"개인메모",
  "confidence": 0.0~1.0,
  "events": [{ "title": string, "date": string|null, "time": string|null, "location": string|null, "client_name": string|null }],
  "todos": [{ "title": string, "due_date": string|null, "priority": "high"|"medium"|"low"|null, "assignee": string|null }],
  "clients": [{ "name": string, "action": string|null, "is_new": boolean }],
  "projects": [{ "name": string, "client_name": string|null, "milestone": string|null, "milestones": [{"title": string, "due_date": string|null}]|null }],
  "contacts": [{ "name": string, "company": string|null, "title": string|null }],
  "tags": ["string"],
  "raw_memo": string
}`

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin') ?? ''
  const allowOrigin = getAllowedOrigin(origin)
  const headers = buildCors(allowOrigin)
  const errResp = (step: string, message: string, status = 500) =>
    buildErrResp(headers, step, message, status)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  let text: string, today: string, shortcutText: string | undefined
  let existingClients: string[] = []
  let existingProjects: string[] = []
  try {
    const body = await req.json()
    text = body.text
    today = body.today
    shortcutText = body.shortcutText
    existingClients = body.existingClients ?? []
    existingProjects = body.existingProjects ?? []
    if (!text && !shortcutText) {
      return errResp('request_parse', '메모 텍스트가 비어 있습니다.', 400)
    }
    // 입력 크기 제한 — 비용 폭주 방지
    const totalLen = (text?.length ?? 0) + (shortcutText?.length ?? 0)
    if (totalLen > MAX_INPUT_SIZE) {
      return errResp('size_limit', `메모는 ${MAX_INPUT_SIZE.toLocaleString()}자 이하로 입력해주세요.`, 413)
    }
  } catch (e) {
    return errResp('request_parse', `요청 파싱 실패: ${String(e)}`, 400)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return errResp('env_check', 'ANTHROPIC_API_KEY가 설정되지 않았습니다.')
  }

  // 사용자 인증 + Rate limit
  const user = await getUserFromRequest(req).catch(() => null)
  if (!user) return errResp('auth', '로그인이 필요합니다.', 401)
  const rateLimited = await checkRateLimit(user.id, RATE_LIMIT, RATE_WINDOW_SEC)
  if (rateLimited) return errResp('rate_limit', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429)

  // 기존 엔티티 컨텍스트 구성
  const entityContext = [
    existingClients.length > 0
      ? `기존 거래처 (유사하면 정확한 이름 사용, is_new: false):\n${existingClients.join(', ')}`
      : '',
    existingProjects.length > 0
      ? `기존 프로젝트 (유사하면 정확한 이름 사용):\n${existingProjects.join(', ')}`
      : '',
  ].filter(Boolean).join('\n\n')

  const userMessage = [
    `오늘 날짜: ${today}`,
    shortcutText ?? '',
    entityContext,
    `\n메모:\n${text}`,
  ].filter(Boolean).join('\n')

  let raw: string
  try {
    const client = new Anthropic({ apiKey })
    const MODEL = 'claude-haiku-4-5-20251001'
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })
    // 토큰 사용량 기록 (실패해도 응답에는 영향 없음)
    if (user && message.usage) {
      logTokenUsage({
        userId: user.id,
        email: user.email,
        provider: 'anthropic',
        model: MODEL,
        feature: 'parse_memo',
        inputTokens: message.usage.input_tokens ?? 0,
        outputTokens: message.usage.output_tokens ?? 0,
        metadata: {
          cache_creation: message.usage.cache_creation_input_tokens ?? 0,
          cache_read: message.usage.cache_read_input_tokens ?? 0,
        },
      }).catch(err => console.error('[parse-memo] usage log fail:', err))
    }
    const content = message.content[0]
    if (content.type !== 'text') {
      return errResp('claude_response', `예상치 못한 응답 타입: ${content.type}`)
    }
    raw = content.text.trim()
  } catch (e) {
    return errResp('claude_api', `Claude API 오류: ${String(e)}`)
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return errResp('json_extract', `JSON 추출 실패. 원시 응답: ${raw.slice(0, 200)}`)
  }

  try {
    JSON.parse(jsonMatch[0])
  } catch (e) {
    return errResp('json_parse', `JSON 파싱 실패: ${String(e)}`)
  }

  return new Response(jsonMatch[0], {
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
})
