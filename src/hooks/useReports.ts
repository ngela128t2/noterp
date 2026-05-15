import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface MonthlyStats {
  month: string        // 'YYYY-MM'
  memoCount: number
  newClients: number
  completedProjects: number
  billedAmount: number
  paidAmount: number
  deadlineTotal: number
  deadlineDone: number
}

export interface ClientBillingRow {
  client_id: string
  client_name: string
  totalBilled: number
  totalPaid: number
  pendingAmount: number
  contractCount: number
}

export interface ProjectStatusRow {
  status: string
  count: number
}

export interface DeadlineComplianceRow {
  template_name: string
  total: number
  completed: number
  overdue: number
}

export function useMonthlyStats(months = 6) {
  return useQuery({
    queryKey: ['reports_monthly', months],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const results: MonthlyStats[] = []

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(1)
        d.setMonth(d.getMonth() - i)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const first = `${y}-${m}-01`
        const last = new Date(y, d.getMonth() + 1, 0).toISOString().split('T')[0]
        const monthStr = `${y}-${m}`

        const [memos, clients, projects, billing, deadlines] = await Promise.all([
          supabase.from('memos').select('id', { count: 'exact' })
            .gte('created_at', `${first}T00:00:00`)
            .lte('created_at', `${last}T23:59:59`),
          supabase.from('clients').select('id', { count: 'exact' })
            .gte('created_at', `${first}T00:00:00`)
            .lte('created_at', `${last}T23:59:59`),
          supabase.from('projects').select('id', { count: 'exact' })
            .eq('status', 'completed')
            .gte('created_at', `${first}T00:00:00`)
            .lte('created_at', `${last}T23:59:59`),
          supabase.from('billing_records').select('amount, status')
            .gte('billed_at', first)
            .lte('billed_at', last),
          supabase.from('deadline_instances').select('completed, due_date')
            .gte('due_date', first)
            .lte('due_date', last),
        ])

        const billingRows = billing.data ?? []
        const today = new Date().toISOString().split('T')[0]
        const deadlineRows = deadlines.data ?? []

        results.push({
          month: monthStr,
          memoCount: memos.count ?? 0,
          newClients: clients.count ?? 0,
          completedProjects: projects.count ?? 0,
          billedAmount: billingRows
            .filter(r => ['billed', 'paid'].includes(r.status))
            .reduce((s, r) => s + Number(r.amount), 0),
          paidAmount: billingRows
            .filter(r => r.status === 'paid')
            .reduce((s, r) => s + Number(r.amount), 0),
          deadlineTotal: deadlineRows.length,
          deadlineDone: deadlineRows.filter(r => r.completed || r.due_date >= today).length,
        })
      }

      return results
    },
  })
}

export function useClientBillingReport() {
  return useQuery({
    queryKey: ['reports_client_billing'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [contracts, records] = await Promise.all([
        supabase
          .from('billing_contracts')
          .select('id, client_id, clients(name)')
          .order('client_id'),
        supabase
          .from('billing_records')
          .select('client_id, amount, status, clients(name)')
          .in('status', ['billed', 'paid', 'overdue']),
      ])

      const map = new Map<string, ClientBillingRow>()

      for (const c of (contracts.data ?? []) as any[]) {
        if (!map.has(c.client_id)) {
          map.set(c.client_id, {
            client_id: c.client_id,
            client_name: c.clients?.name ?? '-',
            totalBilled: 0, totalPaid: 0, pendingAmount: 0, contractCount: 0,
          })
        }
        map.get(c.client_id)!.contractCount++
      }

      for (const r of (records.data ?? []) as any[]) {
        if (!map.has(r.client_id)) {
          map.set(r.client_id, {
            client_id: r.client_id,
            client_name: r.clients?.name ?? '-',
            totalBilled: 0, totalPaid: 0, pendingAmount: 0, contractCount: 0,
          })
        }
        const row = map.get(r.client_id)!
        if (['billed', 'paid'].includes(r.status)) row.totalBilled += Number(r.amount)
        if (r.status === 'paid') row.totalPaid += Number(r.amount)
        if (['billed', 'overdue'].includes(r.status)) row.pendingAmount += Number(r.amount)
      }

      return Array.from(map.values()).sort((a, b) => b.totalBilled - a.totalBilled)
    },
  })
}

export function useProjectStatusReport() {
  return useQuery({
    queryKey: ['reports_project_status'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('status')
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const p of data ?? []) {
        counts[p.status] = (counts[p.status] ?? 0) + 1
      }
      const STATUS_ORDER = ['preparing', 'in_progress', 'review', 'completed']
      return STATUS_ORDER
        .filter(s => counts[s])
        .map(s => ({ status: s, count: counts[s] })) as ProjectStatusRow[]
    },
  })
}

export function useDeadlineComplianceReport() {
  return useQuery({
    queryKey: ['reports_deadline_compliance'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('deadline_instances')
        .select('completed, due_date, deadline_templates(name)')
      if (error) throw error

      const map = new Map<string, DeadlineComplianceRow>()

      for (const row of (data ?? []) as any[]) {
        const name = row.deadline_templates?.name ?? '(템플릿 없음)'
        if (!map.has(name)) {
          map.set(name, { template_name: name, total: 0, completed: 0, overdue: 0 })
        }
        const entry = map.get(name)!
        entry.total++
        if (row.completed) entry.completed++
        else if (row.due_date < today) entry.overdue++
      }

      return Array.from(map.values()).sort((a, b) => b.total - a.total)
    },
  })
}
