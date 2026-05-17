// Gemini 호출은 모두 Edge Function `gemini-proxy`로 프록시됩니다.
// API 키는 서버에만 보관되어 클라이언트 번들에 노출되지 않습니다.

import { supabase } from './supabase'
import type { Client } from '../types'

type Action =
  | 'business_card_ocr'
  | 'business_license_ocr'
  | 'client_match'
  | 'tax_intake_analyze'

interface GeminiProxyBody {
  action: Action
  files?: Array<{ base64: string; mimeType: string; label?: string }>
  rawName?: string
  existingClients?: Array<{ id: string; name: string }>
}

async function callGeminiProxy(body: GeminiProxyBody): Promise<string> {
  const { data, error } = await supabase.functions.invoke('gemini-proxy', { body })
  if (error) {
    // FunctionsHttpError 에러 메시지 추출
    let msg = error.message
    try {
      // error.context는 FunctionsHttpError에서 Response 객체
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = (error as any).context
      if (ctx?.json) {
        const j = await ctx.json()
        msg = j?.error ?? msg
      }
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  return (data?.text as string) ?? ''
}

function extractJson<T>(raw: string): T {
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('AI 응답 파싱 실패: ' + raw.slice(0, 200))
  return JSON.parse(m[0]) as T
}

// ── 거래처 매칭 ──────────────────────────────────────────────────────────

interface ClientMatchResult {
  matched_id: string | null
  matched_name: string | null
  is_new: boolean
  confidence: 'high' | 'medium' | 'low'
  suggested_name: string
}

export async function matchClient(rawName: string): Promise<ClientMatchResult> {
  const { data: clients } = await supabase.from('clients').select('id, name').order('name')
  const raw = await callGeminiProxy({
    action: 'client_match',
    rawName,
    existingClients: (clients ?? []) as Array<{ id: string; name: string }>,
  })
  return extractJson<ClientMatchResult>(raw || '{}')
}

export async function matchClients(names: string[]): Promise<ClientMatchResult[]> {
  return Promise.all(names.map(name => matchClient(name)))
}

// ── 명함 OCR ─────────────────────────────────────────────────────────────

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
  const raw = await callGeminiProxy({
    action: 'business_card_ocr',
    files: [{ base64: fileBase64, mimeType }],
  })
  return extractJson<ExtractedContactInfo>(raw)
}

// ── 사업자등록증 OCR ─────────────────────────────────────────────────────

export type ExtractedClientInfo = Pick<
  Client,
  'name' | 'business_number' | 'corp_number' | 'representative' |
  'established_date' | 'industry' | 'entity_type' | 'address' | 'tax_office'
>

export async function extractFromBusinessLicense(
  fileBase64: string,
  mimeType: string,
): Promise<ExtractedClientInfo> {
  const raw = await callGeminiProxy({
    action: 'business_license_ocr',
    files: [{ base64: fileBase64, mimeType }],
  })
  return extractJson<ExtractedClientInfo>(raw)
}

// ── 세무 신청서 분석 ────────────────────────────────────────────────────

export type ExtractedIntakeInfo = {
  client_name: string | null
  business_number: string | null
  representative: string | null
  phone: string | null
  email: string | null
  address: string | null
  entity_type: string | null
  tax_type: string | null
  service_detail: string | null
  bookkeeping_fee: number | null
  withdrawal_day: number | null
  bank_info: string | null
  notes: string | null
  risk_points: string[]
}

export async function analyzeIntakeDocuments(
  files: Array<{ label: string; base64: string; mimeType: string }>
): Promise<ExtractedIntakeInfo> {
  const raw = await callGeminiProxy({
    action: 'tax_intake_analyze',
    files,
  })
  return extractJson<ExtractedIntakeInfo>(raw)
}
