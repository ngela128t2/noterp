import type { ParsedResult } from '../../types'

interface Props {
  result: ParsedResult
  onChange: (updated: ParsedResult) => void
  onApprove: () => void
  onReject: () => void
}

const inp = 'px-2 py-1 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white'
const badge = 'inline-block px-2 py-0.5 rounded text-xs font-medium'


export default function ParseResultCard({ result, onChange, onApprove, onReject }: Props) {
  const set = (patch: Partial<ParsedResult>) => onChange({ ...result, ...patch })

  const hasEvents = result.events?.length > 0
  const hasTodos = result.todos?.length > 0
  const hasClients = result.clients?.length > 0
  const hasProjects = result.projects?.length > 0
  const hasContacts = result.contacts?.length > 0
  const isEmpty = !hasEvents && !hasTodos && !hasClients && !hasProjects && !hasContacts

  return (
    <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
      <div className="bg-indigo-50 px-5 py-3 border-b border-indigo-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-indigo-800">실행 결과</span>
        <span className="text-xs text-indigo-500">필드를 직접 수정한 뒤 승인하세요</span>
      </div>

      <div className="p-5 space-y-5">
        {isEmpty && <p className="text-sm text-gray-400">추출된 항목이 없습니다.</p>}

        <Section
          title="일정"
          onAdd={() => set({ events: [...(result.events ?? []), { title: '', date: null, time: null, location: null, client_name: null }] })}
        >
          {(result.events ?? []).map((ev, i) => (
            <EditRow key={i} onRemove={() => set({ events: result.events.filter((_, idx) => idx !== i) })}>
              <input
                className={`${inp} flex-1 min-w-[140px]`}
                placeholder="제목"
                value={ev.title}
                onChange={e => set({ events: result.events.map((v, idx) => idx === i ? { ...v, title: e.target.value } : v) })}
              />
              <input
                type="date"
                className={inp}
                value={ev.date ?? ''}
                onChange={e => set({ events: result.events.map((v, idx) => idx === i ? { ...v, date: e.target.value || null } : v) })}
              />
              <input
                type="time"
                className={inp}
                value={ev.time ?? ''}
                onChange={e => set({ events: result.events.map((v, idx) => idx === i ? { ...v, time: e.target.value || null } : v) })}
              />
              <input
                className={`${inp} w-28`}
                placeholder="장소"
                value={ev.location ?? ''}
                onChange={e => set({ events: result.events.map((v, idx) => idx === i ? { ...v, location: e.target.value || null } : v) })}
              />
            </EditRow>
          ))}
        </Section>

        <Section
          title="할 일"
          onAdd={() => set({ todos: [...(result.todos ?? []), { title: '', due_date: null, priority: 'medium', assignee: null }] })}
        >
            {(result.todos ?? []).map((todo, i) => (
              <EditRow key={i} onRemove={() => set({ todos: result.todos.filter((_, idx) => idx !== i) })}>
                <input
                  className={`${inp} flex-1 min-w-[140px]`}
                  placeholder="할 일 제목"
                  value={todo.title}
                  onChange={e => set({ todos: result.todos.map((v, idx) => idx === i ? { ...v, title: e.target.value } : v) })}
                />
                <input
                  type="date"
                  className={inp}
                  value={todo.due_date ?? ''}
                  onChange={e => set({ todos: result.todos.map((v, idx) => idx === i ? { ...v, due_date: e.target.value || null } : v) })}
                />
                <select
                  className={inp}
                  value={todo.priority ?? 'medium'}
                  onChange={e => set({ todos: result.todos.map((v, idx) => idx === i ? { ...v, priority: e.target.value } : v) })}
                >
                  <option value="high">높음</option>
                  <option value="medium">보통</option>
                  <option value="low">낮음</option>
                </select>
              </EditRow>
            ))}
          </Section>

        {/* ── 거래처 ── */}
        {hasClients && (
          <Section title="거래처">
            {result.clients.map((client, i) => (
              <EditRow key={i} onRemove={() => set({ clients: result.clients.filter((_, idx) => idx !== i) })}>
                <input
                  className={`${inp} flex-1`}
                  value={client.name}
                  onChange={e => set({ clients: result.clients.map((v, idx) => idx === i ? { ...v, name: e.target.value } : v) })}
                />
                {client.is_new && <Tag color="purple">신규</Tag>}
              </EditRow>
            ))}
          </Section>
        )}

        {/* ── 프로젝트 ── */}
        {hasProjects && (
          <Section title="프로젝트">
            {result.projects.map((proj, i) => (
              <EditRow key={i} onRemove={() => set({ projects: result.projects.filter((_, idx) => idx !== i) })}>
                <input
                  className={`${inp} flex-1 min-w-[140px]`}
                  placeholder="프로젝트명"
                  value={proj.name}
                  onChange={e => set({ projects: result.projects.map((v, idx) => idx === i ? { ...v, name: e.target.value } : v) })}
                />
                {proj.milestone && (
                  <input
                    className={`${inp} flex-1`}
                    placeholder="마일스톤"
                    value={proj.milestone ?? ''}
                    onChange={e => set({ projects: result.projects.map((v, idx) => idx === i ? { ...v, milestone: e.target.value || null } : v) })}
                  />
                )}
              </EditRow>
            ))}
          </Section>
        )}

        {/* ── 연락처 ── */}
        {hasContacts && (
          <Section title="연락처">
            {result.contacts.map((contact, i) => (
              <EditRow key={i} onRemove={() => set({ contacts: result.contacts.filter((_, idx) => idx !== i) })}>
                <input
                  className={`${inp} w-28`}
                  placeholder="이름"
                  value={contact.name}
                  onChange={e => set({ contacts: result.contacts.map((v, idx) => idx === i ? { ...v, name: e.target.value } : v) })}
                />
                <input
                  className={`${inp} flex-1`}
                  placeholder="회사"
                  value={contact.company ?? ''}
                  onChange={e => set({ contacts: result.contacts.map((v, idx) => idx === i ? { ...v, company: e.target.value || null } : v) })}
                />
                <input
                  className={`${inp} w-24`}
                  placeholder="직책"
                  value={contact.title ?? ''}
                  onChange={e => set({ contacts: result.contacts.map((v, idx) => idx === i ? { ...v, title: e.target.value || null } : v) })}
                />
              </EditRow>
            ))}
          </Section>
        )}
      </div>

      <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
        <button onClick={onReject} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          거부
        </button>
        <button onClick={onApprove} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
          승인 · 저장
        </button>
      </div>
    </div>
  )
}

function Section({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) {
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

function EditRow({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="flex items-center flex-wrap gap-2">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 rounded shrink-0"
        title="삭제"
      >
        ✕
      </button>
    </div>
  )
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700', purple: 'bg-purple-100 text-purple-700',
    red: 'bg-red-100 text-red-700', yellow: 'bg-yellow-100 text-yellow-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return <span className={`${badge} ${colors[color] ?? colors.gray}`}>{children}</span>
}
