import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getLocalDate } from '../lib/dateUtils'

export type TaxTask = {
  id: string
  client_id: string
  month: string
  task_type: '원천세' | '부가세' | '법인세' | '종소세' | '기장'
  status: '대기' | '요청함' | '일부수신' | '완료' | '해당없음' | '지연' | '위험'
  due_date: string | null
  requested_at: string | null
  received_at: string | null
  memo: string | null
  created_at: string
}

const STATUS_COLOR: Record<TaxTask['status'], string> = {
  '대기':     'bg-gray-100 text-gray-500',
  '요청함':   'bg-blue-100 text-blue-600',
  '일부수신': 'bg-amber-100 text-amber-600',
  '완료':     'bg-emerald-100 text-emerald-700',
  '해당없음': 'bg-gray-50 text-gray-400',
  '지연':     'bg-orange-100 text-orange-600',
  '위험':     'bg-red-100 text-red-600',
}
export { STATUS_COLOR as TAX_STATUS_COLOR }

export const TAX_STATUSES: TaxTask['status'][] = ['대기', '요청함', '일부수신', '완료', '해당없음', '지연', '위험']
export const TAX_TYPES: TaxTask['task_type'][] = ['기장', '원천세', '부가세', '법인세', '종소세']

export function useTaxTasks(clientId: string) {
  return useQuery({
    queryKey: ['tax_tasks', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_tasks')
        .select('*')
        .eq('client_id', clientId)
        .order('month', { ascending: false })
      if (error) throw error
      return data as TaxTask[]
    },
    enabled: !!clientId,
  })
}

export function useAllTaxTasks() {
  return useQuery({
    queryKey: ['tax_tasks_all'],
    queryFn: async () => {
      const today = getLocalDate()
      const thisMonth = today.slice(0, 7)
      const { data, error } = await supabase
        .from('tax_tasks')
        .select('*, clients(name, service_detail)')
        .eq('month', thisMonth)
      if (error) throw error
      return data as (TaxTask & { clients: { name: string; service_detail: string | null } | null })[]
    },
  })
}

export function useUpsertTaxTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<TaxTask, 'id' | 'created_at'> & { id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (input.id) {
        const { error } = await supabase.from('tax_tasks').update(input).eq('id', input.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('tax_tasks').insert({ ...input, user_id: user!.id })
        if (error) throw error
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tax_tasks', vars.client_id] })
      qc.invalidateQueries({ queryKey: ['tax_tasks_all'] })
    },
  })
}

export function useGenerateTaxTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (month?: string) => {
      const { data, error } = await supabase.rpc('generate_monthly_tax_tasks', {
        target_month: month ?? null,
      })
      if (error) throw error
      return data as { month: string; status: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax_tasks_all'] })
      qc.invalidateQueries({ queryKey: ['tax_tasks'] })
    },
  })
}

export function useUpdateTaxStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, clientId }: { id: string; status: TaxTask['status']; clientId: string }) => {
      const { error } = await supabase.from('tax_tasks').update({ status }).eq('id', id)
      if (error) throw error
      return clientId
    },
    onSuccess: (clientId) => {
      qc.invalidateQueries({ queryKey: ['tax_tasks', clientId] })
      qc.invalidateQueries({ queryKey: ['tax_tasks_all'] })
    },
  })
}
