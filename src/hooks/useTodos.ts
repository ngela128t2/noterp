import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getLocalDate } from '../lib/dateUtils'
import type { Todo } from '../types'

export function useClientTodos(clientId: string) {
  return useQuery({
    queryKey: ['todos', 'client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('todos')
        .select('*, projects(name)')
        .eq('client_id', clientId)
        .eq('completed', false)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as (Todo & { projects: { name: string } | null })[]
    },
    enabled: !!clientId,
  })
}

export function useProjectTodos(projectId: string) {
  return useQuery({
    queryKey: ['todos', 'project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('todos')
        .select('*, clients(name)')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as (Todo & { clients: { name: string } | null })[]
    },
    enabled: !!projectId,
  })
}

export function useTodos() {
  return useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('todos')
        .select('*, clients(name), projects(name)')
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as (Todo & { clients: { name: string } | null; projects: { name: string } | null })[]
    },
  })
}

export function useCreateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<Todo, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('todos')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as Todo
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  })
}

export function useUpdateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; title?: string; due_date?: string | null; priority?: 'high' | 'medium' | 'low' | null }) => {
      const { error } = await supabase.from('todos').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['todos'] })
      qc.invalidateQueries({ queryKey: ['activity_stream'] })
      qc.invalidateQueries({ queryKey: ['memo'] })
    },
  })
}

export function useToggleTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('todos').update({ completed }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  })
}

export function useSnoozeTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, days = 7 }: { id: string; days?: number }) => {
      const d = new Date()
      d.setDate(d.getDate() + days)
      const { error } = await supabase.from('todos').update({ due_date: getLocalDate(d) }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['todos'] })
      qc.invalidateQueries({ queryKey: ['open_loops'] })
      qc.invalidateQueries({ queryKey: ['dashboard_stats'] })
    },
  })
}

export function useDeleteTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('todos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  })
}
