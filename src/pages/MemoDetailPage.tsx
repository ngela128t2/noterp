import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Building2, FolderKanban, CalendarDays, CheckSquare, Target, ChevronDown, Pencil, Trash2, X, Check } from 'lucide-react'
import { useMemoDetail, useMemoDerived, type DerivedTodo, type DerivedEvent } from '../hooks/useMemoDetail'
import { useToggleTodo, useSnoozeTodo, useUpdateTodo, useDeleteTodo } from '../hooks/useTodos'
import { useCompleteCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent } from '../hooks/useCalendarEvents'

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
  const [showRaw, setShowRaw] = useState(false)

  const { data: memo, isLoading } = useMemoDetail(id)
  const { data: derived } = useMemoDerived(id)

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
        <span className="text-[11px] text-gray-400">{formatDateTime(memo.created_at)}</span>
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
      {todos.length > 0 && (
        <Section icon={<CheckSquare size={14} className="text-orange-500" />} title={`할 일 ${todos.length}건`}>
          <ul className="divide-y divide-gray-50">
            {todos.map(t => <TodoRow key={t.id} todo={t} />)}
          </ul>
        </Section>
      )}

      {/* 일정 */}
      {events.length > 0 && (
        <Section icon={<CalendarDays size={14} className="text-blue-500" />} title={`일정 ${events.length}건`}>
          <ul className="divide-y divide-gray-50">
            {events.map(e => <EventRow key={e.id} event={e} />)}
          </ul>
        </Section>
      )}

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

  if (editing) {
    return (
      <li className="py-2 space-y-2 bg-amber-50/30 -mx-4 px-4">
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <div className="flex flex-wrap gap-1.5">
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low')}
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="high">높음</option>
            <option value="medium">보통</option>
            <option value="low">낮음</option>
          </select>
          <div className="ml-auto flex gap-1">
            <button onClick={cancel} className="p-1.5 text-gray-400 hover:text-gray-600 rounded" title="취소">
              <X size={14} />
            </button>
            <button onClick={save} disabled={updateTodo.isPending}
              className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded" title="저장">
              <Check size={14} />
            </button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-2.5 py-2 group">
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
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!todo.completed && (
          <button
            onClick={() => snoozeTodo.mutate({ id: todo.id, days: 1 })}
            className="text-[10px] text-gray-300 hover:text-gray-500 px-1.5 py-1"
            title="+1일 미루기"
          >
            +1일
          </button>
        )}
        <button onClick={() => setEditing(true)} className="p-1 text-gray-300 hover:text-indigo-500 rounded" title="수정">
          <Pencil size={12} />
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

  if (editing) {
    return (
      <li className="py-2 space-y-2 bg-blue-50/30 -mx-4 px-4">
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <div className="flex flex-wrap gap-1.5">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="장소"
            className="flex-1 min-w-[80px] px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          <div className="flex gap-1">
            <button onClick={cancel} className="p-1.5 text-gray-400 hover:text-gray-600 rounded" title="취소">
              <X size={14} />
            </button>
            <button onClick={save} disabled={updateEvent.isPending}
              className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded" title="저장">
              <Check size={14} />
            </button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-2.5 py-2 group">
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
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="p-1 text-gray-300 hover:text-indigo-500 rounded" title="수정">
          <Pencil size={12} />
        </button>
        <button onClick={remove} className="p-1 text-gray-300 hover:text-red-500 rounded" title="삭제">
          <Trash2 size={12} />
        </button>
      </div>
    </li>
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
