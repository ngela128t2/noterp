import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

      const y = today.getFullYear()
      const m = String(today.getMonth() + 1).padStart(2, '0')
      const firstOfMonth = `${y}-${m}-01`
      const lastOfMonth = new Date(y, today.getMonth() + 1, 0).toISOString().split('T')[0]

      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

      const [projects, clients, events, todos, billingMonthly, unpaid, deadlines] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact' }).in('status', ['preparing', 'in_progress', 'review']),
        supabase.from('clients').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('calendar_events').select('id, title, date, time, location, client_id, project_id, clients(name), projects(name)').gte('date', todayStr).lte('date', weekEnd).order('date').order('time'),
        supabase.from('todos').select('id, title, due_date, priority, completed, client_id, project_id, clients(name)').eq('completed', false).order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('billing_records').select('amount').in('status', ['billed', 'paid']).gte('billed_at', firstOfMonth).lte('billed_at', lastOfMonth),
        supabase.from('billing_records').select('amount').in('status', ['billed', 'overdue']),
        supabase.from('deadline_instances').select('due_date').eq('completed', false).lte('due_date', in30),
      ])

      const sumAmount = (rows: { amount: number }[] | null) =>
        (rows ?? []).reduce((acc, r) => acc + Number(r.amount), 0)

      return {
        projectCount: projects.count ?? 0,
        clientCount: clients.count ?? 0,
        weekEvents: events.data ?? [],
        pendingTodos: todos.data ?? [],
        todayTodos: (todos.data ?? []).filter((t: any) => t.due_date === todayStr),
        todayEvents: (events.data ?? []).filter((e: any) => e.date === todayStr),
        billingMonthly: sumAmount(billingMonthly.data),
        unpaidAmount: sumAmount(unpaid.data),
        deadlineStats: {
          overdue: (deadlines.data ?? []).filter(r => r.due_date < todayStr).length,
          upcoming: (deadlines.data ?? []).filter(r => r.due_date >= todayStr).length,
        },
      }
    },
  })
}
