// 공통 Edge Function 헬퍼: CORS / 에러 응답 / 허용 origin

// 허용된 origin 목록 — 환경변수 ALLOWED_ORIGINS 콤마 구분 + 기본값
function getAllowedOriginsList(): string[] {
  const env = Deno.env.get('ALLOWED_ORIGINS') ?? ''
  const list = env.split(',').map(s => s.trim()).filter(Boolean)
  if (list.length > 0) return list
  // 기본값 — 프로덕션 도메인
  return [
    'https://noterp.co.kr',
    'https://www.noterp.co.kr',
    'http://localhost:5173',
    'http://localhost:4173',
  ]
}

export function getAllowedOrigin(requestOrigin: string): string {
  const allowed = getAllowedOriginsList()
  if (allowed.includes(requestOrigin)) return requestOrigin
  // 매칭 안 되면 첫 번째 (기본 프로덕션) origin 반환 — preflight 차단 효과
  return allowed[0]
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// 에러 응답 — 프로덕션에서는 내부 메시지 노출 최소화
export function errResp(
  headers: Record<string, string>,
  step: string,
  message: string,
  status = 500,
): Response {
  console.error(`[edge][${step}]`, message)
  // 4xx (사용자 입력 오류)는 메시지 그대로, 5xx (서버 오류)는 일반 메시지
  const publicMessage = status >= 500
    ? '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    : message
  return new Response(
    JSON.stringify({ error: publicMessage, step }),
    { status, headers: { ...headers, 'Content-Type': 'application/json' } },
  )
}
