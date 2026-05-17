import { GoogleGenAI } from '@google/genai'
import { supabase } from './supabase'
import { logClientTokenUsage } from './tokenUsage'
import type { Client } from '../types'

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY })
const GEMINI_MODEL = 'gemini-2.5-flash'

// Gemini 응답에서 usage 추출 후 기록 (fire-and-forget)
function trackGeminiUsage(
  feature: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any,
  metadata?: Record<string, unknown>,
) {
  const u = response?.usageMetadata
  if (!u) return
  logClientTokenUsage({
    provider: 'gemini',
    model: GEMINI_MODEL,
    feature,
    inputTokens: u.promptTokenCount ?? 0,
    outputTokens: u.candidatesTokenCount ?? 0,
    metadata,
  })
}

// ── 거래처 매칭 에이전트 ──────────────────────────────────────────────

interface ClientMatchResult {
  matched_id: string | null
  matched_name: string | null
  is_new: boolean
  confidence: 'high' | 'medium' | 'low'
  suggested_name: string
}

export type ExtractedContactInfo = {
  name: string
  company: string | null
  title: string | null
  phone: string | null
  email: string | null
  note: string | null
  tags: string[]
}

export async function extractFromBusinessCard(
  fileBase64: string,
  mimeType: string,
): Promise<ExtractedContactInfo> {
  const prompt = `명함 이미지에서 연락처 정보를 추출해 JSON으로만 반환하세요.

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
- 이름이 불명확하면 가장 사람 이름에 가까운 값을 사용`

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: fileBase64, mimeType } },
          { text: prompt },
        ],
      },
    ],
  })
  trackGeminiUsage('business_card_ocr', response)

  const raw = response.text ?? ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('JSON 파싱 실패: ' + raw)
  return JSON.parse(jsonMatch[0]) as ExtractedContactInfo
}

export async function matchClient(rawName: string): Promise<ClientMatchResult> {
  const { data: clients } = await supabase.from('clients').select('id, name').order('name')
  const existingList = (clients ?? []).map(c => `${c.id}|${c.name}`).join('\n')

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

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  })
  trackGeminiUsage('client_match', response)
  return JSON.parse(response.text ?? '{}') as ClientMatchResult
}

export async function matchClients(names: string[]): Promise<ClientMatchResult[]> {
  return Promise.all(names.map(name => matchClient(name)))
}

// ── 세무대리 신규 접수 종합 분석 ──────────────────────────────────────

export type ExtractedIntakeInfo = {
  client_name: string | null
  business_number: string | null
  representative: string | null
  phone: string | null
  email: string | null
  address: string | null
  entity_type: string | null    // 법인/개인사업자/개인
  tax_type: string | null       // 일반과세/간이과세/면세
  service_detail: string | null // 기장/조정/신고대리
  bookkeeping_fee: number | null
  withdrawal_day: number | null
  bank_info: string | null
  notes: string | null
  risk_points: string[]
}

export async function analyzeIntakeDocuments(
  files: Array<{ label: string; base64: string; mimeType: string }>
): Promise<ExtractedIntakeInfo> {
  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = []

  for (const f of files) {
    parts.push({ text: `[${f.label}]` })
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

리스크 항목 예시: 차명 인건비, 가공경비, 체납 이력, 현금매출 누락 등 의심 징후`
  })

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts }],
  })
  trackGeminiUsage('tax_intake_analyze', response, { file_count: files.length })

  const raw = response.text ?? ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('분석 결과 파싱 실패: ' + raw.slice(0, 200))
  return JSON.parse(jsonMatch[0]) as ExtractedIntakeInfo
}

// ── 사업자등록증 OCR 에이전트 ─────────────────────────────────────────

export type ExtractedClientInfo = Pick<
  Client,
  'name' | 'business_number' | 'corp_number' | 'representative' |
  'established_date' | 'industry' | 'entity_type' | 'address' | 'tax_office'
>

export async function extractFromBusinessLicense(
  fileBase64: string,
  mimeType: string,
): Promise<ExtractedClientInfo> {
  const prompt = `이 사업자등록증(또는 법인등기부등본) 이미지에서 다음 정보를 추출하여 JSON으로 반환하세요.
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
}`

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: fileBase64, mimeType } },
          { text: prompt },
        ],
      },
    ],
  })
  trackGeminiUsage('business_license_ocr', response)

  const raw = response.text ?? ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('JSON 파싱 실패: ' + raw)
  return JSON.parse(jsonMatch[0]) as ExtractedClientInfo
}
