import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { BillingContract, BillingRecord } from '../types'

type ContractWithClient = BillingContract & { clients: { name: string } | null }
type RecordWithLinks = BillingRecord & {
  clients: { name: string } | null
  billing_contracts: { service_category: string; billing_cycle: string } | null
}

export function useBillingContracts() {
  return useQuery({
    queryKey: ['billing_contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_contracts')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ContractWithClient[]
    },
  })
}

export function useBillingRecords(filters?: { status?: string; month?: string }) {
  return useQuery({
    queryKey: ['billing_records', filters],
    queryFn: async () => {
      let q = supabase
        .from('billing_records')
        .select('*, clients(name), billing_contracts(service_category, billing_cycle)')
        .order('billed_at', { ascending: false })
      if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status)
      if (filters?.month) {
        const [y, m] = filters.month.split('-')
        const first = `${y}-${m}-01`
        const last = new Date(Number(y), Number(m), 0).toISOString().split('T')[0]
        q = q.gte('billed_at', first).lte('billed_at', last)
      }
      const { data, error } = await q
      if (error) throw error
      return data as RecordWithLinks[]
    },
  })
}

export function useBillingDashboardStats() {
  return useQuery({
    queryKey: ['billing_dashboard'],
    queryFn: async () => {
      const today = new Date()
      const y = today.getFullYear()
      const m = String(today.getMonth() + 1).padStart(2, '0')
      const first = `${y}-${m}-01`
      const last = new Date(y, today.getMonth() + 1, 0).toISOString().split('T')[0]

      const [monthly, unpaid] = await Promise.all([
        supabase
          .from('billing_records')
          .select('amount')
          .in('status', ['billed', 'paid'])
          .gte('billed_at', first)
          .lte('billed_at', last),
        supabase
          .from('billing_records')
          .select('amount')
          .in('status', ['billed', 'overdue']),
      ])

      const sum = (rows: { amount: number }[] | null) =>
        (rows ?? []).reduce((acc, r) => acc + Number(r.amount), 0)

      return {
        billingMonthly: sum(monthly.data),
        unpaidAmount: sum(unpaid.data),
      }
    },
  })
}

export function useCreateBillingContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<BillingContract, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('billing_contracts')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as BillingContract
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing_contracts'] }),
  })
}

export function useUpdateBillingContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<BillingContract> & { id: string }) => {
      const { data, error } = await supabase
        .from('billing_contracts')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as BillingContract
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing_contracts'] }),
  })
}

export function useDeleteBillingContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('billing_contracts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing_contracts'] })
      qc.invalidateQueries({ queryKey: ['billing_records'] })
    },
  })
}

export function useCreateBillingRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<BillingRecord, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('billing_records')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as BillingRecord
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing_records'] })
      qc.invalidateQueries({ queryKey: ['billing_dashboard'] })
    },
  })
}

export function useUpdateBillingRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<BillingRecord> & { id: string }) => {
      const { data, error } = await supabase
        .from('billing_records')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as BillingRecord
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing_records'] })
      qc.invalidateQueries({ queryKey: ['billing_dashboard'] })
    },
  })
}

export function useDeleteBillingRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('billing_records').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing_records'] })
      qc.invalidateQueries({ queryKey: ['billing_dashboard'] })
    },
  })
}
