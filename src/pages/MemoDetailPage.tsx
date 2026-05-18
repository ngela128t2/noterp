import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Building2, FolderKanban, CalendarDays, CheckSquare, Target, ChevronDown } from 'lucide-react'
import { useMemoDetail, useMemoDerived } from '../hooks/useMemoDetail'
import { useToggleTodo, useSnoozeTodo } from '../hooks/useTodos'
import { useCompleteCalendarEvent } from '../hooks/useCalendarEvents'

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
  const toggleTodo = useToggleTodo()
  const snoozeTodo = useSnoozeTodo()
  const completeEvent = useCompleteCalendarEvent()

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
            {todos.map(t => {
              const badge = t.priority ? PRIORITY_BADGE[t.priority] : null
              return (
                <li key={t.id} className="flex items-center gap-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => toggleTodo.mutate({ id: t.id, completed: !t.completed })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm break-keep ${t.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {t.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                      {t.due_date && <span>📅 {shortDate(t.due_date)}</span>}
                      {badge && (
                        <span className={`px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
                      )}
                    </div>
                  </div>
                  {!t.completed && (
                    <button
                      onClick={() => snoozeTodo.mutate({ id: t.id, days: 1 })}
                      className="text-[11px] text-gray-300 hover:text-gray-500 shrink-0"
                    >
                      +1일
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {/* 일정 */}
      {events.length > 0 && (
        <Section icon={<CalendarDays size={14} className="text-blue-500" />} title={`일정 ${events.length}건`}>
          <ul className="divide-y divide-gray-50">
            {events.map(e => (
              <li key={e.id} className="flex items-center gap-2.5 py-2">
                <input
                  type="checkbox"
                  checked={e.completed}
                  onChange={() => completeEvent.mutate(e.id)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm break-keep ${e.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {e.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                    <span>📅 {shortDate(e.date)}</span>
                    {e.time && <span>⏰ {e.time.slice(0, 5)}</span>}
                    {e.location && <span className="truncate max-w-[120px]">📍 {e.location}</span>}
                  </div>
                </div>
              </li>
            ))}
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
