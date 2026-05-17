import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AISummaryPanel from '../components/workspace/AISummaryPanel'
import TimelineItemRow from '../components/workspace/TimelineItem'
import ActivityFeedPanel from '../components/workspace/ActivityFeedPanel'
import { useClientTimeline, useProjectTimeline } from '../hooks/useContextTimeline'
import { useClients, useDismissReview } from '../hooks/useClients'
import { useContacts } from '../hooks/useContacts'
import { useClientProjects, useProjects } from '../hooks/useProjects'
import { useWorkspaceStore } from '../store/workspaceStore'
import type { Client, Project } from '../types'

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
  const [infoOpen, setInfoOpen] = useState(false)

  const isClient = type === 'client'
  const isProject = type === 'project'

  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const { data: contacts = [] } = useContacts()
  const dismissReview = useDismissReview()

  const client = isClient ? clients.find(c => c.id === id) : null
  const project = isProject ? projects.find(p => p.id === id) : null
  const name = client?.name ?? project?.name ?? '...'

  const { data: clientProjects = [] } = useClientProjects(isClient ? (id ?? '') : '')
  const projectClient = project?.client_id ? clients.find(c => c.id === project.client_id) : null

  const clientTimeline = useClientTimeline(isClient ? (id ?? '') : '')
  const projectTimeline = useProjectTimeline(isProject ? (id ?? '') : '')
  const timeline = isClient ? clientTimeline : projectTimeline

  const clientProjectIds = useMemo(() => new Set(clientProjects.map(p => p.id)), [clientProjects])

  const relatedContacts = useMemo(() =>
    contacts.filter(c =>
      (isClient && (c.client_id === id || clientProjectIds.has(c.project_id ?? ''))) ||
      (isProject && c.project_id === id) ||
      (isProject && projectClient && c.client_id === projectClient.id)
    ),
    [contacts, isClient, isProject, id, projectClient, clientProjectIds]
  )

  const workItems = useMemo(() =>
    timeline
      .filter(t => t.kind === 'work' && !t.item.completed)
      .sort((a, b) => {
        const ad = a.kind === 'work' ? a.item.date : null
        const bd = b.kind === 'work' ? b.item.date : null
        if (!ad && !bd) return 0
        if (!ad) return 1
        if (!bd) return -1
        return ad.localeCompare(bd)
      }),
    [timeline]
  )

  useEffect(() => {
    if (id && type) setActiveContext({ type: type as 'client' | 'project', id, name })
    return () => setActiveContext(null)
  }, [id, type, name, setActiveContext])

  const memoState = isClient
    ? { clientId: id, clientName: name }
    : { projectId: id, projectName: name, clientId: project?.client_id ?? null, clientName: projectClient?.name ?? null }

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
              onClick={() => navigate('/memo', { state: memoState })}
              className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
            >
              + 메모
            </button>
            <button
              onClick={() => navigate(isClient ? '/clients' : '/projects')}
              className="px-3 py-1.5 text-xs border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg"
            >
              목록
            </button>
          </div>
        </div>
      </div>

      {/* 단일 스크롤 컨텐츠 */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="max-w-3xl space-y-6">

          {/* needs_review — 간결하게 */}
          {client?.needs_review && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <span className="text-amber-500 text-xs shrink-0">⚠️ AI 자동 생성 항목 포함</span>
              <button
                onClick={() => dismissReview.mutate(id!)}
                className="ml-auto text-xs px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 font-medium rounded-lg transition-colors shrink-0"
              >
                확인 완료
              </button>
            </div>
          )}

          {/* AI 요약 */}
          <AISummaryPanel contextId={id ?? ''} contextName={name} contextType={type ?? 'client'} items={timeline} />

          {/* 진행 중 업무 */}
          {workItems.length > 0 && (
            <WorkItemsSection
              items={workItems}
              projects={isClient ? clientProjects : []}
              onMemo={() => navigate('/memo', { state: memoState })}
            />
          )}

          {/* 활동 피드 */}
          <ActivityFeedPanel
            clientId={isClient ? (id ?? '') : undefined}
            projectId={isProject ? (id ?? '') : undefined}
          />

          {/* 관련 프로젝트 (거래처 워크스페이스) */}
          {isClient && clientProjects.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">관련 프로젝트</h3>
                <button onClick={() => navigate('/projects')} className="text-xs text-gray-400 hover:text-indigo-500">전체 →</button>
              </div>
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
            </div>
          )}

          {/* 연락처 */}
          {relatedContacts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">연락처 ({relatedContacts.length}명)</h3>
                <button onClick={() => navigate('/contacts')} className="text-xs text-gray-400 hover:text-indigo-500">N-CRM →</button>
              </div>
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
                        {c.phone && (
                          <div className="flex items-center gap-2">
                            <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition-colors flex-1">
                              <span>📞</span>{c.phone}
                            </a>
                            <a href={`sms:${c.phone}`} className="text-xs text-gray-400 hover:text-emerald-600 transition-colors shrink-0 px-1.5 py-0.5 rounded bg-gray-100 hover:bg-emerald-50">💬</a>
                          </div>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition-colors">
                            <span>✉</span>{c.email}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 기본 정보 — 접기/펼치기 */}
          <div>
            <button
              onClick={() => setInfoOpen(v => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition-colors"
            >
              <span>{infoOpen ? '▾' : '▸'}</span>
              기본 정보
            </button>
            {infoOpen && (
              <div className="mt-3">
                {client && <ClientInfoPanel client={client} />}
                {project && <ProjectInfoPanel project={project} projectClient={projectClient} />}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── 거래처 정보 ────────────────────────────────────────────────────────────────

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
        <InfoSection title="메모">
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

// ── 진행 중 업무 섹션 ──────────────────────────────────────────────────────────

function WorkItemsSection({
  items, projects, onMemo,
}: {
  items: import('../hooks/useContextTimeline').TimelineItem[]
  projects: Project[]
  onMemo: () => void
}) {
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])

  const grouped = useMemo(() => {
    const groups = new Map<string | null, import('../hooks/useContextTimeline').TimelineItem[]>()
    for (const t of items) {
      if (t.kind !== 'work') continue
      const pid = t.item.projectId ?? null
      if (!groups.has(pid)) groups.set(pid, [])
      groups.get(pid)!.push(t)
    }
    return groups
  }, [items])

  const sortedKeys = useMemo(() => {
    const keys = [...grouped.keys()]
    return keys.sort((a, b) => a === null ? 1 : b === null ? -1 : 0)
  }, [grouped])

  if (sortedKeys.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">진행 중 업무</p>
        <button onClick={onMemo} className="text-xs text-indigo-500 hover:underline">+ 메모</button>
      </div>
      {sortedKeys.map(pid => {
        const groupItems = grouped.get(pid)!
        const proj = pid ? projectMap.get(pid) : null
        const groupLabel = proj?.name ?? (pid ? pid : '직접 연결')
        return (
          <div key={pid ?? '__direct'}>
            {projects.length > 0 && (
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <span className="text-xs font-medium text-gray-700 truncate">{groupLabel}</span>
                {proj?.status && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLOR[proj.status]}`}>
                    {STATUS_LABEL[proj.status]}
                  </span>
                )}
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
              {groupItems.map((item, i) => <TimelineItemRow key={i} item={item} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
