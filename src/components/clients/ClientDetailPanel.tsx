import { useState } from 'react'
import type { Client } from '../../types'
import { useClientLogs, formatLog } from '../../hooks/useLogs'
import { useClientProjects } from '../../hooks/useProjects'
import { useClientTodos } from '../../hooks/useTodos'
import { useClientUpcomingEvents } from '../../hooks/useCalendarEvents'

interface Props {
  client: Client
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}

type Tab = '정보' | '업무'

const STATUS_LABEL: Record<string, string> = {
  preparing: '준비', in_progress: '진행 중', review: '검토', completed: '완료',
}
const STATUS_COLOR: Record<string, string> = {
  preparing: 'text-gray-500', in_progress: 'text-indigo-600', review: 'text-amber-600', completed: 'text-emerald-600',
}
const PRIORITY_COLOR: Record<string, string> = {
  high: 'text-red-500', medium: 'text-yellow-600', low: 'text-gray-400',
}

export default function ClientDetailPanel({ client, onEdit, onDelete, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('정보')
  const { data: logs = [] } = useClientLogs(client.id)
  const { data: projects = [] } = useClientProjects(client.id)
  const { data: todos = [] } = useClientTodos(client.id)
  const { data: events = [] } = useClientUpcomingEvents(client.id)

  const showCode = client.code && !client.needs_review && client.source !== 'memo'
  const openProjectCount = projects.filter(p => p.status !== 'completed').length
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="w-1/2 min-w-[420px] shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              {showCode && (
                <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded shrink-0">
                  {client.code}
                </span>
              )}
              {client.needs_review && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium shrink-0">검토 필요</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${client.entity_type === '법인' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                {client.entity_type ?? '법인'}
              </span>
            </div>
            <h3 className="text-base font-bold text-gray-900 truncate" title={client.name}>
              {client.name}
            </h3>
            {client.service_category && (
              <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full mt-0.5 inline-block">
                {client.service_category}{client.service_detail ? ` · ${client.service_detail}` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0 ml-2">
            <button onClick={onEdit} className="px-2.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium">수정</button>
            <button onClick={onDelete} className="px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-50 rounded-lg">삭제</button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-lg">✕</button>
          </div>
        </div>

        {/* 업무 현황 요약 */}
        <div className="flex gap-3 mt-3 text-xs text-gray-500">
          <span>프로젝트 <strong className="text-gray-700">{openProjectCount}</strong>건</span>
          <span>할 일 <strong className="text-gray-700">{todos.length}</strong>건</span>
          <span>예정 일정 <strong className="text-gray-700">{events.length}</strong>건</span>
        </div>

        {/* 탭 */}
        <div className="flex gap-0 mt-3 border-b border-gray-100 -mx-5 px-5">
          {(['정보', '업무'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm border-b-2 transition-colors -mb-px ${
                tab === t ? 'border-indigo-600 text-indigo-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
              {t === '업무' && (todos.length + events.length) > 0 && (
                <span className="ml-1.5 bg-indigo-100 text-indigo-600 text-xs px-1.5 py-0.5 rounded-full">
                  {todos.length + events.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {tab === '정보' && (
          <div className="px-5 py-4 space-y-5">
            <Section title="기본 정보">
              <Row label="사업자번호" value={client.business_number} mono />
              <Row label="법인번호" value={client.corp_number} mono />
              <Row label="금감원번호" value={client.fss_number} mono />
              <Row label="대표자" value={client.representative} />
              <Row label="개업일" value={client.established_date} />
              <Row label="계약일" value={client.contract_date} highlight />
              <Row label="거래처유형" value={client.client_type} />
              <Row label="관할세무서" value={client.tax_office} />
            </Section>

            <Section title="용역 정보">
              <Row label="제공 용역" value={client.service_category ? `${client.service_category}${client.service_detail ? ` / ${client.service_detail}` : ''}` : null} />
              <Row label="과세유형" value={client.tax_type} />
              <Row label="원천세신고" value={client.withholding_type} />
              <Row label="담당자" value={client.manager} />
            </Section>

            <Section title="연락처">
              <Row label="업종" value={client.industry} />
              <Row label="전화번호" value={client.contact_phone} />
              <Row label="이메일" value={client.contact_email} />
              <Row label="주소" value={client.address} />
            </Section>

            {(client.bank_name || client.account_number) && (
              <Section title="계좌">
                <Row label="은행" value={client.bank_name} />
                <Row label="계좌번호" value={client.account_number} mono />
                <Row label="예금주" value={client.account_holder} />
              </Section>
            )}

            {client.memo && (
              <Section title="메모">
                <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{client.memo}</p>
              </Section>
            )}

            <div className="pt-1">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${client.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {client.status === 'active' ? '활성' : '비활성'}
              </span>
              {client.source === 'memo' && <span className="text-xs ml-2 text-gray-400">메모에서 생성</span>}
              <span className="text-xs text-gray-400 ml-2">등록 {client.created_at.slice(0, 10)}</span>
            </div>
          </div>
        )}

        {tab === '업무' && (
          <div className="px-5 py-4 space-y-5">
            {/* 프로젝트 */}
            <Section title={`프로젝트 (${projects.length})`}>
              {projects.length === 0 ? (
                <p className="text-xs text-gray-400">연결된 프로젝트가 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {projects.map(p => {
                    const done = p.milestones?.filter(m => m.completed).length ?? 0
                    const total = p.milestones?.length ?? 0
                    return (
                      <li key={p.id} className="bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-800 truncate flex-1">{p.name}</span>
                          <span className={`text-xs ml-2 shrink-0 font-medium ${STATUS_COLOR[p.status] ?? 'text-gray-500'}`}>
                            {STATUS_LABEL[p.status] ?? p.status}
                          </span>
                        </div>
                        {total > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <div className="flex-1 bg-gray-200 rounded-full h-1">
                              <div
                                className="bg-indigo-500 h-1 rounded-full"
                                style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">{done}/{total}</span>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>

            {/* 예정 일정 */}
            <Section title={`예정 일정 (${events.length})`}>
              {events.length === 0 ? (
                <p className="text-xs text-gray-400">예정된 일정이 없습니다.</p>
              ) : (
                <ul className="space-y-1.5">
                  {events.map(e => (
                    <li key={e.id} className="flex items-start gap-2">
                      <div className="shrink-0 text-center">
                        <div className={`text-xs font-bold ${e.date === today ? 'text-indigo-600' : 'text-gray-600'}`}>
                          {e.date.slice(5)}
                        </div>
                        {e.time && <div className="text-xs text-gray-400">{e.time.slice(0, 5)}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 truncate">{e.title}</p>
                        {e.location && <p className="text-xs text-gray-400">📍 {e.location}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* 미완료 투두 */}
            <Section title={`미완료 할 일 (${todos.length})`}>
              {todos.length === 0 ? (
                <p className="text-xs text-gray-400">미완료 할 일이 없습니다.</p>
              ) : (
                <ul className="space-y-1.5">
                  {todos.map(t => (
                    <li key={t.id} className="flex items-start gap-2">
                      <span className={`text-xs mt-0.5 shrink-0 ${PRIORITY_COLOR[t.priority] ?? 'text-gray-400'}`}>●</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 truncate">{t.title}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {t.due_date && (
                            <span className={t.due_date < today ? 'text-red-400' : ''}>
                              {t.due_date < today ? '⚠ ' : ''}{t.due_date.slice(5)}
                            </span>
                          )}
                          {t.projects && <span className="truncate">{t.projects.name}</span>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* 활동 로그 */}
            {logs.length > 0 && (
              <Section title="활동 로그">
                <ul className="space-y-2">
                  {logs.slice(0, 10).map(log => (
                    <li key={log.id} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0 mt-1.5" />
                      <div>
                        <p className="text-xs text-gray-600">{formatLog(log)}</p>
                        <p className="text-xs text-gray-400">{log.created_at.slice(0, 16).replace('T', ' ')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ label, value, mono, highlight }: {
  label: string
  value: string | number | null | undefined
  mono?: boolean
  highlight?: boolean
}) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs flex-1 break-all ${mono ? 'font-mono text-gray-700' : highlight ? 'text-indigo-600 font-medium' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  )
}
