import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Project, Milestone } from '../types'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as (Project & { clients: { name: string } | null })[]
    },
  })
}

export function useClientProjects(clientId: string) {
  return useQuery({
    queryKey: ['projects', 'client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, milestones(id, title, due_date, time, completed, created_at)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as (Project & { milestones: { id: string; title: string; due_date: string | null; time: string | null; completed: boolean; created_at: string }[] })[]
    },
    enabled: !!clientId,
  })
}

export function useMilestones(projectId: string) {
  return useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date')
      if (error) throw error
      return data as Milestone[]
    },
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<Project, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('projects')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as Project
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase
        .from('projects')
        .update({ ...input, needs_review: false })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Project
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useAddMilestone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ project_id, title, due_date, time }: { project_id: string; title: string; due_date: string | null; time?: string | null }) => {
      const { data, error } = await supabase
        .from('milestones')
        .insert({ project_id, title, due_date, time: time ?? null, completed: false })
        .select()
        .single()
      if (error) throw error
      return data as Milestone
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['milestones', vars.project_id] }),
  })
}

export function useDeleteMilestone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('milestones').delete().eq('id', id)
      if (error) throw error
      return projectId
    },
    onSuccess: (projectId) => qc.invalidateQueries({ queryKey: ['milestones', projectId] }),
  })
}

export function useToggleMilestone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, completed, projectId }: { id: string; completed: boolean; projectId: string }) => {
      const { error } = await supabase.from('milestones').update({ completed }).eq('id', id)
      if (error) throw error
      return projectId
    },
    onSuccess: (projectId) => qc.invalidateQueries({ queryKey: ['milestones', projectId] }),
  })
}
