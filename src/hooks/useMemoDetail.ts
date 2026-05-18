import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ParsedResult } from '../types'

export type MemoDetail = {
  id: string
  raw_text: string
  parsed_result: ParsedResult | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export function useMemoDetail(memoId: string | undefined) {
  return useQuery({
    queryKey: ['memo', memoId],
    enabled: !!memoId,
    queryFn: async (): Promise<MemoDetail | null> => {
      if (!memoId) return null
      const { data, error } = await supabase
        .from('memos')
        .select('id, raw_text, parsed_result, status, created_at')
        .eq('id', memoId)
        .maybeSingle()
      if (error) throw error
      return data as MemoDetail | null
    },
  })
}

export type DerivedTodo = {
  id: string; title: string; due_date: string | null
  priority: 'high' | 'medium' | 'low' | null
  completed: boolean
  client_id: string | null; project_id: string | null
}

export type DerivedEvent = {
  id: string; title: string; date: string; time: string | null
  location: string | null
  completed: boolean
  client_id: string | null; project_id: string | null
}

export type DerivedMilestone = {
  id: string; title: string; due_date: string | null
  completed: boolean
  project_id: string
}

export type DerivedClient = { id: string; name: string }
export type DerivedProject = { id: string; name: string; client_id: string | null }

export type MemoDerived = {
  todos: DerivedTodo[]
  events: DerivedEvent[]
  milestones: DerivedMilestone[]
  clients: DerivedClient[]    // 이 메모와 연결된 (todos/events에서 참조)
  projects: DerivedProject[]
}

/**
 * 메모 1건에서 파생된 모든 항목을 한 번에 가져옴
 */
export function useMemoDerived(memoId: string | undefined) {
  return useQuery({
    queryKey: ['memo', memoId, 'derived'],
    enabled: !!memoId,
    queryFn: async (): Promise<MemoDerived> => {
      if (!memoId) return { todos: [], events: [], milestones: [], clients: [], projects: [] }
      const [todosRes, eventsRes, milestonesRes, projectsFromMemoRes] = await Promise.all([
        supabase.from('todos')
          .select('id, title, due_date, priority, completed, client_id, project_id')
          .eq('memo_id', memoId)
          .order('created_at'),
        supabase.from('calendar_events')
          .select('id, title, date, time, location, completed, client_id, project_id')
          .eq('memo_id', memoId)
          .order('date'),
        supabase.from('milestones')
          .select('id, title, due_date, completed, project_id')
          .eq('memo_id', memoId)
          .order('created_at'),
        supabase.from('projects')
          .select('id, name, client_id')
          .eq('created_from_memo_id', memoId),
      ])
      if (todosRes.error) throw todosRes.error
      if (eventsRes.error) throw eventsRes.error
      if (milestonesRes.error) throw milestonesRes.error
      if (projectsFromMemoRes.error) throw projectsFromMemoRes.error

      const todos = (todosRes.data ?? []) as DerivedTodo[]
      const events = (eventsRes.data ?? []) as DerivedEvent[]
      const milestones = (milestonesRes.data ?? []) as DerivedMilestone[]
      const projectsCreated = (projectsFromMemoRes.data ?? []) as DerivedProject[]

      // 파생 todo/event에서 참조된 client_id / project_id 수집
      const clientIds = new Set<string>()
      const projectIds = new Set<string>()
      for (const t of todos) {
        if (t.client_id) clientIds.add(t.client_id)
        if (t.project_id) projectIds.add(t.project_id)
      }
      for (const e of events) {
        if (e.client_id) clientIds.add(e.client_id)
        if (e.project_id) projectIds.add(e.project_id)
      }
      for (const p of projectsCreated) {
        if (p.client_id) clientIds.add(p.client_id)
        projectIds.add(p.id)
      }

      const [clientsData, projectsData] = await Promise.all([
        clientIds.size > 0
          ? supabase.from('clients').select('id, name').in('id', Array.from(clientIds))
          : Promise.resolve({ data: [], error: null }),
        projectIds.size > 0
          ? supabase.from('projects').select('id, name, client_id').in('id', Array.from(projectIds))
          : Promise.resolve({ data: [], error: null }),
      ])

      return {
        todos,
        events,
        milestones,
        clients: (clientsData.data ?? []) as DerivedClient[],
        projects: (projectsData.data ?? []) as DerivedProject[],
      }
    },
    staleTime: 10_000,
  })
}
