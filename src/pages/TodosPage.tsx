import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients } from '../hooks/useClients'
import { getLocalDate } from '../lib/dateUtils'
import { useOpenLoops } from '../hooks/useOpenLoops'
import { useCreateTodo, useDeleteTodo, useTodos, useToggleTodo } from '../hooks/useTodos'
import type { Todo } from '../types'

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

const FOLLOW_UP_TYPES = [
  { value: 'reply', label: '회신 대기', icon: '⏳' },
  { value: 'doc', label: '자료 요청', icon: '📄' },
  { value: 'contact', label: '후속 연락', icon: '📞' },
  { value: 'confirm', label: '확인 필요', icon: '🔍' },
  { value: 'general', label: '일반', icon: '·' },
]

const PRIORITY_LABEL = { high: '긴급', medium: '보통', low: '낮음' }
const PRIORITY_COLOR = {
  high: 'bg-red-100 text-red-600',
  medium: 'bg-yellow-100 text-yellow-600',
  low: 'bg-gray-100 text-gray-500',
}

function daysStale(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function TodosPage() {
  const navigate = useNavigate()
  const { data: todos = [], isLoading } = useTodos()
  const { data: clients = [] } = useClients()
  const { data: openLoops = [] } = useOpenLoops()
  const createTodo = useCreateTodo()
  const toggleTodo = useToggleTodo()
  const deleteTodo = useDeleteTodo()

  const [modal, setModal] = useState(false)
  const [filter, setFilter] = useState<'pending' | 'all' | 'done'>('pending')
  const [form, setForm] = useState({
    title: '',
    due_date: '',
    priority: 'medium' as Todo['priority'],
    client_id: '',
    follow_type: 'general',
  })

  const today = getLocalDate()
  const filtered = todos.filter(t =>
    filter === 'all' ? true : filter === 'done' ? t.completed : !t.completed
  )
  const overdue = filtered.filter(t => !t.completed && t.due_date && t.due_date < today)
  const dueToday = filtered.filter(t => !t.completed && t.due_date === today)
  const upcoming = filtered.filter(t => !t.completed && (!t.due_date || t.due_date > today))
  const done = filtered.filter(t => t.completed)

  const stalledProjects = openLoops.filter(l => l.kind === 'stalled_project')

  const handleSave = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const typePrefix = form.follow_type !== 'general'
      ? `[${FOLLOW_UP_TYPES.find(t => t.value === form.follow_type)?.label ?? ''}] `
      : ''
    createTodo.mutate(
      {
        user_id: '',
        title: typePrefix + form.title,
        due_date: form.due_date || null,
        priority: form.priority,
        completed: false,
        client_id: form.client_id || null,
        project_id: null,
      },
      {
        onSuccess: () => {
          setModal(false)
          setForm({ title: '', due_date: '', priority: 'medium', client_id: '', follow_type: 'general' })
        },
      },
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Follow-up</h2>
          <p className="text-sm text-gray-400 mt-0.5">흐름이 멈춘 업무를 놓치지 않습니다.</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shrink-0"
        >
          + 추가
        </button>
      </div>

      {/* AI 감지: 흐름 끊긴 프로젝트 */}
      {stalledProjects.length > 0 && (
        <div className="mb-5 bg-violet-50 border border-violet-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-violet-400">✦</span>
            <p className="text-xs font-semibold text-violet-700">AI 감지 — 흐름 끊긴 프로젝트</p>
            <span className="text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded-full ml-auto">
              {stalledProjects.length}건
            </span>
          </div>
          <div className="space-y-2">
            {stalledProjects.map(loop => (
              <div
                key={loop.id}
                onClick={() => loop.projectId ? navigate(`/workspace/project/${loop.projectId}`) : undefined}
                className="flex items-center gap-3 bg-white rounded-lg border border-violet-100 px-3 py-2.5 cursor-pointer hover:border-violet-300 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{loop.title}</p>
                  <p className="text-xs text-violet-500 mt-0.5">{loop.context}</p>
                </div>
                <span className="text-xs text-violet-300 group-hover:text-violet-500 shrink-0">워크스페이스 →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {(['pending', 'all', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === f ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'pending' ? `대기 중 ${todos.filter(t => !t.completed).length}` : f === 'done' ? '완료' : '전체'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-gray-400 text-sm">Follow-up 항목이 없습니다.</p>
          <button onClick={() => setModal(true)} className="mt-2 text-sm text-indigo-600 hover:underline">
            + 새 항목 추가
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <Group label="기한 초과" labelClass="text-red-600" bg="bg-red-50">
              {overdue.map(t => (
                <FollowUpItem key={t.id} todo={t} today={today} onToggle={toggleTodo.mutate} onDelete={deleteTodo.mutate} />
              ))}
            </Group>
          )}
          {dueToday.length > 0 && (
            <Group label="오늘 마감" labelClass="text-orange-600" bg="bg-orange-50">
              {dueToday.map(t => (
                <FollowUpItem key={t.id} todo={t} today={today} onToggle={toggleTodo.mutate} onDelete={deleteTodo.mutate} />
              ))}
            </Group>
          )}
          {upcoming.length > 0 && (
            <Group label="대기 중" labelClass="text-indigo-600" bg="bg-indigo-50">
              {upcoming.map(t => (
                <FollowUpItem key={t.id} todo={t} today={today} onToggle={toggleTodo.mutate} onDelete={deleteTodo.mutate} />
              ))}
            </Group>
          )}
          {done.length > 0 && filter !== 'pending' && (
            <Group label="완료" labelClass="text-emerald-600" bg="bg-emerald-50">
              {done.map(t => (
                <FollowUpItem key={t.id} todo={t} today={today} onToggle={toggleTodo.mutate} onDelete={deleteTodo.mutate} />
              ))}
            </Group>
          )}
        </div>
      )}

      {/* 추가 모달 */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Follow-up 추가</h3>
            <p className="text-xs text-gray-400 mb-4">어떤 업무를 follow-up 하나요?</p>
            <form onSubmit={handleSave} className="space-y-3">
              {/* Follow-up 유형 */}
              <div className="flex flex-wrap gap-1.5">
                {FOLLOW_UP_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, follow_type: t.value }))}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border transition-colors ${
                      form.follow_type === t.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                    }`}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">내용 *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={inp}
                  placeholder="예: 안진 미팅 이후 회신 확인"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">마감일</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">긴급도</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Todo['priority'] }))} className={inp}>
                    <option value="high">긴급</option>
                    <option value="medium">보통</option>
                    <option value="low">낮음</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">거래처</label>
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className={inp}>
                  <option value="">선택 안 함</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Group({ label, labelClass, bg, children }: { label: string; labelClass: string; bg: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <p className={`px-4 py-2 text-xs font-semibold ${labelClass} ${bg} border-b border-gray-100`}>{label}</p>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  )
}

function FollowUpItem({
  todo, today, onToggle, onDelete,
}: {
  todo: Todo & { clients: { name: string } | null; projects: { name: string } | null }
  today: string
  onToggle: (args: { id: string; completed: boolean }) => void
  onDelete: (id: string) => void
}) {
  const overdueDays = !todo.completed && todo.due_date && todo.due_date < today
    ? daysStale(todo.due_date)
    : 0

  // 제목에서 유형 태그 파싱
  const typeMatch = todo.title.match(/^\[([^\]]+)\] (.+)$/)
  const typeLabel = typeMatch?.[1] ?? null
  const cleanTitle = typeMatch?.[2] ?? todo.title

  return (
    <div className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 group transition-colors ${todo.completed ? 'opacity-60' : ''}`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={e => onToggle({ id: todo.id, completed: e.target.checked })}
        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {typeLabel && (
            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium shrink-0">
              {typeLabel}
            </span>
          )}
          <span className={`text-sm ${todo.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {cleanTitle}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {todo.clients && (
            <span className="text-xs text-gray-400">{todo.clients.name}</span>
          )}
          {todo.due_date && (
            <span className={`text-xs font-medium ${overdueDays > 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {overdueDays > 0 ? `${overdueDays}일 경과` : todo.due_date.slice(5)}
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PRIORITY_COLOR[todo.priority]}`}>
            {PRIORITY_LABEL[todo.priority]}
          </span>
        </div>
      </div>
      <button
        onClick={() => onDelete(todo.id)}
        className="text-xs text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 mt-0.5 shrink-0"
      >
        ✕
      </button>
    </div>
  )
}
