import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { CalendarEvent } from '../types'

export function useProjectCalendarEvents(projectId: string) {
  return useQuery({
    queryKey: ['calendar_events', 'project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, clients(name)')
        .eq('project_id', projectId)
        .order('date', { ascending: false })
      if (error) throw error
      return data as (CalendarEvent & { clients: { name: string } | null })[]
    },
    enabled: !!projectId,
  })
}

export function useClientUpcomingEvents(clientId: string) {
  return useQuery({
    queryKey: ['calendar_events', 'client', clientId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, projects(name)')
        .eq('client_id', clientId)
        .gte('date', today)
        .order('date')
        .order('time', { nullsFirst: true })
        .limit(10)
      if (error) throw error
      return data as (CalendarEvent & { projects: { name: string } | null })[]
    },
    enabled: !!clientId,
  })
}

export function useClientCalendarEvents(clientId: string) {
  return useQuery({
    queryKey: ['calendar_events', 'client_all', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, projects(name)')
        .eq('client_id', clientId)
        .order('date', { ascending: false })
      if (error) throw error
      return data as (CalendarEvent & { projects: { name: string } | null })[]
    },
    enabled: !!clientId,
  })
}

export function useCalendarEvents() {
  return useQuery({
    queryKey: ['calendar_events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, clients(name), projects(name)')
        .order('date')
      if (error) throw error
      return data as (CalendarEvent & { clients: { name: string } | null; projects: { name: string } | null })[]
    },
  })
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<CalendarEvent, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as CalendarEvent
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar_events'] }),
  })
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CalendarEvent> & { id: string }) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as CalendarEvent
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar_events'] }),
  })
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar_events'] }),
  })
}
