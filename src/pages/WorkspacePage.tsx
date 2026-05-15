import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AISummaryPanel from '../components/workspace/AISummaryPanel'
import TimelineItemRow from '../components/workspace/TimelineItem'
import { useClientTimeline, useProjectTimeline } from '../hooks/useContextTimeline'
import { useClients } from '../hooks/useClients'
import { useContacts } from '../hooks/useContacts'
import { useClientProjects, useProjects } from '../hooks/useProjects'
import { useClientTodos, useProjectTodos } from '../hooks/useTodos'
import { useClientUpcomingEvents, useProjectCalendarEvents } from '../hooks/useCalendarEvents'
import { useWorkspaceStore } from '../store/workspaceStore'
import type { Client, Project } from '../types'

type Tab = 'timeline' | 'info' | 'contacts' | 'tasks' | 'events'

const STATUS_LABEL: Record<string, string> = {
  preparing: '준비', in_progress: '진행 중', review: '검토', completed: '완료',
}
const STATUS_COLOR: Record<string, string> = {
  preparing: 'bg-gray-100 text-gray-500', in_progress: 'bg-indigo-100 text-indigo-700',
  review: 'bg-amber-100 text-amber-700', completed: 'bg-emerald-100 text-emerald-700',
}

export default function WorkspacePage() {
  const { type, id } = useParams<{ type: string; id: string }>()
  const navigate = useNavigate()
  const setActiveContext = useWorkspaceStore(s => s.setActiveContext)
  const [tab, setTab] = useState<Tab>('timeline')

  const isClient = type === 'client'
  const isProject = type === 'project'
  const today = new Date().toISOString().split('T')[0]

  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const { data: contacts = [] } = useContacts()

  const client = isClient ? clients.find(c => c.id === id) : null
  const project = isProject ? projects.find(p => p.id === id) : null
  const name = client?.name ?? project?.name ?? '...'

  // Context-specific data
  const { data: clientProjects = [] } = useClientProjects(isClient ? (id ?? '') : '')
  const { data: clientTodos = [] } = useClientTodos(isClient ? (id ?? '') : '')
  const { data: clientEvents = [] } = useClientUpcomingEvents(isClient ? (id ?? '') : '')
  const { data: projectTodos = [] } = useProjectTodos(isProject ? (id ?? '') : '')
  const { data: projectEvents = [] } = useProjectCalendarEvents(isProject ? (id ?? '') : '')

  // Related client for project workspace
  const projectClient = project?.client_id ? clients.find(c => c.id === project.client_id) : null

  // Timeline feeds
  const clientTimeline = useClientTimeline(isClient ? (id ?? '') : '')
  const projectTimeline = useProjectTimeline(isProject ? (id ?? '') : '')
  const timeline = isClient ? clientTimeline : projectTimeline

  const clientProjectIds = useMemo(
    () => new Set(clientProjects.map(p => p.id)),
    [clientProjects]
  )

  const relatedContacts = useMemo(() =>
    contacts.filter(c =>
      (isClient && (c.client_id === id || clientProjectIds.has(c.project_id ?? ''))) ||
      (isProject && c.project_id === id) ||
      (isProject && projectClient && c.client_id === projectClient.id)
    ),
    [contacts, isClient, isProject, id, projectClient, clientProjectIds]
  )

  useEffect(() => {
    if (id && type) setActiveContext({ type: type as 'client' | 'project', id, name })
    return () => setActiveContext(null)
  }, [id, type, name, setActiveContext])

  const todos = isClient ? clientTodos : projectTodos
  const events = isClient ? clientEvents : projectEvents

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'timeline', label: '타임라인', count: timeline.length },
    { key: 'info', label: '정보' },
    { key: 'tasks', label: '할 일', count: todos.filter(t => !t.completed).length },
    { key: 'events', label: '일정', count: events.length },
    { key: 'contacts', label: '연결', count: (isClient ? clientProjects.length : 0) + relatedContacts.length },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
          <button onClick={() => navigate(isClient ? '/clients' : '/projects')} className="hover:text-indigo-600 transition-colors">
            {isClient ? '거래처' : '프로젝트'}
          </button>
          <span>/</span>
          {isProject && projectClient && (
            <>
              <Link to={`/workspace/client/${projectClient.id}`} className="hover:text-indigo-600 transition-colors">
                {projectClient.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-600 font-medium">{name}</span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {client?.code && (
                <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{client.code}</span>
              )}
              {project?.status && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[project.status]}`}>
                  {STATUS_LABEL[project.status]}
                </span>
              )}
              {client?.needs_review && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500">검토 필요</span>}
              {client?.service_category && (
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                  {client.service_category}{client.service_detail ? ` · ${client.service_detail}` : ''}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{name}</h1>
            {isClient && (
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                <span>프로젝트 <strong className="text-gray-700">{clientProjects.length}</strong>건</span>
                <span>할 일 <strong className="text-gray-700">{clientTodos.filter(t => !t.completed).length}</strong>건</span>
                <span>일정 <strong className="text-gray-700">{clientEvents.length}</strong>건</span>
                {timeline.length > 0 && (() => {
                  const lastDate = timeline[0].sortKey.slice(0, 10)
                  const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
                  const label = days === 0 ? '오늘' : days === 1 ? '어제' : `${days}일 전`
                  return (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] border ${days > 14 ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                      마지막 활동 {label}
                    </span>
                  )
                })()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => navigate('/memo', {
                state: isClient
                  ? { clientId: id, clientName: name }
                  : { projectId: id, projectName: name, clientId: project?.client_id ?? null, clientName: projectClient?.name ?? null }
              })}
              className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
            >
              + 메모
            </button>
            <button
              onClick={() => navigate(isClient ? '/clients' : '/projects')}
              className="px-3 py-1.5 text-xs border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg"
            >
              목록으로
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-0 mt-3 -mb-4 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 -mb-px ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="bg-indigo-100 text-indigo-600 text-xs px-1.5 py-0.5 rounded-full leading-none">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {/* 타임라인 */}
        {tab === 'timeline' && (
          <div className="max-w-3xl space-y-4">
            <AISummaryPanel contextId={id ?? ''} contextName={name} contextType={type ?? 'client'} items={timeline} />
            {timeline.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-400 text-sm">기록된 활동이 없습니다.</p>
                <button onClick={() => navigate('/memo')} className="mt-3 text-sm text-indigo-600 hover:underline">메모 입력하기</button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
                {timeline.map((item, i) => <TimelineItemRow key={i} item={item} />)}
              </div>
            )}
          </div>
        )}

        {/* 정보 */}
        {tab === 'info' && (
          <div className="max-w-2xl">
            {client && <ClientInfoPanel client={client} />}
            {project && <ProjectInfoPanel project={project} projectClient={projectClient} />}
          </div>
        )}

        {/* 할 일 */}
        {tab === 'tasks' && (
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">할 일 ({todos.length}건)</h3>
              <button onClick={() => navigate('/todos')} className="text-xs text-indigo-500 hover:underline">전체 보기</button>
            </div>
            {todos.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">할 일이 없습니다.</p>
            ) : (
              <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {todos.map(t => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${t.priority === 'high' ? 'bg-red-500' : t.priority === 'medium' ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                    <span className={`flex-1 text-sm ${t.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</span>
                    {t.due_date && (
                      <span className={`text-xs shrink-0 ${t.due_date < today ? 'text-red-400' : 'text-gray-400'}`}>
                        {t.due_date.slice(5)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 일정 */}
        {tab === 'events' && (
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">일정 ({events.length}건)</h3>
              <button onClick={() => navigate('/calendar')} className="text-xs text-indigo-500 hover:underline">캘린더로</button>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">일정이 없습니다.</p>
            ) : (
              <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {events.map((e: any) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xs text-blue-500 font-medium w-20 shrink-0">
                      {e.date.slice(5)} {e.time?.slice(0, 5) ?? '종일'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{e.title}</p>
                      {e.location && <p className="text-xs text-gray-400">📍 {e.location}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 연결 (프로젝트 + 연락처) */}
        {tab === 'contacts' && (
          <div className="max-w-2xl space-y-5">
            {/* 거래처 워크스페이스: 관련 프로젝트 리스트 */}
            {isClient && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-sm font-semibold text-gray-700">관련 프로젝트</h3>
                  <button onClick={() => navigate('/projects')} className="text-xs text-indigo-500 hover:underline">전체 보기</button>
                </div>
                {clientProjects.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">연결된 프로젝트가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {clientProjects.map((p: any) => (
                      <Link
                        key={p.id}
                        to={`/workspace/project/${p.id}`}
                        className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-indigo-300 hover:shadow-sm transition-all group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                          {p.type && <p className="text-xs text-gray-400">{p.type}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.status]}`}>
                            {STATUS_LABEL[p.status]}
                          </span>
                          <span className="text-xs text-gray-300 group-hover:text-indigo-400 transition-colors">→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 연락처 */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-semibold text-gray-700">연락처 ({relatedContacts.length}명)</h3>
                <button onClick={() => navigate('/contacts')} className="text-xs text-indigo-500 hover:underline">N-CRM으로</button>
              </div>
              {relatedContacts.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">연결된 연락처가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {relatedContacts.map((c: any) => (
                    <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {c.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                          {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
                          {c.company && <p className="text-xs text-gray-400">{c.company}</p>}
                        </div>
                      </div>
                      {(c.phone || c.email) && (
                        <div className="mt-2 space-y-0.5">
                          {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                          {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 거래처 정보 패널
function ClientInfoPanel({ client }: { client: Client }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <InfoSection title="기본 정보">
        <Row label="사업자번호" value={client.business_number} mono />
        <Row label="법인번호" value={client.corp_number} mono />
        <Row label="대표자" value={client.representative} />
        <Row label="개업일" value={client.established_date} />
        <Row label="거래처유형" value={client.client_type} />
        <Row label="관할세무서" value={client.tax_office} />
        <Row label="계약일" value={client.contract_date} highlight />
      </InfoSection>
      <InfoSection title="용역 정보">
        <Row label="제공 용역" value={client.service_category ? `${client.service_category}${client.service_detail ? ' / ' + client.service_detail : ''}` : null} />
        <Row label="과세유형" value={client.tax_type} />
        <Row label="담당자" value={client.manager} />
      </InfoSection>
      {(client.contact_phone || client.contact_email || client.address) && (
        <InfoSection title="연락처">
          <Row label="전화번호" value={client.contact_phone} />
          <Row label="이메일" value={client.contact_email} />
          <Row label="주소" value={client.address} />
        </InfoSection>
      )}
    </div>
  )
}

// 프로젝트 정보 패널
function ProjectInfoPanel({ project, projectClient }: { project: Project; projectClient: Client | null | undefined }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <InfoSection title="프로젝트 정보">
        {projectClient && <Row label="거래처" value={projectClient.name} />}
        <Row label="유형" value={project.type ? `${project.type}${project.type_detail ? ' / ' + project.type_detail : ''}` : null} />
        <Row label="시작일" value={project.start_date} />
        <Row label="종료일" value={project.end_date} />
      </InfoSection>
      {project.memo && (
        <InfoSection title="프로젝트 메모">
          <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{project.memo.slice(0, 500)}{project.memo.length > 500 ? '...' : ''}</p>
        </InfoSection>
      )}
    </div>
  )
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ label, value, mono, highlight }: { label: string; value: string | number | null | undefined; mono?: boolean; highlight?: boolean }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs flex-1 break-all ${mono ? 'font-mono text-gray-700' : highlight ? 'text-indigo-600 font-medium' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}
