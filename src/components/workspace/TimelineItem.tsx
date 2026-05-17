import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToggleMilestone, useDeleteMilestone } from '../../hooks/useProjects'
import { useToggleTodo, useDeleteTodo } from '../../hooks/useTodos'
import { useCompleteCalendarEvent, useDeleteCalendarEvent } from '../../hooks/useCalendarEvents'
import { getLocalDate } from '../../lib/dateUtils'
import { formatLog, type ActivityLog } from '../../hooks/useLogs'
import type { TimelineItem, WorkItem } from '../../hooks/useContextTimeline'

function formatDay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

function formatDateTime(isoStr: string) {
  const d = new Date(isoStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const SOURCE_DOT: Record<string, string> = {
  event: 'bg-blue-400',
  milestone: 'bg-purple-400',
  todo: 'bg-orange-400',
}

const SOURCE_BADGE: Record<WorkItem['source'], string> = {
  event: 'bg-blue-50 text-blue-600 border-blue-200',
  milestone: 'bg-purple-50 text-purple-600 border-purple-200',
  todo: 'bg-orange-50 text-orange-600 border-orange-200',
}

const SOURCE_LABEL: Record<WorkItem['source'], string> = {
  event: '일정',
  milestone: '마일스톤',
  todo: '할 일',
}

function WorkEventCard({ item }: { item: WorkItem }) {
  const [expanded, setExpanded] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [doneFlash, setDoneFlash] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const qc = useQueryClient()
  const toggleMilestone = useToggleMilestone()
  const toggleTodo = useToggleTodo()
  const completeEvent = useCompleteCalendarEvent()
  const deleteMilestone = useDeleteMilestone()
  const deleteTodo = useDeleteTodo()
  const deleteEvent = useDeleteCalendarEvent()

  async function handleDelete() {
    if (item.rawMilestone && !item.rawEvent) {
      await deleteMilestone.mutateAsync({ id: item.rawMilestone.id, projectId: item.rawMilestone.project_id })
    } else if (item.rawTodo) {
      await deleteTodo.mutateAsync(item.rawTodo.id)
    } else if (item.rawEvent) {
      await deleteEvent.mutateAsync(item.rawEvent.id)
    }
    qc.invalidateQueries({ queryKey: ['projects'] })
    setConfirmDelete(false)
  }

  const today = getLocalDate()
  const isOverdue = item.date !== null && !item.completed && item.date < today
  const isToday = item.date === today

  async function handleComplete() {
    if (completing || item.completed) return
    setCompleting(true)
    try {
      if (item.rawMilestone) {
        await toggleMilestone.mutateAsync({
          id: item.rawMilestone.id,
          completed: true,
          projectId: item.rawMilestone.project_id,
        })
        qc.invalidateQueries({ queryKey: ['projects'] })
      } else if (item.rawTodo) {
        await toggleTodo.mutateAsync({ id: item.rawTodo.id, completed: true })
      } else if (item.rawEvent) {
        await completeEvent.mutateAsync(item.rawEvent.id)
      }
      // 완료 플래시: 1.2초 후 자동 소멸
      setDoneFlash(true)
      setTimeout(() => setDoneFlash(false), 1200)
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className={`px-4 py-3.5 hover:bg-gray-50/60 transition-colors ${item.completed ? 'opacity-55' : ''}`}>
      {/* 완료 플래시 */}
      {doneFlash && (
        <div className="mb-1 text-[11px] text-emerald-600 font-medium flex items-center gap-1 animate-pulse">
          ✓ 완료 처리됐습니다
        </div>
      )}
      <div className="flex items-start gap-3">
        {/* 왼쪽 상태 도트 */}
        <div className="shrink-0 pt-1.5">
          <span
            className={`block w-2 h-2 rounded-full ${item.completed ? 'bg-emerald-400' : SOURCE_DOT[item.source]}`}
          />
        </div>

        {/* 본문 */}
        <div className="flex-1 min-w-0">
          {/* 제목 + 액션 버튼 */}
          <div className="flex items-start gap-2">
            <button onClick={() => setExpanded(e => !e)} className="flex-1 text-left min-w-0">
              <p
                className={`text-sm font-medium leading-snug ${
                  item.completed ? 'line-through text-gray-400' : 'text-gray-800'
                }`}
              >
                {item.title}
              </p>
            </button>

            {/* 우측 액션 버튼 영역 */}
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              {!item.completed ? (
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-emerald-300 text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  {completing ? '처리중' : '완료'}
                </button>
              ) : (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 whitespace-nowrap">
                  완료됨
                </span>
              )}

              {/* 삭제 */}
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-gray-300 hover:text-red-400 transition-colors p-0.5 text-xs"
                  title="삭제"
                >
                  ×
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button onClick={handleDelete} className="text-[10px] text-red-500 hover:text-red-700 font-medium">삭제</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-gray-400">취소</button>
                </div>
              )}

              {/* expand 토글 */}
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-gray-300 hover:text-gray-500 transition-colors p-0.5"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* 날짜 + 뱃지 */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {item.date ? (
              <span
                className={`text-xs ${
                  isOverdue
                    ? 'text-red-500 font-medium'
                    : isToday
                    ? 'text-indigo-600 font-medium'
                    : 'text-gray-400'
                }`}
              >
                {formatDay(item.date)}
                {item.time ? ` ${item.time.slice(0, 5)}` : ''}
              </span>
            ) : (
              <span className="text-xs text-gray-300">날짜 없음</span>
            )}
            {isOverdue && (
              <span className="text-[10px] px-1 py-0.5 bg-red-50 text-red-400 rounded border border-red-100">
                지연
              </span>
            )}
            {isToday && !item.completed && (
              <span className="text-[10px] px-1 py-0.5 bg-indigo-50 text-indigo-500 rounded border border-indigo-100">
                오늘
              </span>
            )}
            {item.priority === 'high' && (
              <span className="text-[10px] px-1 py-0.5 bg-red-50 text-red-500 rounded border border-red-100">
                긴급
              </span>
            )}
            <span className={`text-[10px] px-1 py-0.5 rounded border ${SOURCE_BADGE[item.source]}`}>
              {SOURCE_LABEL[item.source]}
            </span>
            {item.memoId && (
              <span className="text-[10px] px-1 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-200" title="메모에서 생성됨">
                📝
              </span>
            )}
          </div>

          {/* 상세 펼침 */}
          {expanded && (
            <div className="mt-2 pt-2 border-t border-gray-100 space-y-1 text-xs text-gray-500">
              {item.location && <p>📍 {item.location}</p>}
              {item.memoId && (
                <p className="text-[11px] text-amber-600">📝 메모에서 생성됨</p>
              )}
              {item.rawMilestone && item.rawEvent && (
                <p className="text-gray-400 text-[11px]">일정 + 마일스톤 연결됨</p>
              )}
              {item.completed && item.completedAt && (
                <p className="text-gray-400 text-[11px]">
                  완료: {formatDateTime(item.completedAt)}
                </p>
              )}
              {item.source === 'todo' && item.rawTodo && (
                <p className="text-gray-400 text-[11px]">
                  우선순위:{' '}
                  {item.priority === 'high' ? '높음' : item.priority === 'medium' ? '보통' : '낮음'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LogRow({ data }: { data: ActivityLog }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2 hover:bg-gray-50/40 transition-colors">
      <div className="shrink-0 pt-1.5">
        <span className="block w-1.5 h-1.5 rounded-full bg-gray-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 leading-snug">{formatLog(data)}</p>
        {data.detail?.memo && (
          <p className="text-[11px] text-gray-400 truncate mt-0.5">{data.detail.memo}</p>
        )}
        <p className="text-[10px] text-gray-300 mt-0.5">{formatDateTime(data.created_at)}</p>
      </div>
    </div>
  )
}

export default function TimelineItemRow({ item }: { item: TimelineItem }) {
  if (item.kind === 'work') return <WorkEventCard item={item.item} />
  return <LogRow data={item.data} />
}
