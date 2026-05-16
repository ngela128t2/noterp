import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ProjectFormModal from '../components/projects/ProjectFormModal'
import TemplatePickerModal from '../components/projects/TemplatePickerModal'
import { useClients } from '../hooks/useClients'
import { useAddMilestone, useCreateProject, useDeleteMilestone, useDeleteProject, useMilestones, useProjects, useToggleMilestone, useUpdateProject } from '../hooks/useProjects'
import { supabase } from '../lib/supabase'
import { shiftYear } from '../lib/projectTemplates'
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

function formatDueDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  return `(${year.slice(2)}/${parseInt(month)}/${parseInt(day)})`
}

function timeToKorean(timeStr: string) {
  if (!timeStr) return ''
  const [hStr, mStr] = timeStr.split(':')
  const h = parseInt(hStr)
  const m = parseInt(mStr ?? '0')
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m > 0 ? `${ampm}${h12}시${m}분` : `${ampm}${h12}시`
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
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templateMilestones, setTemplateMilestones] = useState<MilestoneInput[]>([])
  const [templateInitial, setTemplateInitial] = useState<Partial<Project>>({})
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

  const handleTemplateApply = (data: {
    name: string; type: string; type_detail: string
    start_date: string; end_date: string; client_id: string | null
    milestones: { title: string; due_date: string }[]
  }) => {
    setTemplateMilestones(data.milestones)
    setTemplateInitial({
      name: data.name,
      type: data.type,
      type_detail: data.type_detail,
      start_date: data.start_date,
      end_date: data.end_date,
      client_id: data.client_id ?? undefined,
    })
    setShowTemplatePicker(false)
    setModal('create')
  }

  const clearTemplateState = () => {
    setTemplateMilestones([])
    setTemplateInitial({})
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">프로젝트</h2>
          <p className="text-sm text-gray-400 mt-1">거래처와 기간 기준으로 프로젝트를 빠르게 찾아볼 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplatePicker(true)}
            className="px-3 py-2 border border-indigo-300 text-indigo-600 hover:bg-indigo-50 text-sm font-medium rounded-lg whitespace-nowrap"
          >
            템플릿으로 시작
          </button>
          <button
            onClick={() => { clearTemplateState(); setModal('create') }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm whitespace-nowrap"
          >
            + 직접 추가
          </button>
        </div>
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

      {showTemplatePicker && (
        <TemplatePickerModal
          clients={clients}
          onApply={handleTemplateApply}
          onBlank={() => { clearTemplateState(); setShowTemplatePicker(false); setModal('create') }}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}

      {modal !== null && (
        <ProjectFormModal
          initial={modal === 'create' ? templateInitial : modal}
          initialMilestones={modal === 'create' ? templateMilestones : undefined}
          clients={clients}
          error={saveError}
          onSave={handleSave}
          onClose={() => { setModal(null); setSaveError(null); clearTemplateState() }}
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
  const addMilestone = useAddMilestone()
  const deleteMilestone = useDeleteMilestone()
  const createProject = useCreateProject()
  const done = milestones.filter(m => m.completed).length
  const memoEntries = parseProjectMemo(project.memo)

  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [rollingOver, setRollingOver] = useState(false)

  const handleRollover = async () => {
    if (!confirm('이 프로젝트를 1년 후 날짜로 복사하겠습니까?')) return
    setRollingOver(true)
    try {
      const yearMatch = project.name.match(/\d{4}/)
      const nextYear = (yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear()) + 1
      const newName = yearMatch ? project.name.replace(yearMatch[0], String(nextYear)) : `${project.name} ${nextYear}`

      createProject.mutate({
        name: newName,
        client_id: project.client_id,
        type: project.type,
        type_detail: project.type_detail,
        start_date: project.start_date ? shiftYear(project.start_date, 1) : null,
        end_date: project.end_date ? shiftYear(project.end_date, 1) : null,
        status: 'preparing',
        manager_id: project.manager_id,
        memo: null,
        needs_review: false,
        source: 'rollover',
      }, {
        onSuccess: async (newProject) => {
          if (milestones.length > 0) {
            await supabase.from('milestones').insert(
              milestones.map(m => ({
                project_id: newProject.id,
                title: m.title,
                due_date: m.due_date ? shiftYear(m.due_date, 1) : null,
                completed: false,
              })),
            )
          }
        },
        onSettled: () => setRollingOver(false),
      })
    } catch {
      setRollingOver(false)
    }
  }

  const handleAddMilestone = async () => {
    const title = newTitle.trim()
    if (!title) return
    await addMilestone.mutateAsync({
      project_id: project.id,
      title,
      due_date: newDate || null,
      time: newTime || null,
    })
    setNewDate('')
    setNewTime('')
    setNewTitle('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddMilestone() }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* 카드 헤더 — 클릭 영역 */}
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        {/* 상단: 상태 뱃지 + 프로젝트명 */}
        <div className="flex items-start gap-2 mb-2.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-1 whitespace-nowrap ${STATUS_COLOR[project.status]}`}>
            {STATUS_LABEL[project.status]}
          </span>
          {project.needs_review && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" title="검토 필요" />}
        </div>
        {/* 프로젝트명 — 독립 블록으로 줄바꿈 보장 */}
        <p className="font-semibold text-gray-900 leading-snug mb-1.5">{project.name}</p>
        {/* 서브 정보: 거래처 / 기간 / 마일스톤 */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {project.clients && (
            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">{project.clients.name}</span>
          )}
          {(project.start_date || project.end_date) && (
            <span className="text-xs text-gray-400">{project.start_date ?? '미정'} ~ {project.end_date ?? '미정'}</span>
          )}
          {project.type && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {project.type}{project.type_detail ? ` · ${project.type_detail}` : ''}
            </span>
          )}
          {milestones.length > 0 && (
            <span className={`text-xs font-medium ${done === milestones.length ? 'text-emerald-500' : 'text-indigo-500'}`}>
              단계 {done}/{milestones.length}
            </span>
          )}
          {project.memo && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">메모</span>}
        </div>

        {/* 액션 버튼 행 — 별도 행 */}
        <div className="flex items-center gap-1 pt-1 border-t border-gray-50" onClick={e => e.stopPropagation()}>
          <Link
            to={`/workspace/project/${project.id}`}
            className="px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium"
          >
            워크스페이스
          </Link>
          <button onClick={onEdit} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">수정</button>
          <button
            onClick={handleRollover}
            disabled={rollingOver}
            className="px-3 py-1.5 text-xs text-amber-500 hover:bg-amber-50 rounded-lg disabled:opacity-40"
            title="1년 후 날짜로 동일 프로젝트 복사"
          >
            {rollingOver ? '복사 중...' : '↻ 새해 복사'}
          </button>
          <button onClick={onDelete} className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-50 rounded-lg">삭제</button>
          <span className="ml-auto text-xs text-gray-300">{expanded ? '접기' : '열기'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-4">
          {/* 프로젝트 메모 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">프로젝트 메모</p>
            {memoEntries.length > 0 ? (
              <div className="overflow-hidden border border-gray-100 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="text-left font-medium px-3 py-2 w-28 shrink-0">입력시간</th>
                      <th className="text-left font-medium px-3 py-2">내용</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {memoEntries.map((entry, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-xs text-gray-400 align-top w-28 max-w-[7rem]">
                          <span className="block truncate">{entry.time}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-700 text-sm whitespace-pre-wrap break-words">{entry.content}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400">아직 연결된 메모가 없습니다.</p>
            )}
          </div>

          {/* 타임라인 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">타임라인</p>

            {milestones.length > 0 && (
              <ol className="relative border-l-2 border-gray-100 ml-1.5 space-y-2 mb-3">
                {milestones.map(m => (
                  <li key={m.id} className="pl-4 relative group">
                    <span className={`absolute -left-[5px] top-2 w-2.5 h-2.5 rounded-full border-2 border-white ${m.completed ? 'bg-emerald-500' : 'bg-indigo-400'}`} />
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={m.completed}
                        onChange={e => toggleMilestone.mutate({ id: m.id, completed: e.target.checked, projectId: project.id })}
                        className="rounded accent-indigo-600 shrink-0"
                      />
                      {m.due_date && (
                        <span className="text-xs font-mono text-indigo-500 shrink-0">{formatDueDate(m.due_date)}</span>
                      )}
                      {m.time && (
                        <span className="text-xs text-indigo-400 shrink-0">{timeToKorean(m.time)}</span>
                      )}
                      <span className={`flex-1 ${m.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{m.title}</span>
                      <button
                        onClick={() => deleteMilestone.mutate({ id: m.id, projectId: project.id })}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs px-1 transition-opacity"
                        title="삭제"
                      >✕</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {/* 빠른 추가 — 모바일 2줄 / 데스크톱 1줄 */}
            <div className="mt-1 space-y-1.5">
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="w-24 shrink-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="내용 입력 후 Enter"
                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <button
                  onClick={handleAddMilestone}
                  disabled={!newTitle.trim() || addMilestone.isPending}
                  className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs rounded-lg whitespace-nowrap"
                >
                  + 추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
