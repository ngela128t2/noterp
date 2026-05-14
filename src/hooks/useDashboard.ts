import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const [projects, clients, events, todos] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact' }).in('status', ['preparing', 'in_progress', 'review']),
        supabase.from('clients').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('calendar_events').select('id, title, date, time, location, clients(name)').gte('date', today).lte('date', weekEnd).order('date').order('time'),
        supabase.from('todos').select('id, title, due_date, priority, completed, clients(name)').eq('completed', false).order('due_date', { ascending: true, nullsFirst: false }),
      ])

      return {
        projectCount: projects.count ?? 0,
        clientCount: clients.count ?? 0,
        weekEvents: events.data ?? [],
        pendingTodos: todos.data ?? [],
        todayTodos: (todos.data ?? []).filter(t => t.due_date === today),
        todayEvents: (events.data ?? []).filter(e => e.date === today),
      }
    },
  })
}
