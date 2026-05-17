import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '../lib/supabase'

export type StreamType = 'memo' | 'event' | 'todo' | 'milestone' | 'activity'

export type StreamItem = {
  stream_type: StreamType
  id: string
  title: string
  client_id: string | null
  project_id: string | null
  memo_id: string | null
  user_id: string
  created_at: string
  extra: string | null
  meta_type: string | null
}

// memo와 그 파생 항목들을 묶은 그룹
export type StreamGroup = {
  kind: 'memo-group'
  memo: StreamItem            // 원본 메모
  derived: StreamItem[]       // 이 메모에서 생성된 항목들 (시간순)
}

// memo_id 없거나 부모 메모가 오늘 범위 밖인 단독 항목
export type StreamOrphan = {
  kind: 'orphan'
  item: StreamItem
}

export type StreamRow = StreamGroup | StreamOrphan

/**
 * activity_stream view에서 특정 기간/필터로 항목 조회
 */
function useActivityStream(params: {
  since?: string             // ISO timestamp (이 시점 이후만)
  clientId?: string
  projectId?: string
  memoId?: string
  limit?: number
}) {
  const { since, clientId, projectId, memoId, limit = 100 } = params
  return useQuery({
    queryKey: ['activity_stream', { since, clientId, projectId, memoId, limit }],
    queryFn: async (): Promise<StreamItem[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      let q = supabase
        .from('activity_stream')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (since)     q = q.gte('created_at', since)
      if (clientId)  q = q.eq('client_id', clientId)
      if (projectId) q = q.eq('project_id', projectId)
      if (memoId)    q = q.eq('memo_id', memoId)
      const { data, error } = await q
      if (error) {
        // view가 아직 없으면 빈 배열로 graceful degrade
        if (error.message?.includes('activity_stream')) {
          console.warn('[activity_stream] view가 없습니다. migration 022를 실행하세요.')
          return []
        }
        throw error
      }
      return (data ?? []) as StreamItem[]
    },
    staleTime: 30_000,
  })
}

/**
 * 오늘 생성된 activity_stream 조회 + memo_id 그룹핑
 *
 * 기본 동작:
 *   - activity_logs는 노이즈이므로 제외 (includeActivity: true 시 포함)
 *   - 메모를 중심으로 파생 항목을 그룹화
 *   - 메모 없는 단독 일정/할일은 orphan으로 분리
 */
export function useTodayFlow(options: { includeActivity?: boolean } = {}) {
  const { includeActivity = false } = options
  const since = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])

  const query = useActivityStream({ since, limit: 200 })

  const rows = useMemo<StreamRow[]>(() => {
    let items = query.data ?? []
    if (items.length === 0) return []

    // 시스템 자동 로그는 노이즈 → 기본적으로 제외
    if (!includeActivity) {
      items = items.filter(i => i.stream_type !== 'activity')
    }

    // 메모 우선 처리
    const memos = items.filter(i => i.stream_type === 'memo')
    const memoById = new Map(memos.map(m => [m.id, m]))
    const derivedByMemoId = new Map<string, StreamItem[]>()

    for (const item of items) {
      if (item.stream_type === 'memo') continue
      if (!item.memo_id) continue
      if (!memoById.has(item.memo_id)) continue   // 부모 메모가 오늘 범위 밖
      const list = derivedByMemoId.get(item.memo_id) ?? []
      list.push(item)
      derivedByMemoId.set(item.memo_id, list)
    }

    // 그룹화된 memo (오래된 → 최신 순으로 파생 항목 정렬)
    const groups: StreamGroup[] = memos.map(memo => ({
      kind: 'memo-group',
      memo,
      derived: (derivedByMemoId.get(memo.id) ?? []).sort(
        (a, b) => a.created_at.localeCompare(b.created_at)
      ),
    }))

    // 메모 없거나 부모 메모가 범위 밖인 단독 항목
    const orphans: StreamOrphan[] = items
      .filter(i =>
        i.stream_type !== 'memo' &&
        (!i.memo_id || !memoById.has(i.memo_id))
      )
      .map(item => ({ kind: 'orphan', item }))

    // 그룹과 orphan을 created_at 기준으로 mix (최신순)
    const sortKey = (r: StreamRow) =>
      r.kind === 'memo-group' ? r.memo.created_at : r.item.created_at
    return [...groups, ...orphans].sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
  }, [query.data, includeActivity])

  return {
    rows,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    rawCount: query.data?.length ?? 0,
  }
}

/**
 * 특정 memo가 만들어낸 모든 파생 항목 조회 (메모 상세 페이지용)
 */
export function useMemoDerivedItems(memoId: string) {
  return useActivityStream({ memoId, limit: 50 })
}
