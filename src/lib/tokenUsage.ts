import { supabase } from './supabase'

// Edge Functions와 동일한 pricing (USD per million tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1.0,  output: 5.0  },
  'claude-sonnet-4-6':         { input: 3.0,  output: 15.0 },
  'claude-opus-4-7':           { input: 15.0, output: 75.0 },
  'gemini-2.5-flash':          { input: 0.30, output: 2.50 },
  'gemini-2.5-pro':            { input: 1.25, output: 10.0 },
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model]
  if (!p) return 0
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

export interface ClientUsageRecord {
  provider: 'gemini' | 'anthropic' | 'openai'
  model: string
  feature: string
  inputTokens: number
  outputTokens: number
  metadata?: Record<string, unknown>
}

/**
 * 클라이언트 사이드에서 AI 호출 후 사용량을 기록합니다.
 * RLS 정책에 의해 본인의 user_id로만 insert 가능합니다.
 * 실패해도 silently fail — 메인 기능 흐름에 영향 없음.
 */
export async function logClientTokenUsage(rec: ClientUsageRecord): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const totalTokens = rec.inputTokens + rec.outputTokens
    const cost = estimateCost(rec.model, rec.inputTokens, rec.outputTokens)
    const { error } = await supabase.from('token_usage').insert({
      user_id: user.id,
      email: user.email ?? null,
      provider: rec.provider,
      model: rec.model,
      feature: rec.feature,
      input_tokens: rec.inputTokens,
      output_tokens: rec.outputTokens,
      total_tokens: totalTokens,
      estimated_cost: cost,
      metadata: rec.metadata ?? null,
    })
    if (error) console.warn('[token_usage] insert 실패:', error.message)
  } catch (err) {
    console.warn('[token_usage] 예외:', err)
  }
}
