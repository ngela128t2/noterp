import { useEffect, useMemo, useRef, useState } from 'react'
import { useClientActivityFeed, useProjectActivityFeed, type FeedFilter } from '../../hooks/useActivityFeed'
import { useToggleActivityPin, type ActivityLog } from '../../hooks/useLogs'
import { useClientProjects } from '../../hooks/useProjects'
import { getLocalDate, localDateOffset } from '../../lib/dateUtils'

// ── 유틸 ────────────────────────────────────────────────────────────

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  if (h < 24) return `${h}시간 전`
  if (d < 2) return '어제'
  if (d < 7) return `${d}일 전`
  const dt = new Date(isoStr)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

function dateGroup(isoStr: string): string {
  const date = isoStr.slice(0, 10)
  const today = getLocalDate()
  const yest = localDateOffset(-1)
  if (date === today) return '오늘'
  if (date === yest) return '어제'
  const days = Math.floor((Date.now() - new Date(date + 'T00:00:00').getTime()) / 86400000)
  if (days < 7) {
    const labels = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
    return labels[new Date(date + 'T00:00:00').getDay()]
  }
  const d = new Date(date + 'T00:00:00')
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

type NarrativeItem = {
  icon: string
  iconBg: string
  title: string
  detail?: string
  badge?: string
  badgeCls?: string
}

function toNarrative(log: ActivityLog): NarrativeItem {
  const STATUS: Record<string, string> = {
    preparing: '준비', in_progress: '진행 중', review: '검토', completed: '완료',
  }
  const ENTITY: Record<string, string> = {
    client: '거래처', project: '프로젝트', todo: '할 일',
    calendar_event: '일정', contact: '연락처', memo: '메모', milestone: '마일스톤',
  }

  if (log.action === 'memo_linked') {
    return {
      icon: '📝', iconBg: 'bg-violet-100',
      title: log.entity_name ? `"${log.entity_name}"에 메모 연결` : '메모 연결',
      detail: log.detail?.memo,
      badge: '메모', badgeCls: 'bg-violet-50 text-violet-600 border-violet-200',
    }
  }

  if (log.action === 'completed') {
    const label = ENTITY[log.entity_type] ?? log.entity_type
    return {
      icon: '✓', iconBg: 'bg-emerald-100',
      title: log.entity_name ?? `${label} 완료`,
      badge: `${label} 완료`, badgeCls: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    }
  }

  if (log.detail?.status_from && log.detail?.status_to) {
    return {
      icon: '⇄', iconBg: 'bg-amber-100',
      title: log.entity_name ?? '상태 변경',
      detail: `${STATUS[log.detail.status_from] ?? log.detail.status_from} → ${STATUS[log.detail.status_to] ?? log.detail.status_to}`,
      badge: '상태 변경', badgeCls: 'bg-amber-50 text-amber-600 border-amber-200',
    }
  }

  if (log.action === 'created') {
    const label = ENTITY[log.entity_type] ?? log.entity_type
    return {
      icon: '+', iconBg: 'bg-blue-100',
      title: log.entity_name ? `${log.entity_name}` : `${label} 등록`,
      badge: `${label} 등록`, badgeCls: 'bg-blue-50 text-blue-600 border-blue-200',
    }
  }

  if (log.action === 'updated') {
    return {
      icon: '✏', iconBg: 'bg-gray-100',
      title: log.entity_name ?? '항목 수정',
      badge: '수정', badgeCls: 'bg-gray-50 text-gray-500 border-gray-200',
    }
  }

  if (log.action === 'approved') {
    return {
      icon: '✦', iconBg: 'bg-indigo-100',
      title: log.entity_name ? `"${log.entity_name}" 메모 승인` : '메모 승인됨',
      badge: '승인', badgeCls: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    }
  }

  return {
    icon: '·', iconBg: 'bg-gray-100',
    title: log.entity_name ?? log.action,
  }
}

// ── 필터 정의 ────────────────────────────────────────────────────────

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: '전체', label: '전체' },
  { key: '메모', label: '메모' },
  { key: '완료', label: '완료' },
  { key: '기록', label: '등록/수정' },
]

// ── ActivityItem ─────────────────────────────────────────────────────

