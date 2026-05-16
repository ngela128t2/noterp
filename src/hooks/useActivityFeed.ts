import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ActivityLog } from './useLogs'

export type FeedFilter = '전체' | '메모' | '완료' | '기록'

const PAGE_SIZE = 20

function applyFilter(
  query: ReturnType<typeof supabase.from>,
  filter: FeedFilter,
) {
  if (filter === '메모') return (query as any).eq('action', 'memo_linked')
  if (filter === '완료') return (query as any).eq('action', 'completed')
  if (filter === '기록') return (query as any).in('action', ['created', 'updated', 'approved'])
  return query
}

export type FeedPage = {
  items: ActivityLog[]
  nextOffset: number
  hasMore: boolean
}

// 거래처 + 연결된 프로젝트 전체 로그 (활동 피드용)
export function useClientActivityFeed(
  clientId: string,
  projectIds: string[],
  filter: FeedFilter = '전체',
) {
  return useInfiniteQuery<FeedPage>({
    queryKey: ['activity_feed', 'client', clientId, projectIds, filter],
    queryFn: async ({ pageParam }) => {
      const offset = (pageParam as number) ?? 0
      let q = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      // 거래처 로그 + 연결 프로젝트 로그 통합
      if (projectIds.length > 0) {
        q = (q as any).or(
          `and(entity_type.eq.client,entity_id.eq.${clientId}),and(entity_type.eq.project,entity_id.in.(${projectIds.join(',')}))`,
        )
      } else {
        q = (q as any).eq('entity_type', 'client').eq('entity_id', clientId)
      }

      q = applyFilter(q as any, filter)

      const { data, error } = await q
      if (error) throw error
      const items = (data ?? []) as ActivityLog[]
      return { items, nextOffset: offset + PAGE_SIZE, hasMore: items.length === PAGE_SIZE }
    },
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    enabled: !!clientId,
  })
}

// 프로젝트 로그 (활동 피드용)
export function useProjectActivityFeed(projectId: string, filter: FeedFilter = '전체') {
  return useInfiniteQuery<FeedPage>({
    queryKey: ['activity_feed', 'project', projectId, filter],
    queryFn: async ({ pageParam }) => {
      const offset = (pageParam as number) ?? 0
      let q = supabase
        .from('activity_logs')
        .select('*')
        .eq('entity_type', 'project')
        .eq('entity_id', projectId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      q = applyFilter(q as any, filter)

      const { data, error } = await q
      if (error) throw error
      const items = (data ?? []) as ActivityLog[]
      return { items, nextOffset: offset + PAGE_SIZE, hasMore: items.length === PAGE_SIZE }
    },
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    enabled: !!projectId,
  })
}
