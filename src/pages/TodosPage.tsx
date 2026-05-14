import { useState } from 'react'
import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo } from '../hooks/useTodos'
import { useClients } from '../hooks/useClients'
import type { Todo } from '../types'

const PRIORITY_LABEL = { high: '높음', medium: '보통', low: '낮음' }
const PRIORITY_COLOR = {
  high: 'bg-red-100 text-red-600',
  medium: 'bg-yellow-100 text-yellow-600',
  low: 'bg-gray-100 text-gray-500',
}

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function TodosPage() {
  const { data: todos = [], isLoading } = useTodos()
  const { data: clients = [] } = useClients()
  const createTodo = useCreateTodo()
  const toggleTodo = useToggleTodo()
  const deleteTodo = useDeleteTodo()

  const [modal, setModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending')
  const [form, setForm] = useState({ title: '', due_date: '', priority: 'medium' as Todo['priority'], client_id: '' })

  const filtered = todos.filter(t =>
    filter === 'all' ? true : filter === 'done' ? t.completed : !t.completed
  )

  const today = new Date().toISOString().split('T')[0]
  const overdue = filtered.filter(t => !t.completed && t.due_date && t.due_date < today)
  const dueToday = filtered.filter(t => !t.completed && t.due_date === today)
  const upcoming = filtered.filter(t => !t.completed && (!t.due_date || t.due_date > today))
  const done = filtered.filter(t => t.completed)

  const handleSave = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    createTodo.mutate(
      {
        user_id: '',
        title: form.title,
        due_date: form.due_date || null,
        priority: form.priority,
        completed: false,
        client_id: form.client_id || null,
        project_id: null,
      },
      { onSuccess: () => { setModal(false); setForm({ title: '', due_date: '', priority: 'medium', client_id: '' }) } },
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">투두</h2>
        <button
          onClick={() => setModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
        >
          + 추가
        </button>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {(['pending', 'all', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === f ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {f === 'pending' ? '미완료' : f === 'done' ? '완료' : '전체'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-400 text-sm">항목이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <Section title="⚠️ 기한 초과" titleClass="text-red-600">
              {overdue.map(t => <TodoItem key={t.id} todo={t} onToggle={toggleTodo.mutate} onDelete={deleteTodo.mutate} />)}
            </Section>
          )}
          {dueToday.length > 0 && (
            <Section title="📌 오늘 마감">
              {dueToday.map(t => <TodoItem key={t.id} todo={t} onToggle={toggleTodo.mutate} onDelete={deleteTodo.mutate} />)}
            </Section>
          )}
          {upcoming.length > 0 && (
            <Section title="📋 예정">
              {upcoming.map(t => <TodoItem key={t.id} todo={t} onToggle={toggleTodo.mutate} onDelete={deleteTodo.mutate} />)}
            </Section>
          )}
          {done.length > 0 && (
            <Section title="✅ 완료">
              {done.map(t => <TodoItem key={t.id} todo={t} onToggle={toggleTodo.mutate} onDelete={deleteTodo.mutate} />)}
            </Section>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">투두 추가</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <Field label="제목 *">
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} placeholder="할 일 입력" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="마감일">
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inp} />
                </Field>
                <Field label="우선순위">
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Todo['priority'] }))} className={inp}>
                    <option value="high">높음</option>
                    <option value="medium">보통</option>
                    <option value="low">낮음</option>
                  </select>
                </Field>
              </div>
              <Field label="거래처">
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className={inp}>
                  <option value="">선택 안 함</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
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

function Section({ title, titleClass = 'text-gray-500', children }: { title: string; titleClass?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${titleClass}`}>{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function TodoItem({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo & { clients: { name: string } | null; projects: { name: string } | null }
  onToggle: (args: { id: string; completed: boolean }) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3 ${todo.completed ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={e => onToggle({ id: todo.id, completed: e.target.checked })}
        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
      />
      <div className="flex-1">
        <span className={`text-sm ${todo.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{todo.title}</span>
        <div className="flex gap-2 mt-0.5">
          {todo.due_date && <span className="text-xs text-gray-400">{todo.due_date}</span>}
          {todo.clients && <span className="text-xs text-gray-400">🏢 {todo.clients.name}</span>}
        </div>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[todo.priority]}`}>
        {PRIORITY_LABEL[todo.priority]}
      </span>
      <button onClick={() => onDelete(todo.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">✕</button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
