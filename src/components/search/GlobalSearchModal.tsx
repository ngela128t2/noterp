import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGlobalSearch } from '../../hooks/useGlobalSearch'

interface Props {
  open: boolean
  onClose: () => void
}

const STATUS_LABEL: Record<string, string> = {
  preparing: '준비', in_progress: '진행', review: '검토', completed: '완료',
}

export default function GlobalSearchModal({ open, onClose }: Props) {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const { data, isFetching } = useGlobalSearch(query)

  // 250ms debounce
  useEffect(() => {
    const t = setTimeout(() => setQuery(input), 250)
    return () => clearTimeout(t)
  }, [input])

  useEffect(() => {
    if (open) {
      setInput('')
      setQuery('')
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  const go = (path: string) => {
    navigate(path)
    onClose()
  }

  const total = data
    ? data.clients.length + data.projects.length + data.todos.length + data.events.length + data.contacts.length
    : 0

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-[100] pt-16 px-4" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 검색 입력 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && onClose()}
            placeholder="거래처, 프로젝트, 할 일, 일정, 연락처 검색..."
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
          />
          {isFetching && <span className="text-xs text-gray-400 animate-pulse">검색 중</span>}
          <kbd className="hidden sm:inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-500">ESC</kbd>
        </div>

        {/* 결과 */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.length < 2 ? (
            <p className="text-xs text-gray-400 text-center py-8">2자 이상 입력하세요</p>
          ) : !data || total === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">"{query}" 검색 결과가 없습니다.</p>
          ) : (
            <div className="py-2">
              {data.clients.length > 0 && (
                <Section label="거래처">
                  {data.clients.map(c => (
                    <ResultRow key={c.id} onClick={() => go(`/workspace/client/${c.id}`)}>
                      <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-mono shrink-0">{c.code ?? 'CL'}</span>
                      <span className="flex-1 font-medium">{c.name}</span>
                      {c.service_category && <span className="text-xs text-gray-400 shrink-0">{c.service_category}</span>}
                      <span className="text-xs text-indigo-300 shrink-0">워크스페이스 →</span>
                    </ResultRow>
                  ))}
                </Section>
              )}

              {data.projects.length > 0 && (
                <Section label="프로젝트">
                  {data.projects.map(p => (
                    <ResultRow key={p.id} onClick={() => go(`/workspace/project/${p.id}`)}>
                      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${p.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                      <span className="flex-1 font-medium">{p.name}</span>
                      {(p as any).clients && <span className="text-xs text-gray-400 shrink-0">{(p as any).clients.name}</span>}
                      <span className="text-xs text-indigo-300 shrink-0">워크스페이스 →</span>
                    </ResultRow>
                  ))}
                </Section>
              )}

              {data.events.length > 0 && (
                <Section label="일정">
                  {data.events.map(e => (
                    <ResultRow key={e.id} onClick={() => {
                      const ev = e as any
                      if (ev.client_id) go(`/workspace/client/${ev.client_id}`)
                      else if (ev.project_id) go(`/workspace/project/${ev.project_id}`)
                      else go('/calendar')
                    }}>
                      <span className="text-xs text-blue-500 font-mono shrink-0">{e.date.slice(5)}</span>
                      <span className="flex-1">{e.title}</span>
                    </ResultRow>
                  ))}
                </Section>
              )}

              {data.todos.length > 0 && (
                <Section label="할 일">
                  {data.todos.map(t => (
                    <ResultRow key={t.id} onClick={() => {
                      const todo = t as any
                      if (todo.client_id) go(`/workspace/client/${todo.client_id}`)
                      else go('/todos')
                    }}>
                      <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${t.completed ? 'bg-emerald-400' : 'bg-orange-400'}`} />
                      <span className={`flex-1 ${t.completed ? 'line-through text-gray-400' : ''}`}>{t.title}</span>
                      {t.due_date && <span className="text-xs text-gray-400 shrink-0">{t.due_date.slice(5)}</span>}
                    </ResultRow>
                  ))}
                </Section>
              )}

              {data.contacts.length > 0 && (
                <Section label="N-CRM">
                  {data.contacts.map(c => (
                    <ResultRow key={c.id} onClick={() => {
                      const contact = c as any
                      if (contact.client_id) go(`/workspace/client/${contact.client_id}`)
                      else go('/contacts')
                    }}>
                      <span className="flex-1 font-medium">{c.name}</span>
                      {c.title && <span className="text-xs text-gray-400 shrink-0">{c.title}</span>}
                      {c.company && <span className="text-xs text-gray-400 shrink-0">{c.company}</span>}
                    </ResultRow>
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-100 flex justify-between text-xs text-gray-400">
          <span>↑↓ 탐색 · Enter 이동 · Esc 닫기</span>
          {total > 0 && <span>총 {total}건</span>}
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">{label}</p>
      {children}
    </div>
  )
}

function ResultRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-800 hover:bg-indigo-50 transition-colors text-left"
    >
      {children}
    </button>
  )
}
