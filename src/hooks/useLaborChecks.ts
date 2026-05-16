import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type LaborCheck = {
  id: string
  client_id: string
  employee_count: number
  new_hire: boolean
  resignation: boolean
  contract_status: '완료' | '일부' | '미확인'
  has_salary_ledger: boolean
  insurance_filed: boolean
  annual_leave_issue: boolean
  memo: string | null
  updated_at: string
}

export function useLaborCheck(clientId: string) {
  return useQuery({
    queryKey: ['labor_check', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labor_checks')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      if (error) throw error
      return data as LaborCheck | null
    },
    enabled: !!clientId,
  })
}

export function useAllLaborChecks() {
  return useQuery({
    queryKey: ['labor_checks_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labor_checks')
        .select('*, clients(name)')
      if (error) throw error
      return data as (LaborCheck & { clients: { name: string } | null })[]
    },
  })
}

export function useUpsertLaborCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<LaborCheck> & { client_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('labor_checks')
        .upsert({ ...input, user_id: user!.id, updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['labor_check', vars.client_id] })
      qc.invalidateQueries({ queryKey: ['labor_checks_all'] })
    },
  })
}
