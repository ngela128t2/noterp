import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useGlobalSearch(query: string) {
  const q = query.trim()
  return useQuery({
    queryKey: ['global_search', q],
    enabled: q.length >= 2,
    staleTime: 10_000,
    queryFn: async () => {
      const like = `%${q}%`
      const [clients, projects, todos, events, contacts] = await Promise.all([
        supabase.from('clients').select('id, name, code, service_category').ilike('name', like).limit(5),
        supabase.from('projects').select('id, name, status, clients(name)').ilike('name', like).limit(5),
        supabase.from('todos').select('id, title, due_date, completed, client_id').ilike('title', like).limit(5),
        supabase.from('calendar_events').select('id, title, date, client_id, project_id').ilike('title', like).limit(5),
        supabase.from('contacts').select('id, name, company, title, client_id').ilike('name', like).limit(5),
      ])
      return {
        clients: (clients.data ?? []) as Array<{ id: string; name: string; code: string | null; service_category: string | null }>,
        projects: (projects.data ?? []) as unknown as Array<{ id: string; name: string; status: string; clients: { name: string } | null }>,
        todos: (todos.data ?? []) as Array<{ id: string; title: string; due_date: string | null; completed: boolean; client_id: string | null }>,
        events: (events.data ?? []) as Array<{ id: string; title: string; date: string; client_id: string | null; project_id: string | null }>,
        contacts: (contacts.data ?? []) as Array<{ id: string; name: string; company: string | null; title: string | null; client_id: string | null }>,
      }
    },
  })
}
