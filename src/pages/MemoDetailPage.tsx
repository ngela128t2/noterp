import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Building2, FolderKanban, CalendarDays, CheckSquare, Target, ChevronDown, Pencil, Trash2, Plus } from 'lucide-react'
import { useMemoDetail, useMemoDerived, type DerivedTodo, type DerivedEvent } from '../hooks/useMemoDetail'
import { useToggleTodo, useSnoozeTodo, useUpdateTodo, useDeleteTodo, useCreateTodo } from '../hooks/useTodos'
import { useCompleteCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent } from '../hooks/useCalendarEvents'
import { supabase } from '../lib/supabase'

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${month}월 ${day}일 (${days[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function shortDate(date: string | null) {
  if (!date) return null
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const PRIORITY_BADGE: Record<string, { cls: string; label: string }> = {
  high:   { cls: 'bg-rose-50 text-rose-600 border-rose-200', label: '높음' },
  medium: { cls: 'bg-amber-50 text-amber-600 border-amber-200', label: '보통' },
  low:    { cls: 'bg-gray-50 text-gray-500 border-gray-200', label: '낮음' },
}

export default function MemoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showRaw, setShowRaw] = useState(false)

  const { data: memo, isLoading } = useMemoDetail(id)
  const { data: derived } = useMemoDerived(id)

  // 메모 삭제 — 파생된 할 일/일정/마일스톤도 함께 삭제
  const deleteMemo = useMutation({
    mutationFn: async () => {
      if (!id) return
      // 순서: 파생 항목 먼저 (FK 안전), 그 다음 memos
      await supabase.from('milestones').delete().eq('memo_id', id)
      await supabase.from('calendar_events').delete().eq('memo_id', id)
      await supabase.from('todos').delete().eq('memo_id', id)
      const { error } = await supabase.from('memos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity_stream'] })
      qc.invalidateQueries({ queryKey: ['todos'] })
      qc.invalidateQueries({ queryKey: ['calendar_events'] })
      qc.invalidateQueries({ queryKey: ['dashboard_stats'] })
      navigate('/', { replace: true })
    },
  })

  const handleDeleteMemo = () => {
    const todoCount = derived?.todos.length ?? 0
    const eventCount = derived?.events.length ?? 0
    const milestoneCount = derived?.milestones.length ?? 0
    const total = todoCount + eventCount + milestoneCount
    const msg = total > 0
      ? `이 메모와 함께 생성된 ${total}개 항목(할 일 ${todoCount} · 일정 ${eventCount} · 마일스톤 ${milestoneCount})이 모두 삭제됩니다. 계속하시겠습니까?`
      : '이 메모를 삭제하시겠습니까?'
    if (!confirm(msg)) return
    deleteMemo.mutate()
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!memo) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 mb-4">
          <ArrowLeft size={14} /> 돌아가기
        </button>
        <p className="text-sm text-gray-400">메모를 찾을 수 없습니다.</p>
      </div>
    )
  }

  const clients = derived?.clients ?? []
  const projects = derived?.projects ?? []
  const todos = derived?.todos ?? []
  const events = derived?.events ?? []
  const milestones = derived?.milestones ?? []
  const hasAny = clients.length || projects.length || todos.length || events.length || milestones.length

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={14} /> 돌아가기
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-400">{formatDateTime(memo.created_at)}</span>
          <button
            onClick={handleDeleteMemo}
            disabled={deleteMemo.isPending}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-md transition-colors disabled:opacity-40"
            title="메모와 모든 연결 항목 삭제"
          >
            <Trash2 size={11} />
            <span>{deleteMemo.isPending ? '삭제 중...' : '메모 삭제'}</span>
          </button>
        </div>
      </div>

      {/* 메모 본문 카드 */}
      <section className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4">
        <div className="flex items-start gap-2.5">
          <span className="text-base shrink-0">📝</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line break-keep">
              {memo.raw_text}
            </p>
            <button
              onClick={() => setShowRaw(v => !v)}
              className="mt-2 text-[11px] text-gray-400 hover:text-indigo-500 flex items-center gap-1"
            >
              <ChevronDown size={11} className={`transition-transform ${showRaw ? 'rotate-180' : ''}`} />
              AI 분석 원본 {showRaw ? '숨기기' : '보기'}
            </button>
            {showRaw && memo.parsed_result && (
              <pre className="mt-2 text-[10px] text-gray-500 bg-white/60 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(memo.parsed_result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </section>

      {!hasAny && (
        <div className="text-center py-10 text-sm text-gray-400">
          이 메모에서 파생된 항목이 없습니다.
        </div>
      )}

      {/* 연결 거래처 */}
      {clients.length > 0 && (
        <Section icon={<Building2 size={14} className="text-indigo-500" />} title="거래처">
          <div className="flex flex-wrap gap-1.5">
            {clients.map(c => (
              <button
                key={c.id}
                onClick={() => navigate(`/workspace/client/${c.id}`)}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium rounded-lg transition-colors"
              >
                {c.name}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* 연결 프로젝트 */}
      {projects.length > 0 && (
        <Section icon={<FolderKanban size={14} className="text-purple-500" />} title="프로젝트">
          <div className="flex flex-wrap gap-1.5">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/workspace/project/${p.id}`)}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium rounded-lg transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* 할 일 */}
      <TodoSection
        todos={todos}
        memoId={memo.id}
        defaultClientId={clients[0]?.id ?? null}
        defaultProjectId={projects[0]?.id ?? null}
      />

      {/* 일정 */}
      <EventSection
        events={events}
        memoId={memo.id}
        defaultClientId={clients[0]?.id ?? null}
        defaultProjectId={projects[0]?.id ?? null}
      />

      {/* 마일스톤 */}
      {milestones.length > 0 && (
        <Section icon={<Target size={14} className="text-purple-500" />} title={`마일스톤 ${milestones.length}건`}>
          <ul className="divide-y divide-gray-50">
            {milestones.map(m => (
              <li key={m.id} className="py-2 flex items-center gap-2.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.completed ? 'bg-emerald-400' : 'bg-purple-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm break-keep ${m.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{m.title}</p>
                  {m.due_date && <span className="text-[10px] text-gray-400">📅 {shortDate(m.due_date)}</span>}
                </div>
                <button
                  onClick={() => navigate(`/workspace/project/${m.project_id}`)}
                  className="text-[11px] text-gray-300 hover:text-indigo-500 shrink-0"
                >
                  →
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 하단 액션 */}
      <div className="flex justify-end pt-4 pb-8">
        <button
          onClick={() => navigate('/memo')}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
        >
          + 새 메모 작성
        </button>
      </div>
    </div>
  )
}

// ── Todo 행 — 인라인 편집 가능 ─────────────────────────────────────────────
function TodoRow({ todo }: { todo: DerivedTodo }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [dueDate, setDueDate] = useState(todo.due_date ?? '')
  const [priority, setPriority] = useState(todo.priority ?? 'medium')

  const toggleTodo = useToggleTodo()
  const snoozeTodo = useSnoozeTodo()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()

  const badge = todo.priority ? PRIORITY_BADGE[todo.priority] : null

  const cancel = () => {
    setEditing(false)
    setTitle(todo.title)
    setDueDate(todo.due_date ?? '')
    setPriority(todo.priority ?? 'medium')
  }

  const save = () => {
    if (!title.trim()) return
    updateTodo.mutate(
      { id: todo.id, title: title.trim(), due_date: dueDate || null, priority },
      { onSuccess: () => setEditing(false) },
    )
  }

  const remove = () => {
    if (!confirm('이 할 일을 삭제하시겠습니까?')) return
    deleteTodo.mutate(todo.id)
  }

  // ── 수정 모드: 카드 전체가 edit 상태 ──
  if (editing) {
    return (
      <li className="-mx-4 px-4 py-3 bg-indigo-50/40 border-l-2 border-indigo-400">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Pencil size={11} className="text-indigo-500" />
          <span className="text-[11px] font-semibold text-indigo-600">할 일 수정 중</span>
        </div>
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">제목</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">마감일</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">우선순위</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low')}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
              >
                <option value="high">높음</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={cancel}
              className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={updateTodo.isPending || !title.trim()}
              className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-lg transition-colors"
            >
              {updateTodo.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </li>
    )
  }

  // ── 기본 모드 ──
  return (
    <li className="flex items-center gap-2.5 py-2.5">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => toggleTodo.mutate({ id: todo.id, completed: !todo.completed })}
        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm break-keep ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {todo.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
          {todo.due_date && <span>📅 {shortDate(todo.due_date)}</span>}
          {badge && <span className={`px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!todo.completed && (
          <button
            onClick={() => snoozeTodo.mutate({ id: todo.id, days: 1 })}
            className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-1 hidden sm:block"
            title="+1일 미루기"
          >
            +1일
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="text-[11px] text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors"
        >
          수정
        </button>
        <button onClick={remove} className="p-1 text-gray-300 hover:text-red-500 rounded" title="삭제">
          <Trash2 size={12} />
        </button>
      </div>
    </li>
  )
}

// ── Event 행 — 인라인 편집 가능 ───────────────────────────────────────────
function EventRow({ event }: { event: DerivedEvent }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(event.date)
  const [time, setTime] = useState(event.time ?? '')
  const [location, setLocation] = useState(event.location ?? '')

  const completeEvent = useCompleteCalendarEvent()
  const updateEvent = useUpdateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()

  const cancel = () => {
    setEditing(false)
    setTitle(event.title)
    setDate(event.date)
    setTime(event.time ?? '')
    setLocation(event.location ?? '')
  }

  const save = () => {
    if (!title.trim() || !date) return
    updateEvent.mutate(
      {
        id: event.id,
        title: title.trim(),
        date,
        time: time || null,
        location: location.trim() || null,
        client_id: event.client_id,
        project_id: event.project_id,
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  const remove = () => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return
    deleteEvent.mutate(event.id)
  }

  // ── 수정 모드 ──
  if (editing) {
    return (
      <li className="-mx-4 px-4 py-3 bg-indigo-50/40 border-l-2 border-indigo-400">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Pencil size={11} className="text-indigo-500" />
          <span className="text-[11px] font-semibold text-indigo-600">일정 수정 중</span>
        </div>
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">제목</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">날짜</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">시간</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">장소</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="(선택)"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={cancel}
              className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={updateEvent.isPending || !title.trim() || !date}
              className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-lg transition-colors"
            >
              {updateEvent.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </li>
    )
  }

  // ── 기본 모드 ──
  return (
    <li className="flex items-center gap-2.5 py-2.5">
      <input
        type="checkbox"
        checked={event.completed}
        onChange={() => completeEvent.mutate(event.id)}
        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm break-keep ${event.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {event.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
          <span>📅 {shortDate(event.date)}</span>
          {event.time && <span>⏰ {event.time.slice(0, 5)}</span>}
          {event.location && <span className="truncate max-w-[120px]">📍 {event.location}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="text-[11px] text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors"
        >
          수정
        </button>
        <button onClick={remove} className="p-1 text-gray-300 hover:text-red-500 rounded" title="삭제">
          <Trash2 size={12} />
        </button>
      </div>
    </li>
  )
}

// ── Todo 섹션 (목록 + 추가 버튼 + 신규 입력 폼) ────────────────────────
function TodoSection({ todos, memoId, defaultClientId, defaultProjectId }: {
  todos: DerivedTodo[]
  memoId: string
  defaultClientId: string | null
  defaultProjectId: string | null
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const createTodo = useCreateTodo()
  const qc = useQueryClient()

  const reset = () => {
    setAdding(false)
    setTitle('')
    setDueDate('')
    setPriority('medium')
  }

  const save = () => {
    if (!title.trim()) return
    createTodo.mutate(
      {
        user_id: '',   // 훅에서 자동 채움
        title: title.trim(),
        due_date: dueDate || null,
        priority,
        completed: false,
        client_id: defaultClientId,
        project_id: defaultProjectId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        memo_id: memoId,
      } as any,
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['memo', memoId] })
          qc.invalidateQueries({ queryKey: ['activity_stream'] })
          reset()
        },
      },
    )
  }

  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <CheckSquare size={14} className="text-orange-500" />
          <h2 className="text-xs font-semibold text-gray-700">할 일 {todos.length}건</h2>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700">
            <Plus size={11} /> 추가
          </button>
        )}
      </div>
      <ul className="divide-y divide-gray-50">
        {todos.map(t => <TodoRow key={t.id} todo={t} />)}
        {adding && (
          <li className="-mx-4 px-4 py-3 bg-indigo-50/40 border-l-2 border-indigo-400">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Plus size={11} className="text-indigo-500" />
              <span className="text-[11px] font-semibold text-indigo-600">새 할 일 추가</span>
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">제목</label>
                <input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') reset() }}
                  placeholder="할 일 내용"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">마감일</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">우선순위</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low')}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white">
                    <option value="high">높음</option>
                    <option value="medium">보통</option>
                    <option value="low">낮음</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={reset}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                  취소
                </button>
                <button onClick={save} disabled={createTodo.isPending || !title.trim()}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-lg transition-colors">
                  {createTodo.isPending ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </li>
        )}
        {todos.length === 0 && !adding && (
          <li className="py-3 text-center text-[11px] text-gray-300">할 일이 없습니다</li>
        )}
      </ul>
    </section>
  )
}

// ── Event 섹션 (목록 + 추가 버튼) ───────────────────────────────────────
function EventSection({ events, memoId, defaultClientId, defaultProjectId }: {
  events: DerivedEvent[]
  memoId: string
  defaultClientId: string | null
  defaultProjectId: string | null
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()

  const reset = () => {
    setAdding(false)
    setTitle('')
    setDate('')
    setTime('')
    setLocation('')
  }

  const save = async () => {
    if (!title.trim() || !date || saving) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // memo_id 주입 필요해서 직접 supabase insert (useCreateCalendarEvent는 memo_id 인자 없음)
      const { error } = await supabase.from('calendar_events').insert({
        user_id: user.id,
        title: title.trim(),
        date,
        time: time || null,
        location: location.trim() || null,
        client_id: defaultClientId,
        project_id: defaultProjectId,
        memo_id: memoId,
      })
      if (error) { console.error(error); return }
      qc.invalidateQueries({ queryKey: ['memo', memoId] })
      qc.invalidateQueries({ queryKey: ['calendar_events'] })
      qc.invalidateQueries({ queryKey: ['activity_stream'] })
      reset()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <CalendarDays size={14} className="text-blue-500" />
          <h2 className="text-xs font-semibold text-gray-700">일정 {events.length}건</h2>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700">
            <Plus size={11} /> 추가
          </button>
        )}
      </div>
      <ul className="divide-y divide-gray-50">
        {events.map(e => <EventRow key={e.id} event={e} />)}
        {adding && (
          <li className="-mx-4 px-4 py-3 bg-indigo-50/40 border-l-2 border-indigo-400">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Plus size={11} className="text-indigo-500" />
              <span className="text-[11px] font-semibold text-indigo-600">새 일정 추가</span>
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">제목</label>
                <input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') reset() }}
                  placeholder="일정 내용"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">날짜</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">시간</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">장소</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="(선택)"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={reset}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                  취소
                </button>
                <button onClick={save} disabled={saving || !title.trim() || !date}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-lg transition-colors">
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </li>
        )}
        {events.length === 0 && !adding && (
          <li className="py-3 text-center text-[11px] text-gray-300">일정이 없습니다</li>
        )}
      </ul>
    </section>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        {icon}
        <h2 className="text-xs font-semibold text-gray-700">{title}</h2>
      </div>
      {children}
    </section>
  )
}
