import { useMemo, useState } from 'react'
import ProjectFormModal from '../components/projects/ProjectFormModal'
import { useClients } from '../hooks/useClients'
import { useCreateProject, useDeleteProject, useMilestones, useProjects, useToggleMilestone, useUpdateProject } from '../hooks/useProjects'
import { supabase } from '../lib/supabase'
import type { Project } from '../types'

interface MilestoneInput {
  title: string
  due_date: string
}

type ProjectWithClient = Project & { clients: { name: string } | null }

const STATUS_LABEL: Record<Project['status'], string> = {
  preparing: '준비',
  in_progress: '진행 중',
  review: '검토',
  completed: '완료',
}

const STATUS_COLOR: Record<Project['status'], string> = {
  preparing: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-indigo-100 text-indigo-700',
  review: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
}

function parseProjectMemo(memo: string | null | undefined) {
  if (!memo?.trim()) return []
  const entries = Array.from(memo.matchAll(/\[([^\]]+)\]\n([\s\S]*?)(?=\n\n\[[^\]]+\]\n|$)/g))
  if (!entries.length) return [{ time: '-', content: memo.trim() }]
  return entries.map(match => ({ time: match[1], content: match[2].trim() }))
}

function matchesPeriod(project: ProjectWithClient, startFilter: string, endFilter: string) {
  const projectStart = project.start_date ?? project.end_date ?? '0000-01-01'
  const projectEnd = project.end_date ?? project.start_date ?? '9999-12-31'
  if (startFilter && projectEnd < startFilter) return false
  if (endFilter && projectStart > endFilter) return false
  return true
}

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects()
  const { data: clients = [] } = useClients()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  const [modal, setModal] = useState<'create' | Project | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [startFilter, setStartFilter] = useState('')
  const [endFilter, setEndFilter] = useState('')

  const filteredProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return (projects ?? []).filter(project => {
      if (clientFilter && project.client_id !== clientFilter) return false
      if (!matchesPeriod(project, startFilter, endFilter)) return false
      if (!keyword) return true

      const searchable = [
        project.name,
        project.clients?.name,
        project.type,
        project.type_detail,
        project.memo,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchable.includes(keyword)
    })
  }, [projects, search, clientFilter, startFilter, endFilter])

  const resetFilters = () => {
    setSearch('')
    setClientFilter('')
    setStartFilter('')
    setEndFilter('')
  }

  const handleSave = async (data: Omit<Project, 'id' | 'created_at'>, milestones: MilestoneInput[]) => {
    setSaveError(null)
    if (modal === 'create') {
      createProject.mutate(data, {
        onSuccess: async (project) => {
          if (milestones.length > 0) {
            const { error } = await supabase.from('milestones').insert(
              milestones.map(milestone => ({
                project_id: project.id,
                title: milestone.title,
                due_date: milestone.due_date || null,
                completed: false,
              })),
            )
            if (error) console.error('마일스톤 저장 오류:', error)
          }
          setModal(null)
        },
        onError: (error) => setSaveError(error.message),
      })
    } else if (modal && typeof modal === 'object') {
      updateProject.mutate({ id: modal.id, ...data }, {
        onSuccess: () => setModal(null),
        onError: (error) => setSaveError(error.message),
      })
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('프로젝트를 삭제하시겠습니까?')) deleteProject.mutate(id)
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">프로젝트</h2>
          <p className="text-sm text-gray-400 mt-1">거래처와 기간 기준으로 프로젝트를 빠르게 찾아볼 수 있습니다.</p>
        </div>
        <button onClick={() => setModal('create')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm whitespace-nowrap">
          + 프로젝트 추가
        </button>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="프로젝트명, 메모 검색"
            className="md:col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          />
          <select
            value={clientFilter}
            onChange={event => setClientFilter(event.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          >
            <option value="">전체 거래처</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={startFilter}
            onChange={event => setStartFilter(event.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
            aria-label="조회 시작일"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={endFilter}
              onChange={event => setEndFilter(event.target.value)}
              className="min-w-0 flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              aria-label="조회 종료일"
            />
            <button onClick={resetFilters} className="px-3 py-2 text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg whitespace-nowrap">
              초기화
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : (projects ?? []).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
          <p className="text-gray-400 text-sm mb-3">등록된 프로젝트가 없습니다.</p>
          <button onClick={() => setModal('create')} className="text-sm text-indigo-600 hover:underline">첫 프로젝트 추가하기</button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
          <p className="text-gray-400 text-sm mb-3">조건에 맞는 프로젝트가 없습니다.</p>
          <button onClick={resetFilters} className="text-sm text-indigo-600 hover:underline">검색 조건 초기화</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProjects.map(project => (
            <ProjectRow
              key={project.id}
              project={project}
              expanded={expanded === project.id}
              onToggle={() => setExpanded(expanded === project.id ? null : project.id)}
              onEdit={() => setModal(project)}
              onDelete={() => handleDelete(project.id)}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <ProjectFormModal
          initial={modal === 'create' ? undefined : modal}
          clients={clients}
          error={saveError}
          onSave={handleSave}
          onClose={() => { setModal(null); setSaveError(null) }}
        />
      )}
    </div>
  )
}

function ProjectRow({
  project, expanded, onToggle, onEdit, onDelete,
}: {
  project: ProjectWithClient
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { data: milestones = [] } = useMilestones(project.id)
  const toggleMilestone = useToggleMilestone()
  const done = milestones.filter(milestone => milestone.completed).length
  const memoEntries = parseProjectMemo(project.memo)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4 flex items-center justify-between cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${STATUS_COLOR[project.status]}`}>
            {STATUS_LABEL[project.status]}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-gray-900 truncate">{project.name}</span>
              {project.needs_review && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="검토 필요" />}
              {project.type && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                  {project.type}{project.type_detail ? ` · ${project.type_detail}` : ''}
                </span>
              )}
              {project.memo && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full shrink-0">메모</span>}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex gap-3 flex-wrap">
              {project.clients && <span>거래처 {project.clients.name}</span>}
              {(project.start_date || project.end_date) && <span>{project.start_date ?? '미정'} ~ {project.end_date ?? '미정'}</span>}
              {milestones.length > 0 && <span className={done === milestones.length ? 'text-emerald-500' : ''}>단계 {done}/{milestones.length}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={event => { event.stopPropagation(); onEdit() }} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">수정</button>
          <button onClick={event => { event.stopPropagation(); onDelete() }} className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-50 rounded-lg">삭제</button>
          <span className="text-gray-300 ml-1 text-xs">{expanded ? '접기' : '열기'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">프로젝트 메모</p>
            {memoEntries.length > 0 ? (
              <div className="overflow-hidden border border-gray-100 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="text-left font-medium px-3 py-2 w-40">입력시간</th>
                      <th className="text-left font-medium px-3 py-2">내용</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {memoEntries.map((entry, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 text-xs text-gray-400 align-top whitespace-nowrap">{entry.time}</td>
                        <td className="px-3 py-2 text-gray-700 whitespace-pre-wrap">{entry.content}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400">아직 연결된 메모가 없습니다.</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">타임라인</p>
            {milestones.length === 0 ? (
              <p className="text-xs text-gray-400">마일스톤이 없습니다.</p>
            ) : (
              <ol className="relative border-l border-gray-200 ml-2 space-y-3">
                {milestones.map(milestone => (
                  <li key={milestone.id} className="pl-4 text-sm relative">
                    <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${milestone.completed ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={milestone.completed}
                        onChange={event => toggleMilestone.mutate({ id: milestone.id, completed: event.target.checked, projectId: project.id })}
                        className="rounded"
                      />
                      <span className={milestone.completed ? 'line-through text-gray-400' : 'text-gray-700'}>{milestone.title}</span>
                      {milestone.due_date && <span className="text-xs text-gray-400 ml-auto">{milestone.due_date}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
