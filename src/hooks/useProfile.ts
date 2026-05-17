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
      const meta = user.user_metadata ?? {}
      // Google OAuth는 'name', 'full_name', 'given_name+family_name' 중 하나로 줍니다
      const googleName = (meta.full_name as string)
        ?? (meta.name as string)
        ?? [meta.given_name, meta.family_name].filter(Boolean).join(' ')
        ?? null
      const avatar = (meta.avatar_url as string) ?? (meta.picture as string) ?? null
      const provider = (user.app_metadata?.provider as string) ?? null
      return {
        id: user.id,
        email: user.email ?? (meta.email as string) ?? '',
        full_name: data?.full_name ?? googleName ?? null,
        company:   data?.company   ?? (meta.company as string) ?? null,
        role:      data?.role      ?? (meta.role    as string) ?? null,
        phone:     data?.phone     ?? (meta.phone   as string) ?? null,
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