function ActivityItem({ log, onTogglePin }: {
  log: ActivityLog
  onTogglePin: (id: string, pinned: boolean) => void
}) {
  const n = toNarrative(log)
  return (
    <div className={`group flex items-start gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors ${log.pinned ? 'bg-amber-50/30' : ''}`}>
      {/* 아이콘 */}
      <div className={`w-7 h-7 rounded-full ${n.iconBg} flex items-center justify-center text-xs shrink-0 mt-0.5`}>
        {n.icon}
      </div>

      {/* 본문 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 leading-snug">{n.title}</p>
            {n.detail && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{n.detail}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {n.badge && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${n.badgeCls}`}>
                {n.badge}
              </span>
            )}
            {log.pinned && (
              <span className="text-[10px] text-amber-500">📌</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-gray-400">{relativeTime(log.created_at)}</span>
          {/* pin 버튼 - hover 시에만 표시 */}
          <button
            onClick={() => onTogglePin(log.id, !log.pinned)}
            className={`text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ${log.pinned ? 'text-amber-400 opacity-100' : 'text-gray-300 hover:text-amber-400'}`}
            title={log.pinned ? '고정 해제' : '고정'}
          >
            {log.pinned ? '📌 고정됨' : '📌 고정'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ActivityFeedPanel ─────────────────────────────────────────────────

interface Props {
  clientId?: string
  projectId?: string
}

export default function ActivityFeedPanel({ clientId, projectId }: Props) {
  const [filter, setFilter] = useState<FeedFilter>('전체')
  const sentinelRef = useRef<HTMLDivElement>(null)
  const togglePin = useToggleActivityPin()

  // 거래처 모드: 프로젝트 IDs 수집 (더 넓은 피드 조회)
  const { data: clientProjects = [] } = useClientProjects(clientId ?? '')
  const projectIds = useMemo(
    () => clientProjects.map(p => p.id),
    [clientProjects],
  )

  const clientFeed = useClientActivityFeed(
    clientId ?? '',
    projectIds,
    filter,
  )
  const projectFeed = useProjectActivityFeed(projectId ?? '', filter)

  const feed = clientId ? clientFeed : projectFeed
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = feed

  // 모든 페이지 아이템 합산
  const allItems = useMemo(
    () => data?.pages.flatMap(p => p.items) ?? [],
    [data],
  )

  // 날짜 그룹핑
  const grouped = useMemo(() => {
    const groups: { date: string; label: string; items: ActivityLog[] }[] = []
    for (const item of allItems) {
      const label = dateGroup(item.created_at)
      const last = groups[groups.length - 1]
      if (last && last.label === label) {
        last.items.push(item)
      } else {
        groups.push({ date: item.created_at.slice(0, 10), label, items: [item] })
      }
    }
    return groups
  }, [allItems])

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    }, { threshold: 0.1 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleTogglePin = (id: string, pinned: boolean) => {
    togglePin.mutate({ id, pinned })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 헤더 + 필터 */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">활동 기록</p>
        <div className="flex items-center gap-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                filter === f.key
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 피드 */}
      {status === 'pending' ? (
        <div className="px-4 py-8 text-center">
          <div className="inline-block w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : status === 'error' ? (
        <p className="px-4 py-6 text-sm text-gray-400 text-center">활동 기록을 불러오지 못했습니다.</p>
      ) : grouped.length === 0 ? (
        <p className="px-4 py-8 text-sm text-gray-400 text-center">아직 기록된 활동이 없습니다.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {grouped.map(group => (
            <div key={group.date}>
              {/* 날짜 구분선 */}
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50/60">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              {group.items.map(log => (
                <ActivityItem key={log.id} log={log} onTogglePin={handleTogglePin} />
              ))}
            </div>
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" />

          {isFetchingNextPage && (
            <div className="px-4 py-4 text-center">
              <div className="inline-block w-4 h-4 border-2 border-gray-200 border-t-indigo-400 rounded-full animate-spin" />
            </div>
          )}

          {!hasNextPage && allItems.length > 0 && (
            <p className="px-4 py-3 text-[11px] text-gray-300 text-center">
              전체 {allItems.length}건 · 더 이상 기록이 없습니다
            </p>
          )}
        </div>
      )}
    </div>
  )
}
