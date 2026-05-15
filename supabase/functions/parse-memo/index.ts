import Anthropic from 'npm:@anthropic-ai/sdk'

const SYSTEM_PROMPT = `당신은 회계법인의 업무 메모를 분석하는 AI 에이전트입니다.
입력된 자유형 텍스트에서 일정, 할 일, 거래처, 프로젝트, 연락처를 추출해 JSON으로 반환하세요.
오늘 날짜를 기준으로 상대 날짜와 요일 표현을 YYYY-MM-DD로 변환하세요.
시간 표현이 있으면 24시간 HH:mm 형식으로 변환하세요.

반환 형식:
{
  "events": [{ "title": string, "date": string|null, "time": string|null, "location": string|null, "client_name": string|null }],
  "todos": [{ "title": string, "due_date": string|null, "priority": "high"|"medium"|"low"|null, "assignee": string|null }],
  "clients": [{ "name": string, "action": string|null, "is_new": boolean }],
  "projects": [{ "name": string, "client_name": string|null, "milestone": string|null, "milestones": [{"title": string, "due_date": string|null}]|null }],
  "contacts": [{ "name": string, "company": string|null, "title": string|null }],
  "raw_memo": string
}
JSON만 반환하고, 마크다운 코드블록 없이 순수 JSON만 반환하세요.`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, today, shortcutText } = await req.json()

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `오늘 날짜: ${today}${shortcutText ?? ''}\n\n메모:\n${text}`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    const raw = content.text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON 추출 실패')

    return new Response(jsonMatch[0], {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
