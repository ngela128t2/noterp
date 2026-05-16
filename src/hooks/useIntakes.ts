import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type IntakeDocuments = {
  application?: boolean
  business_license?: boolean
  id_card?: boolean
  bank_account?: boolean
  consultation_memo?: boolean
}

export type TaxIntake = {
  id: string
  user_id: string
  status: 'receiving' | 'reviewing' | 'approved' | 'rejected'
  source: string | null
  client_name: string | null
  business_number: string | null
  representative: string | null
  phone: string | null
  email: string | null
  address: string | null
  entity_type: string | null
  tax_type: string | null
  service_detail: string | null
  bookkeeping_fee: number | null
  withdrawal_day: number | null
  bank_info: string | null
  documents: IntakeDocuments
  risk_points: string[]
  notes: string | null
  client_id: string | null
  created_at: string
  updated_at: string
}

export const INTAKE_STATUS_LABEL: Record<TaxIntake['status'], string> = {
  receiving: '접수중',
  reviewing: '검토중',
  approved: '승인완료',
  rejected: '거절',
}
export const INTAKE_STATUS_COLOR: Record<TaxIntake['status'], string> = {
  receiving: 'bg-blue-100 text-blue-600',
  reviewing: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-gray-100 text-gray-500',
}

export const INTAKE_DOCS: Array<{ key: keyof IntakeDocuments; label: string }> = [
  { key: 'application',       label: '세무대리 신청서' },
  { key: 'business_license',  label: '사업자등록증' },
  { key: 'id_card',           label: '대표자 신분증' },
  { key: 'bank_account',      label: '통장 사본' },
  { key: 'consultation_memo', label: '상담 메모' },
]

export const INTAKE_SOURCES = ['다울', '카톡', '메일', '직접방문', '기타']

export function useIntakes() {
  return useQuery({
    queryKey: ['tax_intakes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_intakes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as TaxIntake[]
    },
  })
}

export function useIntake(id: string) {
  return useQuery({
    queryKey: ['tax_intake', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_intakes')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as TaxIntake
    },
    enabled: !!id,
  })
}

export function useCreateIntake() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Pick<TaxIntake, 'client_name' | 'source'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('tax_intakes')
        .insert({ ...input, user_id: user!.id, documents: {}, risk_points: [] })
        .select()
        .single()
      if (error) throw error
      return data as TaxIntake
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax_intakes'] }),
  })
}

export function useUpdateIntake() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<TaxIntake> & { id: string }) => {
      const { error } = await supabase
        .from('tax_intakes')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tax_intake', vars.id] })
      qc.invalidateQueries({ queryKey: ['tax_intakes'] })
    },
  })
}

export function useApproveIntake() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (intake: TaxIntake) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          user_id: user!.id,
          name: intake.client_name ?? '미입력',
          business_number: intake.business_number ?? null,
          representative: intake.representative ?? null,
          contact_phone: intake.phone ?? null,
          contact_email: intake.email ?? null,
          address: intake.address ?? null,
          entity_type: intake.entity_type ?? null,
          tax_type: intake.tax_type ?? null,
          service_category: '세무대리',
          service_detail: intake.service_detail ?? null,
          memo: intake.notes ?? null,
          needs_review: true,
          source: 'intake',
        })
        .select('id')
        .single()
      if (clientError) throw clientError

      const { error: updateError } = await supabase
        .from('tax_intakes')
        .update({ status: 'approved', client_id: client.id, updated_at: new Date().toISOString() })
        .eq('id', intake.id)
      if (updateError) throw updateError

      return client.id as string
    },
    onSuccess: (_, intake) => {
      qc.invalidateQueries({ queryKey: ['tax_intake', intake.id] })
      qc.invalidateQueries({ queryKey: ['tax_intakes'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
