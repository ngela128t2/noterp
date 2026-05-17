import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type UsageRow = {
  id: string
  user_id: string | null
  email: string | null
  provider: string
  model: string
  feature: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated_cost: number
  metadata: Record<string, unknown> | null
  created_at: string
}

export type UsageByUser = {
  user_id: string
  email: string | null
  full_name: string | null
  call_count: number
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_cost: number
  last_call_at: string | null
}

export type UsageByFeature = {
  feature: string
  provider: string
  model: string
  call_count: number
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_cost: number
}

export type DateRange = 'today' | 'last7' | 'thisMonth' | 'all'

function rangeStart(range: DateRange): string | null {
  const d = new Date()
  switch (range) {
    case 'today':
      d.setHours(0, 0, 0, 0)
      return d.toISOString()
    case 'last7':
      d.setDate(d.getDate() - 7)
      d.setHours(0, 0, 0, 0)
      return d.toISOString()
    case 'thisMonth':
      d.setDate(1)
      d.setHours(0, 0, 0, 0)
      return d.toISOString()
    case 'all':
    default:
      return null
  }
}

/**
 * Admin: 전체 사용자 token_usage 행 (필터링)
 * 일반 사용자: 본인 행만 (RLS)
 */
export function useTokenUsageRows(filters: {
  range: DateRange
  userId?: string
  feature?: string
  provider?: string
  limit?: number
}) {
  return useQuery({
    queryKey: ['token_usage', 'rows', filters],
    queryFn: async (): Promise<UsageRow[]> => {
      let q = supabase
        .from('token_usage')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters.limit ?? 500)
      const since = rangeStart(filters.range)
      if (since) q = q.gte('created_at', since)
      if (filters.userId)   q = q.eq('user_id', filters.userId)
      if (filters.feature)  q = q.eq('feature', filters.feature)
      if (filters.provider) q = q.eq('provider', filters.provider)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as UsageRow[]
    },
    staleTime: 30_000,
  })
}

/**
 * Admin: 사용자별 요약 (token_usage_by_user 뷰 + 필터링은 클라이언트에서)
 */
export function useTokenUsageByUser(range: DateRange) {
  return useQuery({
    queryKey: ['token_usage', 'by_user', range],
    queryFn: async (): Promise<UsageByUser[]> => {
      const since = rangeStart(range)
      // 기간 필터가 있으면 raw 행을 집계, 없으면 뷰 사용
      if (since) {
        const { data, error } = await supabase
          .from('token_usage')
          .select('user_id, email, input_tokens, output_tokens, total_tokens, estimated_cost, created_at')
          .gte('created_at', since)
        if (error) throw error
        const map = new Map<string, UsageByUser>()
        for (const r of data ?? []) {
          const key = r.user_id ?? 'unknown'
          const cur = map.get(key) ?? {
            user_id: key,
            email: r.email,
            full_name: null,
            call_count: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_tokens: 0,
            total_cost: 0,
            last_call_at: null,
          }
          cur.call_count++
          cur.total_input_tokens += r.input_tokens ?? 0
          cur.total_output_tokens += r.output_tokens ?? 0
          cur.total_tokens += r.total_tokens ?? 0
          cur.total_cost += Number(r.estimated_cost ?? 0)
          if (!cur.last_call_at || r.created_at > cur.last_call_at) cur.last_call_at = r.created_at
          map.set(key, cur)
        }
        // full_name 보강 — profiles에서 가져오기
        const userIds = Array.from(map.keys()).filter(id => id !== 'unknown')
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds)
          for (const p of profiles ?? []) {
            const row = map.get(p.id)
            if (row) row.full_name = p.full_name ?? null
          }
        }
        return Array.from(map.values()).sort((a, b) => b.total_cost - a.total_cost)
      }
      // all: 뷰 사용
      const { data, error } = await supabase
        .from('token_usage_by_user')
        .select('*')
        .order('total_cost', { ascending: false })
      if (error) throw error
      return (data ?? []) as UsageByUser[]
    },
    staleTime: 30_000,
  })
}

/**
 * Admin: 기능별 요약
 */
export function useTokenUsageByFeature(range: DateRange) {
  return useQuery({
    queryKey: ['token_usage', 'by_feature', range],
    queryFn: async (): Promise<UsageByFeature[]> => {
      const since = rangeStart(range)
      if (since) {
        const { data, error } = await supabase
          .from('token_usage')
          .select('feature, provider, model, input_tokens, output_tokens, total_tokens, estimated_cost')
          .gte('created_at', since)
        if (error) throw error
        const map = new Map<string, UsageByFeature>()
        for (const r of data ?? []) {
          const key = `${r.feature}|${r.provider}|${r.model}`
          const cur = map.get(key) ?? {
            feature: r.feature,
            provider: r.provider,
            model: r.model,
            call_count: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_tokens: 0,
            total_cost: 0,
          }
          cur.call_count++
          cur.total_input_tokens += r.input_tokens ?? 0
          cur.total_output_tokens += r.output_tokens ?? 0
          cur.total_tokens += r.total_tokens ?? 0
          cur.total_cost += Number(r.estimated_cost ?? 0)
          map.set(key, cur)
        }
        return Array.from(map.values()).sort((a, b) => b.total_cost - a.total_cost)
      }
      const { data, error } = await supabase
        .from('token_usage_by_feature')
        .select('*')
        .order('total_cost', { ascending: false })
      if (error) throw error
      return (data ?? []) as UsageByFeature[]
    },
    staleTime: 30_000,
  })
}
