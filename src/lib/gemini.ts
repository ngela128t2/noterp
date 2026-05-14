import { GoogleGenAI } from '@google/genai'
import { supabase } from './supabase'
import type { Client } from '../types'

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY })

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
    model: 'gemini-2.5-flash',
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
    model: 'gemini-2.5-flash',
    contents: prompt,
  })
  return JSON.parse(response.text ?? '{}') as ClientMatchResult
}

export async function matchClients(names: string[]): Promise<ClientMatchResult[]> {
  return Promise.all(names.map(name => matchClient(name)))
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
    model: 'gemini-2.5-flash',
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

  const raw = response.text ?? ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('JSON 파싱 실패: ' + raw)
  return JSON.parse(jsonMatch[0]) as ExtractedClientInfo
}
