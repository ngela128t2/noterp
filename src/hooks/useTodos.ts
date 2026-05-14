import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
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
