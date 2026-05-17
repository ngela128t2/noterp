import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type Profile = {
  id: string
  full_name: string | null
  company: string | null
  role: string | null
  phone: string | null
  email: string
  avatar_url: string | null
  provider: string | null
}

async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('로그인이 필요합니다.')
  return user
}

// 빈 문자열·공백만 있는 문자열을 null로 정규화 (?? 가 빈 문자열을 통과시키는 문제 해결)
const norm = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<Profile> => {
      const user = await getCurrentUser()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (error) throw error
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>
      // Google OAuth: name / full_name / given_name + family_name 중 하나
      const googleName =
        norm(meta.full_name) ||
        norm(meta.name) ||
        norm([meta.given_name, meta.family_name].filter(Boolean).join(' '))
      const avatar = norm(meta.avatar_url) || norm(meta.picture)
      const provider = norm(user.app_metadata?.provider)
      return {
        id: user.id,
        email: norm(user.email) || norm(meta.email) || '',
        full_name: norm(data?.full_name) || googleName,
        company:   norm(data?.company)   || norm(meta.company),
        role:      norm(data?.role)      || norm(meta.role),
        phone:     norm(data?.phone)     || norm(meta.phone),
        avatar_url: avatar,
        provider,
      }
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<Omit<Profile, 'id' | 'email'>>) => {
      const user = await getCurrentUser()
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...values, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  })
}

export function useUpdateEmail() {
  return useMutation({
    mutationFn: async (newEmail: string) => {
      const { error } = await supabase.auth.updateUser({ email: newEmail })
      if (error) throw error
    },
  })
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const user = await getCurrentUser()
      if (!user.email) throw new Error('이메일 정보를 찾을 수 없습니다.')
      // 현재 비밀번호 확인
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInError) throw new Error('현재 비밀번호가 올바르지 않습니다.')
      // 새 비밀번호로 변경
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
    },
  })
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (currentPassword: string) => {
      const user = await getCurrentUser()
      if (!user.email) throw new Error('이메일 정보를 찾을 수 없습니다.')
      // 비밀번호 재확인
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInError) throw new Error('비밀번호가 올바르지 않습니다.')
      // Edge Function 호출
      const { error } = await supabase.functions.invoke('delete-account')
      if (error) throw new Error('계정 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    },
  })
}
