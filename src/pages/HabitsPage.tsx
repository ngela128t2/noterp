import { useState } from 'react'
import { Flame, Plus, Repeat, Settings, Trash2, X } from 'lucide-react'
import {
  useHabits, useTodayHabitLogs, useCompleteHabit, useUncompleteHabit,
  useCreateHabit, useUpdateHabit, useDeleteHabit,
  isScheduledToday, isStreakAlive, repeatLabel,
  HABIT_CATEGORIES, HABIT_COLORS, COLOR_CLASS, DAY_LABELS,
  type Habit, type HabitColor, type RepeatRule,
} from '../hooks/useHabits'
import { getLocalDate } from '../lib/dateUtils'

const today = getLocalDate()
const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']
const DOW = new Date().getDay()

export default function HabitsPage() {
  const { data: habits = [] } = useHabits()
  const { data: logs = [] } = useTodayHabitLogs()
  const complete = useCompleteHabit()
  const uncomplete = useUncompleteHabit()
  const createHabit = useCreateHabit()
  const updateHabit = useUpdateHabit()
  const deleteHabit = useDeleteHabit()

  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Habit | null>(null)
  const [showAll, setShowAll] = useState(false)

  const completedIds = new Set(logs.map(l => l.habit_id))
  const todayHabits = habits.filter(isScheduledToday)
  const doneCount = todayHabits.filter(h => completedIds.has(h.id)).length

  const handleToggle = (habit: Habit) => {
    if (completedIds.has(habit.id)) {
      uncomplete.mutate(habit)
    } else {
      complete.mutate({ habit })
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('이 습관을 삭제할까요?')) deleteHabit.mutate(id)
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg lg:text-2xl font-bold text-gray-900">습관 루틴</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {DAY_KO[DOW]}요일 · {doneCount}/{todayHabits.length}개 완료
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg"
        >
          <Plus size={14} /> 습관 추가
        </button>
      </div>

      {/* 오늘의 루틴 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">오늘의 루틴</h3>
          {todayHabits.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 bg-gray-100 rounded-full w-24 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: todayHabits.length ? `${(doneCount / todayHabits.length) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-[10px] text-gray-400">{Math.round((doneCount / todayHabits.length) * 100)}%</span>
            </div>
          )}
        </div>

        {todayHabits.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-6 text-center">
            <Repeat size={24} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">오늘 예정된 루틴이 없습니다</p>
            <button onClick={() => setShowForm(true)} className="mt-2 text-xs text-indigo-600 hover:underline">
              첫 습관 만들기 →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {todayHabits.map(habit => (
              <HabitRow
                key={habit.id}
                habit={habit}
                done={completedIds.has(habit.id)}
                onToggle={() => handleToggle(habit)}
                onEdit={() => { setEditTarget(habit); setShowForm(true) }}
                onDelete={() => handleDelete(habit.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 전체 습관 (오늘 스케줄 외) */}
      {habits.filter(h => !isScheduledToday(h)).length > 0 && (
        <section>
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1"
          >
            <Settings size={11} />
            오늘 외 습관 {showAll ? '숨기기' : `보기 (${habits.filter(h => !isScheduledToday(h)).length}개)`}
          </button>
          {showAll && (
            <div className="space-y-2">
              {habits.filter(h => !isScheduledToday(h)).map(habit => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  done={completedIds.has(habit.id)}
                  onToggle={() => handleToggle(habit)}
                  onEdit={() => { setEditTarget(habit); setShowForm(true) }}
                  onDelete={() => handleDelete(habit.id)}
                  dim
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 습관 추가/수정 폼 */}
      {showForm && (
        <HabitForm
          initial={editTarget}
          onSave={async (data) => {
            if (editTarget) await updateHabit.mutateAsync({ id: editTarget.id, ...data })
            else await createHabit.mutateAsync(data as any)
            setShowForm(false)
            setEditTarget(null)
          }}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
        />
      )}
    </div>
  )
}

// ─── 습관 행 ──────────────────────────────────────────────────────────────────

function HabitRow({
  habit, done, onToggle, onEdit, onDelete, dim = false,
}: {
  habit: Habit; done: boolean; onToggle: () => void
  onEdit: () => void; onDelete: () => void; dim?: boolean
}) {
  const cl = COLOR_CLASS[habit.color]
  const alive = isStreakAlive(habit)

  return (
    <div className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 border transition-all ${
      done ? 'border-gray-100' : dim ? 'border-gray-100 opacity-50' : 'border-gray-200'
    }`}>
      {/* 체크박스 */}
      <button
        onClick={onToggle}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          done
            ? `${cl.dot} border-transparent`
            : `border-gray-300 hover:border-gray-400`
        }`}
      >
        {done && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </button>

      {/* 컬러 도트 */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${cl.dot}`} />

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {habit.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-400">{repeatLabel(habit)}</span>
          {habit.target_time && <span className="text-[10px] text-gray-400">{habit.target_time}</span>}
          {habit.category && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${cl.bg} ${cl.text}`}>{habit.category}</span>
          )}
        </div>
      </div>

      {/* streak */}
      {habit.streak > 0 && (
        <div className={`flex items-center gap-0.5 ${alive ? 'text-orange-500' : 'text-gray-300'}`}>
          <Flame size={12} />
          <span className="text-xs font-bold">{habit.streak}</span>
        </div>
      )}

      {/* 액션 */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button onClick={onEdit} className="p-1 text-gray-300 hover:text-gray-500 rounded">
          <Settings size={12} />
        </button>
        <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-400 rounded">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── 습관 폼 ──────────────────────────────────────────────────────────────────

function HabitForm({
  initial, onSave, onClose,
}: {
  initial: Habit | null
  onSave: (data: Partial<Habit>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    category: initial?.category ?? '',
    color: (initial?.color ?? 'indigo') as HabitColor,
    repeat_rule: (initial?.repeat_rule ?? 'daily') as RepeatRule,
    repeat_days: initial?.repeat_days ?? [] as number[],
    target_time: initial?.target_time ?? '',
    is_active: initial?.is_active ?? true,
    sort_order: initial?.sort_order ?? 0,
  })
  const [saving, setSaving] = useState(false)

  const toggleDay = (d: number) =>
    setForm(f => ({
      ...f,
      repeat_days: f.repeat_days.includes(d)
        ? f.repeat_days.filter(x => x !== d)
        : [...f.repeat_days, d].sort(),
    }))

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        category: form.category || null,
        target_time: form.target_time || null,
        repeat_days: form.repeat_rule === 'custom' ? form.repeat_days : null,
      })
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">{initial ? '습관 수정' : '습관 추가'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* 제목 */}
        <input
          autoFocus
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="습관 이름 (예: 새벽 러닝)"
          className={inputCls}
        />

        {/* 카테고리 + 시간 */}
        <div className="grid grid-cols-2 gap-2">
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
            <option value="">카테고리 없음</option>
            {HABIT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <input
            type="time"
            value={form.target_time}
            onChange={e => setForm(f => ({ ...f, target_time: e.target.value }))}
            className={inputCls}
          />
        </div>

        {/* 반복 규칙 */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">반복</label>
          <div className="flex gap-1.5 flex-wrap">
            {(['daily', 'weekdays', 'weekends', 'custom'] as RepeatRule[]).map(rule => (
              <button
                key={rule}
                onClick={() => setForm(f => ({ ...f, repeat_rule: rule }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  form.repeat_rule === rule
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {rule === 'daily' ? '매일' : rule === 'weekdays' ? '평일' : rule === 'weekends' ? '주말' : '직접 선택'}
              </button>
            ))}
          </div>
          {form.repeat_rule === 'custom' && (
            <div className="flex gap-1.5 mt-2">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                    form.repeat_days.includes(i)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 색상 */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">색상</label>
          <div className="flex gap-2">
            {HABIT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setForm(f => ({ ...f, color: c }))}
                className={`w-7 h-7 rounded-full ${COLOR_CLASS[c].dot} transition-transform ${
                  form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-60 hover:opacity-100'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg">취소</button>
          <button
            onClick={handleSave}
            disabled={!form.title.trim() || saving}
            className="flex-1 py-2.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
