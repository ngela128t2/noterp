import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getLocalDate } from '../lib/dateUtils'

export type Habit = {
  id: string
  user_id: string
  title: string
  category: string | null
  color: HabitColor
  repeat_rule: RepeatRule
  repeat_days: number[] | null
  target_time: string | null
  linked_project_id: string | null
  streak: number
  best_streak: number
  last_completed_at: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export type HabitLog = {
  id: string
  habit_id: string
  completed_at: string
  note: string | null
}

export type HabitColor = 'indigo' | 'emerald' | 'amber' | 'red' | 'purple' | 'pink' | 'blue'
export type RepeatRule = 'daily' | 'weekdays' | 'weekends' | 'custom'

export const HABIT_CATEGORIES = ['운동', '독서', '업무', '건강', '학습', '명상', '기타']
export const HABIT_COLORS: HabitColor[] = ['indigo', 'emerald', 'amber', 'red', 'purple', 'pink', 'blue']
export const COLOR_CLASS: Record<HabitColor, { bg: string; text: string; ring: string; dot: string }> = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200', dot: 'bg-indigo-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', dot: 'bg-amber-500' },
  red: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', dot: 'bg-red-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-200', dot: 'bg-purple-500' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-700', ring: 'ring-pink-200', dot: 'bg-pink-500' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200', dot: 'bg-blue-500' },
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
export { DAY_LABELS }

export function isScheduledToday(habit: Habit): boolean {
  const day = new Date().getDay() // 0=일 6=토
  switch (habit.repeat_rule) {
    case 'daily':    return true
    case 'weekdays': return day >= 1 && day <= 5
    case 'weekends': return day === 0 || day === 6
    case 'custom':   return habit.repeat_days?.includes(day) ?? false
  }
}

export function repeatLabel(habit: Habit): string {
  switch (habit.repeat_rule) {
    case 'daily':    return '매일'
    case 'weekdays': return '평일'
    case 'weekends': return '주말'
    case 'custom':
      return (habit.repeat_days ?? []).map(d => DAY_LABELS[d]).join('·') || '사용자 설정'
  }
}

// 오늘 기준 streak이 살아있는지 (어제 또는 오늘 완료)
export function isStreakAlive(habit: Habit): boolean {
  if (!habit.last_completed_at) return false
  const today = getLocalDate()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yd = yesterday.toISOString().split('T')[0]
  return habit.last_completed_at === today || habit.last_completed_at === yd
}

export function useHabits() {
  return useQuery({
    queryKey: ['habits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return data as Habit[]
    },
  })
}

export function useTodayHabitLogs() {
  const today = getLocalDate()
  return useQuery({
    queryKey: ['habit_logs', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('habit_id, completed_at, note')
        .eq('completed_at', today)
      if (error) throw error
      return data as HabitLog[]
    },
  })
}

export function useHabitLogsRange(habitId: string, days = 30) {
  return useQuery({
    queryKey: ['habit_logs_range', habitId, days],
    queryFn: async () => {
      const from = new Date()
      from.setDate(from.getDate() - days)
      const { data, error } = await supabase
        .from('habit_logs')
        .select('completed_at')
        .eq('habit_id', habitId)
        .gte('completed_at', from.toISOString().split('T')[0])
        .order('completed_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map(l => l.completed_at as string)
    },
    enabled: !!habitId,
  })
}

export function useCompleteHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ habit, note }: { habit: Habit; note?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const today = getLocalDate()

      // habit_logs upsert
      const { error: logError } = await supabase
        .from('habit_logs')
        .upsert({ user_id: user!.id, habit_id: habit.id, completed_at: today, note: note ?? null },
          { onConflict: 'habit_id,completed_at' })
      if (logError) throw logError

      // streak 계산
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yd = yesterday.toISOString().split('T')[0]
      let newStreak = 1
      if (habit.last_completed_at === yd) newStreak = habit.streak + 1
      else if (habit.last_completed_at === today) newStreak = habit.streak // 이미 오늘 완료
      const newBest = Math.max(newStreak, habit.best_streak)

      const { error: updateError } = await supabase
        .from('habits')
        .update({ streak: newStreak, best_streak: newBest, last_completed_at: today })
        .eq('id', habit.id)
      if (updateError) throw updateError

      // 타임라인 기록 (activity_log)
      await supabase.from('activity_logs').insert({
        user_id: user!.id,
        action: 'habit_done',
        entity_type: 'habit',
        entity_id: habit.id,
        entity_name: habit.title,
        detail: { streak: newStreak, note: note ?? null },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habits'] })
      qc.invalidateQueries({ queryKey: ['habit_logs'] })
    },
  })
}

export function useUncompleteHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (habit: Habit) => {
      const today = getLocalDate()
      const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habit.id)
        .eq('completed_at', today)
      if (error) throw error
      // streak 1 감소 (최소 0)
      await supabase.from('habits').update({
        streak: Math.max(0, habit.streak - 1),
        last_completed_at: habit.streak > 1 ? habit.last_completed_at : null,
      }).eq('id', habit.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habits'] })
      qc.invalidateQueries({ queryKey: ['habit_logs'] })
    },
  })
}

export function useCreateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<Habit, 'id' | 'user_id' | 'streak' | 'best_streak' | 'last_completed_at' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('habits').insert({ ...input, user_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  })
}

export function useUpdateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Habit> & { id: string }) => {
      const { error } = await supabase.from('habits').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  })
}

export function useDeleteHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('habits').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  })
}
