import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { DeadlineTemplate, DeadlineInstance } from '../types'

type InstanceWithLinks = DeadlineInstance & {
  clients: { name: string } | null
  deadline_templates: { name: string } | null
}

export function useDeadlineTemplates() {
  return useQuery({
    queryKey: ['deadline_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deadline_templates')
        .select('*')
        .order('name')
      if (error) throw error
      return data as DeadlineTemplate[]
    },
  })
}

export function useDeadlineInstances(filters?: { completed?: boolean; upcomingDays?: number; clientId?: string }) {
  return useQuery({
    queryKey: ['deadline_instances', filters],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      let q = supabase
        .from('deadline_instances')
        .select('*, clients(name), deadline_templates(name)')
        .order('due_date')
      if (filters?.completed !== undefined) q = q.eq('completed', filters.completed)
      if (filters?.upcomingDays !== undefined) {
        const limit = new Date(Date.now() + filters.upcomingDays * 86400000).toISOString().split('T')[0]
        q = q.gte('due_date', today).lte('due_date', limit)
      }
      if (filters?.clientId) q = q.eq('client_id', filters.clientId)
      const { data, error } = await q
      if (error) throw error
      return data as InstanceWithLinks[]
    },
  })
}

export function useDeadlineDashboardStats() {
  return useQuery({
    queryKey: ['deadline_dashboard'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('deadline_instances')
        .select('due_date')
        .eq('completed', false)
        .lte('due_date', in30)
      if (error) return { overdue: 0, thisWeek: 0, upcoming: 0 }
      const rows = data ?? []
      const week = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      return {
        overdue: rows.filter(r => r.due_date < today).length,
        thisWeek: rows.filter(r => r.due_date >= today && r.due_date <= week).length,
        upcoming: rows.filter(r => r.due_date > week).length,
      }
    },
  })
}

export function useCreateDeadlineTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<DeadlineTemplate, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('deadline_templates')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as DeadlineTemplate
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deadline_templates'] }),
  })
}

export function useUpdateDeadlineTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<DeadlineTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('deadline_templates')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as DeadlineTemplate
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deadline_templates'] }),
  })
}

export function useDeleteDeadlineTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deadline_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deadline_templates'] })
      qc.invalidateQueries({ queryKey: ['deadline_instances'] })
    },
  })
}

export function useCreateDeadlineInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<DeadlineInstance, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('deadline_instances')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as DeadlineInstance
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deadline_instances'] })
      qc.invalidateQueries({ queryKey: ['deadline_dashboard'] })
    },
  })
}

export function useBulkCreateDeadlineInstances() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ template_id, client_ids, name, due_date }: {
      template_id: string | null; client_ids: string[]; name: string; due_date: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const rows = client_ids.map(client_id => ({
        user_id: user!.id, template_id, client_id, name, due_date, completed: false,
      }))
      const { error } = await supabase.from('deadline_instances').insert(rows)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deadline_instances'] })
      qc.invalidateQueries({ queryKey: ['deadline_dashboard'] })
    },
  })
}

export function useToggleDeadlineInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { data, error } = await supabase
        .from('deadline_instances')
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as DeadlineInstance
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deadline_instances'] })
      qc.invalidateQueries({ queryKey: ['deadline_dashboard'] })
    },
  })
}

export function useDeleteDeadlineInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deadline_instances').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deadline_instances'] })
      qc.invalidateQueries({ queryKey: ['deadline_dashboard'] })
    },
  })
}
