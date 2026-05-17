// Gemini 호출을 서버로 프록시 — API 키를 클라이언트에 노출하지 않기 위함
//
// 지원 action:
//   business_card_ocr     — 명함 이미지 → 연락처 추출
//   business_license_ocr  — 사업자등록증 이미지 → 거래처 정보
//   client_match          — 거래처명 fuzzy 매칭
//   tax_intake_analyze    — 세무 신청서 다중 파일 분석

import { GoogleGenAI } from 'npm:@google/genai'
import {
  getUserFromRequest,
  logTokenUsage,
  checkRateLimit,
} from '../_shared/usage.ts'
import { corsHeaders, errResp, getAllowedOrigin } from '../_shared/common.ts'

const MODEL = 'gemini-2.5-flash'
const MAX_BASE64_BYTES = 8_000_000  // 약 6MB 이미지

type Action =
  | 'business_card_ocr'
  | 'business_license_ocr'
  | 'client_match'
  | 'tax_intake_analyze'

interface FilePart {
  base64: string
  mimeType: string
  label?: string
}

const PROMPTS: Record<Exclude<Action, 'client_match' | 'tax_intake_analyze'>, string> = {
  business_card_ocr: `명함 이미지에서 연락처 정보를 추출해 JSON으로만 반환하세요.

반환 형식:
{
  "name": "이름",
  "company": "회사명 또는 null",
  "title": "직책/직함 또는 null",
  "phone": "휴대폰/대표번호 또는 null",
  "email": "이메일 또는 null",
  "note": "주소, 부서, 홈페이지 등 보조 정보 또는 null",
  "tags": ["명함", "추출된 키워드"]
}

규칙:
- 코드블록 없이 JSON만 반환
- 전화번호와 이메일은 원문에서 읽히는 값을 우선
- 이름이 불명확하면 가장 사람 이름에 가까운 값을 사용`,

  business_license_ocr: `이 사업자등록증(또는 법인등기부등본) 이미지에서 다음 정보를 추출하여 JSON으로 반환하세요.
코드블록 없이 순수 JSON만 반환하세요.

반환 형식:
{
  "name": "상호 또는 법인명",
  "entity_type": "법인 또는 개인 (법인사업자이면 '법인', 개인사업자이면 '개인')",
  "business_number": "사업자등록번호 (000-00-00000 형식, 없으면 null)",
  "corp_number": "법인등록번호 (000000-0000000 형식, 없으면 null)",
  "representative": "대표자명 (없으면 null)",
  "established_date": "개업연월일 또는 설립일 (YYYY-MM-DD 형식, 없으면 null)",
  "industry": "업태 및 종목 (예: 제조업 / 플라스틱, 없으면 null)",
  "address": "사업장 소재지 전체 주소 (없으면 null)",
  "tax_office": "관할 세무서명 (예: 강남세무서, 없으면 null)"
}`,
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin') ?? ''
  const allowOrigin = getAllowedOrigin(origin)
  const headers = corsHeaders(allowOrigin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  let action: Action
  let files: FilePart[] = []
  let rawName: string | undefined
  let existingClients: Array<{ id: string; name: string }> = []

  try {
    const body = await req.json()
    action = body.action
    if (!action) return errResp(headers, 'request_parse', 'action 누락', 400)
    files = body.files ?? []
    rawName = body.rawName
    existingClients = body.existingClients ?? []
  } catch (e) {
    return errResp(headers, 'request_parse', `요청 파싱 실패: ${String(e)}`, 400)
  }

  // 입력 검증
  for (const f of files) {
    if (!f?.base64 || !f?.mimeType) {
      return errResp(headers, 'invalid_file', '파일 형식이 올바르지 않습니다.', 400)
    }
    if (f.base64.length > MAX_BASE64_BYTES) {
      return errResp(headers, 'file_too_large', '파일 크기가 너무 큽니다 (최대 6MB).', 413)
    }
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    return errResp(headers, 'env_check', 'GEMINI_API_KEY가 설정되지 않았습니다.')
  }

  // 사용자 인증 + Rate limit
  const user = await getUserFromRequest(req).catch(() => null)
  if (!user) return errResp(headers, 'auth', '로그인이 필요합니다.', 401)

  const rateLimited = await checkRateLimit(user.id, 30, 60)
  if (rateLimited) return errResp(headers, 'rate_limit', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429)

  const ai = new GoogleGenAI({ apiKey })

  try {
    let response: { text?: string; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }

    if (action === 'client_match') {
      if (!rawName) return errResp(headers, 'invalid_input', 'rawName 누락', 400)
      const existingList = existingClients.map(c => `${c.id}|${c.name}`).join('\n')
      const prompt = `당신은 회계법인의 거래처 관리 에이전트입니다.
메모에서 추출된 거래처명과 기존 거래처 DB를 비교하여 매칭 결과를 JSON으로 반환하세요.

추출된 거래처명: "${rawName}"

기존 거래처 목록 (형식: id|거래처명):
${existingList || '(없음)'}

규칙:
- 동일하거나 유사한 거래처가 있으면 matched_id와 matched_name을 반환
- 약어, 오타, 법인명 축약 등을 고려 (예: "성문화학" = "성문화학(주)")
- 신규 거래처면 is_new: true
- suggested_name: 정제된 공식 명칭

반환 형식 (JSON만, 코드블록 없이):
{"matched_id":null,"matched_name":null,"is_new":true,"confidence":"high","suggested_name":"거래처명"}`
      response = await ai.models.generateContent({ model: MODEL, contents: prompt })

    } else if (action === 'tax_intake_analyze') {
      const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = []
      for (const f of files) {
        if (f.label) parts.push({ text: `[${f.label}]` })
        parts.push({ inlineData: { data: f.base64, mimeType: f.mimeType } })
      }
      parts.push({
        text: `위 문서들(세무대리 신청서, 사업자등록증, 신분증, 통장, 상담메모 등)을 종합 분석하여 다음 JSON을 반환하세요.
코드블록 없이 순수 JSON만 반환.

{
  "client_name": "상호 또는 사업자명",
  "business_number": "사업자등록번호 (000-00-00000, 없으면 null)",
  "representative": "대표자명",
  "phone": "연락처",
  "email": "이메일 또는 null",
  "address": "사업장 주소 또는 null",
  "entity_type": "법인 또는 개인사업자 또는 개인",
  "tax_type": "일반과세 또는 간이과세 또는 면세",
  "service_detail": "기장 또는 조정 또는 신고대리",
  "bookkeeping_fee": 기장료숫자(원, 없으면 null),
  "withdrawal_day": 출금일숫자(1~31, 없으면 null),
  "bank_info": "출금계좌 또는 null",
  "notes": "상담 내용, 특이사항 요약 또는 null",
  "risk_points": ["리스크 항목 배열, 없으면 빈 배열"]
}

리스크 항목 예시: 차명 인건비, 가공경비, 체납 이력, 현금매출 누락 등 의심 징후`,
      })
      response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts }],
      })

    } else if (action === 'business_card_ocr' || action === 'business_license_ocr') {
      if (files.length === 0) return errResp(headers, 'invalid_input', '이미지 파일이 필요합니다.', 400)
      const f = files[0]
      response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: f.base64, mimeType: f.mimeType } },
              { text: PROMPTS[action] },
            ],
          },
        ],
      })

    } else {
      return errResp(headers, 'invalid_action', `알 수 없는 action: ${action}`, 400)
    }

    // 사용량 기록
    const u = response.usageMetadata
    if (u) {
      logTokenUsage({
        userId: user.id,
        email: user.email,
        provider: 'gemini',
        model: MODEL,
        feature: action,
        inputTokens: u.promptTokenCount ?? 0,
        outputTokens: u.candidatesTokenCount ?? 0,
      }).catch(err => console.error('[gemini-proxy] usage log fail:', err))
    }

    return new Response(JSON.stringify({ text: response.text ?? '' }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('[gemini-proxy] error:', e)
    return errResp(headers, 'gemini_api', 'AI 분석 중 오류가 발생했습니다.')
  }
})
