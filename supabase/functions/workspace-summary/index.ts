import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { contextName, contextType, items } = await req.json()

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `회계법인 업무 비서. ${contextType === 'client' ? '거래처' : '프로젝트'} "${contextName}"의 업무 흐름을 4~6개 항목으로 복원하세요.\n각 항목 앞에 반드시 아래 마커 중 하나를 붙이세요:\n  [Done]        완료된 일\n  [In Progress] 현재 진행·예정 중인 일\n  [Pending]     아직 시작 안 됨·미확정·follow-up 필요\n형식: "[마커] 한 줄 행동 중심 텍스트"`,
      messages: [{ role: 'user', content: `최근 활동 (최신순):\n${items}` }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response')

    return new Response(JSON.stringify({ text: content.text.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
