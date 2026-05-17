// Edge Function에서 공유되는 token usage 기록 헬퍼
// 각 Edge Function이 Claude/Gemini 응답을 받은 후 호출하여 token_usage 테이블에 기록

import { createClient } from 'jsr:@supabase/supabase-js@2'

// ──────────────────────────────────────────────────────────────────────
// Pricing (USD per million tokens) — 2026-05 기준
// ──────────────────────────────────────────────────────────────────────
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic Claude
  'claude-haiku-4-5-20251001': { input: 1.0,  output: 5.0  },
  'claude-sonnet-4-6':         { input: 3.0,  output: 15.0 },
  'claude-opus-4-7':           { input: 15.0, output: 75.0 },
  // Google Gemini
  'gemini-2.5-flash':          { input: 0.30, output: 2.50 },
  'gemini-2.5-pro':            { input: 1.25, output: 10.0 },
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model]
  if (!p) return 0
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

// ──────────────────────────────────────────────────────────────────────
// JWT에서 user 정보 추출
// ──────────────────────────────────────────────────────────────────────
export async function getUserFromRequest(req: Request): Promise<{ id: string; email: string | null } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) return null
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null
  return { id: user.id, email: user.email ?? null }
}

// ──────────────────────────────────────────────────────────────────────
// token_usage 테이블에 기록 (service role 사용 - RLS 우회)
// ──────────────────────────────────────────────────────────────────────
export interface UsageRecord {
  userId: string | null
  email: string | null
  provider: 'anthropic' | 'gemini' | 'openai'
  model: string
  feature: string
  inputTokens: number
  outputTokens: number
  metadata?: Record<string, unknown>
}

export async function logTokenUsage(rec: UsageRecord): Promise<void> {
  // user_id가 없으면 로깅 스킵 (anonymous 호출)
  if (!rec.userId) {
    console.warn('[token_usage] user_id 없음, 로깅 스킵', rec.feature)
    return
  }
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    console.warn('[token_usage] SUPABASE_SERVICE_ROLE_KEY 없음, 로깅 스킵')
    return
  }
  const admin = createClient(url, serviceKey)
  const totalTokens = rec.inputTokens + rec.outputTokens
  const cost = estimateCost(rec.model, rec.inputTokens, rec.outputTokens)
  const { error } = await admin.from('token_usage').insert({
    user_id: rec.userId,
    email: rec.email,
    provider: rec.provider,
    model: rec.model,
    feature: rec.feature,
    input_tokens: rec.inputTokens,
    output_tokens: rec.outputTokens,
    total_tokens: totalTokens,
    estimated_cost: cost,
    metadata: rec.metadata ?? null,
  })
  if (error) {
    console.error('[token_usage] 저장 실패:', error)
  }
}
