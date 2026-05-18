import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useTodayFlow, type StreamItem, type StreamGroup, type StreamOrphan } from '../../hooks/useActivityStream'

function timeLabel(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const TYPE_LABEL: Record<StreamItem['stream_type'], string> = {
  memo: '메모',
  event: '일정',
  todo: '할 일',
  milestone: '마일스톤',
  activity: '활동',
}

const TYPE_DOT: Record<StreamItem['stream_type'], string> = {
  memo: 'bg-amber-400',
  event: 'bg-blue-400',
  todo: 'bg-orange-400',
  milestone: 'bg-purple-400',
  activity: 'bg-gray-300',
}

function navigateToWorkspace(item: StreamItem, navigate: ReturnType<typeof useNavigate>) {
  if (item.client_id)  return navigate(`/workspace/client/${item.client_id}`)
  if (item.project_id) return navigate(`/workspace/project/${item.project_id}`)
  switch (item.stream_type) {
    case 'event':     return navigate('/calendar')
    case 'todo':      return navigate('/todos')
    case 'milestone': return navigate('/projects')
    default:          return navigate('/memo')
  }
}

// ── 메모 카드 — 기본 압축 / 클릭 시 펼침 ─────────────────────────────────

// todo의 priority (extra 컬럼)별 시각화
const PRIORITY_META: Record<string, { dot: string; label: string; text: string }> = {
  high:   { dot: 'bg-rose-500',   label: '높음', text: 'text-rose-600' },
  medium: { dot: 'bg-amber-400',  label: '보통', text: 'text-amber-600' },
  low:    { dot: 'bg-gray-300',   label: '낮음', text: 'text-gray-400' },
}

function MemoCard({ memo, derived }: StreamGroup) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  // 공통 거래처/프로젝트 (1개씩만 표시 — 압축)
  const primaryClient = derived.find(d => d.client_name)?.client_name ?? null
  const primaryProject = derived.find(d => d.project_name)?.project_name ?? null

  // 타입별 카운트
  const counts = derived.reduce((acc, d) => {
    acc[d.stream_type] = (acc[d.stream_type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  // 높은 우선순위 todo 카운트 (priority는 extra 컬럼)
  const highPriorityCount = derived.filter(d => d.stream_type === 'todo' && d.extra === 'high').length

  const summaryParts: string[] = []
  if (counts.event)     summaryParts.push(`일정 ${counts.event}건`)
  if (counts.todo)      summaryParts.push(`할 일 ${counts.todo}건`)
  if (counts.milestone) summaryParts.push(`마일스톤 ${counts.milestone}건`)

  const hasDerived = derived.length > 0
  const hasUrgent = highPriorityCount > 0

  return (
    <div className={`bg-white rounded-xl border transition-colors overflow-hidden ${
      hasUrgent
        ? 'border-rose-200 hover:border-rose-300'
        : 'border-gray-100 hover:border-amber-200'
    }`}>
      {/* 헤더 — 본문 클릭 = 상세 페이지 / 화살표 클릭 = 인라인 펼침 */}
      <div
        onClick={() => navigate(`/memo/${memo.id}`)}
        className="w-full text-left px-3.5 py-3 group cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm leading-none shrink-0">📝</span>
          <p className="flex-1 min-w-0 text-sm font-semibold text-gray-900 group-hover:text-indigo-600 truncate break-keep">
            {memo.title}
          </p>
          {hasUrgent && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 shrink-0"
              title={`긴급/마감 임박 할 일 ${highPriorityCount}건`}
            >
              ❗{highPriorityCount}
            </span>
          )}
          <span className="text-[10px] font-mono text-gray-300 shrink-0">{timeLabel(memo.created_at)}</span>
          {hasDerived && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
              className="text-gray-300 hover:text-gray-600 shrink-0 -m-1 p-1"
              aria-label={expanded ? '접기' : '펼치기'}
            >
              <ChevronDown
                size={14}
                className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>

        {/* 요약 라인 — 거래처/프로젝트 + 카운트 (압축 모드) */}
        {(primaryClient || primaryProject || summaryParts.length > 0) && (
          <div className="pl-7 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] min-w-0">
            {primaryClient && (
              <span className="text-indigo-500 font-medium truncate max-w-[40%] break-keep" title={primaryClient}>
                거래처 · {primaryClient}
              </span>
            )}
            {primaryClient && primaryProject && <span className="text-gray-200">/</span>}
            {primaryProject && (
              <span className="text-purple-500 font-medium truncate max-w-[40%] break-keep" title={primaryProject}>
                프로젝트 · {primaryProject}
              </span>
            )}
            {summaryParts.length > 0 && (
              <>
                {(primaryClient || primaryProject) && <span className="text-gray-200 mx-0.5">·</span>}
                <span className="text-gray-400">{summaryParts.join(' · ')}</span>
                {hasUrgent && (
                  <span className="text-rose-500 font-medium">· 급함 {highPriorityCount}</span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 펼침 — 개별 파생 항목 */}
      {expanded && hasDerived && (
        <div className="border-t border-gray-50 bg-gray-50/30 divide-y divide-gray-50">
          {derived.map(d => {
            const priorityMeta = d.stream_type === 'todo' && d.extra ? PRIORITY_META[d.extra] : null
            return (
              <button
                key={`${d.stream_type}-${d.id}`}
                onClick={(e) => { e.stopPropagation(); navigateToWorkspace(d, navigate) }}
                className="w-full flex items-center gap-2 px-3.5 py-1.5 hover:bg-white transition-colors text-left min-w-0"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityMeta?.dot ?? TYPE_DOT[d.stream_type]}`} />
                <span className="text-[10px] text-gray-400 shrink-0 w-12">{TYPE_LABEL[d.stream_type]}</span>
                <span className="flex-1 min-w-0 text-xs text-gray-600 truncate break-keep">{d.title}</span>
                {priorityMeta && (
                  <span className={`text-[9px] font-semibold shrink-0 ${priorityMeta.text}`}>
                    {priorityMeta.label}
                  </span>
                )}
              </button>
            )
          })}
          <div className="px-3.5 py-2 flex justify-end gap-2 bg-gray-50/50">
            <button
              onClick={() => navigate('/memo')}
              className="text-[11px] text-gray-400 hover:text-indigo-500"
            >
              원본 메모 →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Orphan — 메모 없이 직접 추가 ─────────────────────────────────────
function OrphanRow({ item }: { item: StreamItem }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigateToWorkspace(item, navigate)}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left group min-w-0"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[item.stream_type]}`} />
      <span className="text-[11px] text-gray-400 shrink-0 w-10">{TYPE_LABEL[item.stream_type]}</span>
      <span className="flex-1 min-w-0 text-xs text-gray-600 group-hover:text-indigo-600 truncate break-keep">{item.title}</span>
      <span className="text-[10px] font-mono text-gray-300 shrink-0">{timeLabel(item.created_at)}</span>
    </button>
  )
}

export default function TodayFlow() {
  const { rows, isLoading } = useTodayFlow()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-800">오늘의 흐름</h2>
        </div>
        <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
      </section>
    )
  }

  const memoGroups = rows.filter((r): r is StreamGroup => r.kind === 'memo-group')
  const orphans = rows.filter((r): r is StreamOrphan => r.kind === 'orphan')

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-gray-800">오늘의 흐름</h2>
          {memoGroups.length > 0 && (
            <span className="text-[11px] text-gray-400">{memoGroups.length}건</span>
          )}
        </div>
        <button onClick={() => navigate('/memo')}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
          + 메모
        </button>
      </div>

      {memoGroups.length === 0 && orphans.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-6 text-center">
          <p className="text-sm text-gray-400">오늘 새로 생긴 업무가 없습니다</p>
          <button onClick={() => navigate('/memo')} className="mt-2 text-xs text-indigo-500 hover:underline">
            메모로 시작하기 →
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {memoGroups.map(g => (
            <MemoCard key={g.memo.id} {...g} />
          ))}

          {orphans.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mt-2">
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                직접 추가
              </div>
              <div className="divide-y divide-gray-50">
                {orphans.map(o => (
                  <OrphanRow key={`${o.item.stream_type}-${o.item.id}`} item={o.item} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
