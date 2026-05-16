import { normalizeMemoName } from '../../lib/memoShortcuts'
import type { ParsedResult } from '../../types'

export interface ContextClient {
  id: string
  name: string
  service_category?: string | null
}

export interface ContextProject {
  id: string
  name: string
  client_id: string | null
}

interface Props {
  result: ParsedResult
  rawText?: string
  onChange: (updated: ParsedResult) => void
  onApprove: () => void
  onReject: () => void
  existingClients?: ContextClient[]
  existingProjects?: ContextProject[]
}

const inp =
  'px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white'

function matchClient(name: string, list?: ContextClient[]) {
  if (!list?.length) return null
  const key = normalizeMemoName(name)
  return list.find(c => normalizeMemoName(c.name) === key) ?? null
}

function matchProject(name: string, list?: ContextProject[]) {
  if (!list?.length) return null
  const key = normalizeMemoName(name)
  return list.find(p => normalizeMemoName(p.name) === key) ?? null
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

function buildImpact(
  result: ParsedResult,
  existingClients?: ContextClient[],
  existingProjects?: ContextProject[],
): string {
  const parts: string[] = []
  const clients = result.clients ?? []
  const updated = clients.filter(c => matchClient(c.name, existingClients)).length
  const created = clients.filter(c => !matchClient(c.name, existingClients)).length
  if (updated) parts.push(`거래처 업데이트 ${updated}건`)
  if (created) parts.push(`거래처 신규 ${created}건`)

  const projects = result.projects ?? []
  const projUpdated = projects.filter(p => matchProject(p.name, existingProjects)).length
  const projCreated = projects.filter(p => !matchProject(p.name, existingProjects)).length
  if (projUpdated) parts.push(`프로젝트 업데이트 ${projUpdated}건`)
  if (projCreated > 0) parts.push(`프로젝트 신규 ${projCreated}건`)

  if (result.events?.length) parts.push(`일정 ${result.events.length}건`)
  if (result.todos?.length) parts.push(`할 일 ${result.todos.length}건`)
  if (result.contacts?.length) parts.push(`연락처 ${result.contacts.length}건`)
  return parts.join(' · ') || '저장할 항목 없음'
}

export default function ParseResultCard({
  result,
  rawText,
  onChange,
  onApprove,
  onReject,
  existingClients,
  existingProjects,
}: Props) {
  const set = (patch: Partial<ParsedResult>) => onChange({ ...result, ...patch })

  const hasContext = (result.clients?.length ?? 0) > 0 || (result.projects?.length ?? 0) > 0
  const hasEvents = (result.events?.length ?? 0) > 0
  const hasTodos = (result.todos?.length ?? 0) > 0
  const hasContacts = (result.contacts?.length ?? 0) > 0
  const tags = result.tags ?? []
  const impact = buildImpact(result, existingClients, existingProjects)

  return (
    <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
      {/* ── 헤더: 분석 표시 + 태그 ── */}
      <div className="bg-gradient-to-r from-indigo-50 to-white px-5 py-3 border-b border-indigo-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <span className="text-indigo-400 shrink-0">✦</span>
            <span className="text-xs font-semibold text-indigo-700 shrink-0">업무 맥락 분석</span>
            {tags.map((tag, i) => (
              <button
                key={i}
                onClick={() => set({ tags: tags.filter((_, idx) => idx !== i) })}
                className="text-[11px] px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full hover:bg-red-50 hover:text-red-400 transition-colors group"
                title="태그 삭제"
              >
                #{tag} <span className="opacity-0 group-hover:opacity-100">✕</span>
              </button>
            ))}
          </div>
          <span className="text-xs text-indigo-400 shrink-0">승인 전 수정 가능</span>
        </div>

        {/* 원본 메모 */}
        {rawText && (
          <p className="mt-2 text-xs text-gray-500 bg-white/70 rounded px-2 py-1 border border-gray-100 line-clamp-2">
            {rawText}
          </p>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* ── 업무 맥락: 거래처 + 프로젝트 ── */}
        {hasContext && (
          <Section title="연결 맥락">
            {/* 거래처 */}
            {(result.clients ?? []).map((client, i) => {
              const matched = matchClient(client.name, existingClients)
              const clientProjects = matched
                ? (existingProjects ?? []).filter(p => p.client_id === matched.id)
                : []
              return (
                <div key={i} className="flex items-start gap-2 flex-wrap">
                  {/* 거래처명 입력 */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {matched ? (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded whitespace-nowrap">
                        ✓ 기존
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-purple-50 text-purple-600 border border-purple-200 rounded whitespace-nowrap">
                        신규
                      </span>
                    )}
                    <input
                      className={`${inp} w-36`}
                      value={client.name}
                      onChange={e =>
                        set({ clients: result.clients.map((v, idx) => idx === i ? { ...v, name: e.target.value } : v) })
                      }
                    />
                    {matched?.service_category && (
                      <span className="text-[10px] text-gray-400 truncate">{matched.service_category}</span>
                    )}
                  </div>
                  {/* 관련 프로젝트 칩 (기존 거래처인 경우) */}
                  {clientProjects.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-gray-400">관련 프로젝트:</span>
                      {clientProjects.slice(0, 3).map(p => (
                        <span
                          key={p.id}
                          className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200 cursor-default"
                          title={p.name}
                        >
                          {p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name}
                        </span>
                      ))}
                      {clientProjects.length > 3 && (
                        <span className="text-[10px] text-gray-400">+{clientProjects.length - 3}</span>
                      )}
                    </div>
                  )}
                  <RemoveBtn onRemove={() => set({ clients: result.clients.filter((_, idx) => idx !== i) })} />
                </div>
              )
            })}

            {/* 프로젝트 */}
            {(result.projects ?? []).map((proj, i) => {
              const matched = matchProject(proj.name, existingProjects)
              return (
                <div key={i} className="flex items-center gap-2 flex-wrap pl-4 border-l-2 border-gray-100">
                  <span className="text-[10px] text-gray-400 shrink-0">└ 프로젝트</span>
                  {matched ? (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded">
                      ✓ 기존
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded">
                      업데이트
                    </span>
                  )}
                  <input
                    className={`${inp} w-40`}
                    placeholder="프로젝트명"
                    value={proj.name}
                    onChange={e =>
                      set({ projects: result.projects.map((v, idx) => idx === i ? { ...v, name: e.target.value } : v) })
                    }
                  />
                  {proj.milestone && (
                    <>
                      <span className="text-[10px] text-gray-400">↳</span>
                      <input
                        className={`${inp} flex-1 min-w-[100px]`}
                        placeholder="마일스톤"
                        value={proj.milestone}
                        onChange={e =>
                          set({ projects: result.projects.map((v, idx) => idx === i ? { ...v, milestone: e.target.value || null } : v) })
                        }
                      />
                    </>
                  )}
                  <RemoveBtn onRemove={() => set({ projects: result.projects.filter((_, idx) => idx !== i) })} />
                </div>
              )
            })}
          </Section>
        )}

        {/* ── 일정 ── */}
        <Section
          title="일정"
          onAdd={() =>
            set({ events: [...(result.events ?? []), { title: '', date: null, time: null, location: null, client_name: null }] })
          }
        >
          {(result.events ?? []).map((ev, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <input
                className={`${inp} flex-1 min-w-[140px]`}
                placeholder="제목"
                value={ev.title}
                onChange={e =>
                  set({ events: result.events.map((v, idx) => idx === i ? { ...v, title: e.target.value } : v) })
                }
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="date"
                  className={inp}
                  value={ev.date ?? ''}
                  onChange={e =>
                    set({ events: result.events.map((v, idx) => idx === i ? { ...v, date: e.target.value || null } : v) })
                  }
                />
                {ev.date && (
                  <span className="text-[10px] text-indigo-500 whitespace-nowrap">{formatDay(ev.date)}</span>
                )}
                <input
                  type="time"
                  className={inp}
                  value={ev.time ?? ''}
                  onChange={e =>
                    set({ events: result.events.map((v, idx) => idx === i ? { ...v, time: e.target.value || null } : v) })
                  }
                />
              </div>
              <input
                className={`${inp} w-24`}
                placeholder="장소"
                value={ev.location ?? ''}
                onChange={e =>
                  set({ events: result.events.map((v, idx) => idx === i ? { ...v, location: e.target.value || null } : v) })
                }
              />
              <RemoveBtn onRemove={() => set({ events: result.events.filter((_, idx) => idx !== i) })} />
            </div>
          ))}
          {!hasEvents && <EmptyHint text="추출된 일정 없음" />}
        </Section>

        {/* ── 할 일 ── */}
        <Section
          title="할 일"
          onAdd={() =>
            set({ todos: [...(result.todos ?? []), { title: '', due_date: null, priority: 'medium', assignee: null }] })
          }
        >
          {(result.todos ?? []).map((todo, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <input
                className={`${inp} flex-1 min-w-[140px]`}
                placeholder="할 일 제목"
                value={todo.title}
                onChange={e =>
                  set({ todos: result.todos.map((v, idx) => idx === i ? { ...v, title: e.target.value } : v) })
                }
              />
              <input
                type="date"
                className={inp}
                value={todo.due_date ?? ''}
                onChange={e =>
                  set({ todos: result.todos.map((v, idx) => idx === i ? { ...v, due_date: e.target.value || null } : v) })
                }
              />
              <select
                className={inp}
                value={todo.priority ?? 'medium'}
                onChange={e =>
                  set({ todos: result.todos.map((v, idx) => idx === i ? { ...v, priority: e.target.value } : v) })
                }
              >
                <option value="high">높음</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>
              <RemoveBtn onRemove={() => set({ todos: result.todos.filter((_, idx) => idx !== i) })} />
            </div>
          ))}
          {!hasTodos && <EmptyHint text="추출된 할 일 없음" />}
        </Section>

        {/* ── 연락처 ── */}
        {hasContacts && (
          <Section title="연락처">
            {(result.contacts ?? []).map((contact, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <input
                  className={`${inp} w-24`}
                  placeholder="이름"
                  value={contact.name}
                  onChange={e =>
                    set({ contacts: result.contacts.map((v, idx) => idx === i ? { ...v, name: e.target.value } : v) })
                  }
                />
                <input
                  className={`${inp} flex-1 min-w-[100px]`}
                  placeholder="회사"
                  value={contact.company ?? ''}
                  onChange={e =>
                    set({ contacts: result.contacts.map((v, idx) => idx === i ? { ...v, company: e.target.value || null } : v) })
                  }
                />
                <input
                  className={`${inp} w-20`}
                  placeholder="직책"
                  value={contact.title ?? ''}
                  onChange={e =>
                    set({ contacts: result.contacts.map((v, idx) => idx === i ? { ...v, title: e.target.value || null } : v) })
                  }
                />
                <RemoveBtn onRemove={() => set({ contacts: result.contacts.filter((_, idx) => idx !== i) })} />
              </div>
            ))}
          </Section>
        )}
      </div>

      {/* ── 저장 영향 요약 + 액션 버튼 ── */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-gray-400 flex-1 min-w-0">{impact}</p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onReject}
              className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              거부
            </button>
            <button
              onClick={onApprove}
              className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              승인 · 저장
              <span className="text-indigo-300">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
  onAdd,
}: {
  title: string
  children: React.ReactNode
  onAdd?: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
        {onAdd && (
          <button type="button" onClick={onAdd} className="text-xs text-indigo-500 hover:text-indigo-700">
            + 추가
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function RemoveBtn({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 rounded shrink-0 transition-colors"
      title="삭제"
    >
      ✕
    </button>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-xs text-gray-300 py-1">{text}</p>
}
