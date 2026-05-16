import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getLocalDate } from '../lib/dateUtils'

export type OpenLoop = {
  id: string
  kind: 'overdue_todo' | 'stalled_project'
  title: string
  context: string   // e.g. "12일 경과 · 안진회계법인"
  daysStalled: number
  clientId: string | null
  projectId: string | null
}

export function useOpenLoops() {
  return useQuery({
    queryKey: ['open_loops'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const today = getLocalDate()
      const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString()

      const [todosRes, projectsRes, recentLogsRes] = await Promise.all([
        supabase
          .from('todos')
          .select('id, title, due_date, priority, client_id, project_id, clients(name)')
          .eq('completed', false)
          .not('due_date', 'is', null)
          .lt('due_date', today)
          .order('due_date', { ascending: true })
          .limit(10),
        supabase
          .from('projects')
          .select('id, name, client_id, status, created_at, clients(name)')
          .in('status', ['preparing', 'in_progress', 'review']),
        supabase
          .from('activity_logs')
          .select('entity_id')
          .eq('entity_type', 'project')
          .gte('created_at', twoWeeksAgo),
      ])

      const loops: OpenLoop[] = []

      // 1. 연체 할 일
      for (const t of (todosRes.data ?? []) as any[]) {
        const days = Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000)
        const client = t.clients?.name ?? null
        loops.push({
          id: t.id,
          kind: 'overdue_todo',
          title: t.title,
          context: `${days}일 경과${client ? ' · ' + client : ''}`,
          daysStalled: days,
          clientId: t.client_id,
          projectId: t.project_id,
        })
      }

      // 2. 흐름 끊긴 프로젝트 (14일+ 활동 없음, 생성 14일 이상 된 것만)
      const recentIds = new Set((recentLogsRes.data ?? []).map((l: any) => l.entity_id))
      for (const p of (projectsRes.data ?? []) as any[]) {
        if (recentIds.has(p.id)) continue
        const ageInDays = (Date.now() - new Date(p.created_at).getTime()) / 86400000
        if (ageInDays < 14) continue  // 신규 프로젝트 제외
        const client = p.clients?.name ?? null
        loops.push({
          id: p.id,
          kind: 'stalled_project',
          title: p.name,
          context: `14일+ 활동 없음${client ? ' · ' + client : ''}`,
          daysStalled: Math.floor(ageInDays),
          clientId: p.client_id,
          projectId: p.id,
        })
      }

      // 가장 오래 멈춘 것 먼저
      loops.sort((a, b) => b.daysStalled - a.daysStalled)

      return loops.slice(0, 8)
    },
  })
}
