import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MiniCalendar from '../components/dashboard/MiniCalendar'
import { getLocalDate, parseLocalDate } from '../lib/dateUtils'
import { useCalendarEvents, useCompleteCalendarEvent } from '../hooks/useCalendarEvents'
import { useDashboardStats } from '../hooks/useDashboard'
import { useOpenLoops } from '../hooks/useOpenLoops'
import { useSnoozeTodo, useToggleTodo } from '../hooks/useTodos'
import { generateBriefingEdge as generateDailyBriefing } from '../lib/edgeFunctions'
import { useHabits, useTodayHabitLogs, useCompleteHabit, useUncompleteHabit, isScheduledToday, COLOR_CLASS } from '../hooks/useHabits'
import { useDeadlineDashboardStats } from '../hooks/useDeadlines'
import type { OpenLoop } from '../hooks/useOpenLoops'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(dateStr: string) {
  const d = parseLocalDate(dateStr)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`
}

function timeLabel(time: string | null) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`
}

export default function Dashboard() {
  const { data, isLoading } = useDashboardStats()
  const { data: allEvents = [] } = useCalendarEvents()
  const { data: deadlineStats } = useDeadlineDashboardStats()
  const { data: openLoops = [] } = useOpenLoops()
  const toggleTodo = useToggleTodo()
  const snoozeTodo = useSnoozeTodo()
  const completeEvent = useCompleteCalendarEvent()
  const navigate = useNavigate()
  const { data: habits = [] } = useHabits()
  const { data: habitLogs = [] } = useTodayHabitLogs()
  const completeHabit = useCompleteHabit()
  const uncompleteHabit = useUncompleteHabit()

  const todayStr = getLocalDate()
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)

  const completedHabitIds = new Set(habitLogs.map(l => l.habit_id))
  const todayHabits = habits.filter(isScheduledToday)

  const selectedEvents = useMemo(() =>
    allEvents.filter(e => e.date === selectedDate && !e.completed)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [allEvents, selectedDate]
  )

  const overdueTodos = useMemo(() =>
    (data?.pendingTodos ?? []).filter((t: any) => t.due_date && t.due_date < todayStr),
    [data?.pendingTodos, todayStr]
  )

  // 오늘 흐름 = 오늘 마감/연체 투두 + 오늘 이벤트 — 시간순 통합
  const todayStream = useMemo(() => {
    const todos = (data?.pendingTodos ?? [])
      .filter((t: any) => t.due_date && t.due_date <= todayStr)
      .map((t: any) => ({
        id: t.id, kind: 'todo' as const,
        title: t.title,
        sub: t.clients?.name ?? null,
        time: null as string | null,
        sortKey: t.due_date < todayStr ? '00:00' : '99:00',
        isOverdue: t.due_date < todayStr,
        raw: t,
      }))

    const events = allEvents
      .filter(e => e.date === todayStr && !e.completed)
      .map((e: any) => ({
        id: e.id, kind: 'event' as const,
        title: e.title,
        sub: [e.clients?.name, e.location].filter(Boolean).join(' · ') || null,
        time: e.time ? timeLabel(e.time) : null,
        sortKey: e.time ?? '50:00',
        isOverdue: false,
        raw: e,
      }))

    return [...todos, ...events].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [data?.pendingTodos, allEvents, todayStr])

  const handleBriefing = useCallback(async () => {
    if (!data || briefingLoading) return
    setBriefingLoading(true)
    try {
      const text = await generateDailyBriefing({
        date: todayStr,
        todayEvents: (data.todayEvents as any[]).map(e => ({
          title: e.title, time: e.time, clientName: e.clients?.name ?? null,
        })),
        weekEventCount: data.weekEvents.length,
        overdueCount: overdueTodos.length,
        pendingCount: data.pendingTodos.length,
        deadlineCount: (deadlineStats?.overdue ?? 0) + (deadlineStats?.thisWeek ?? 0),
      })
      setBriefing(text)
    } catch {
      setBriefing('브리핑 생성에 실패했습니다.')
    } finally {
      setBriefingLoading(false)
    }
  }, [data, deadlineStats, todayStr, overdueTodos.length, briefingLoading])

  const goEvent = (event: any) => {
    if (event.client_id) navigate(`/workspace/client/${event.client_id}`)
    else if (event.project_id) navigate(`/workspace/project/${event.project_id}`)
    else navigate('/calendar')
  }

  const goLoop = (loop: OpenLoop) => {
    if (loop.clientId) navigate(`/workspace/client/${loop.clientId}`)
    else if (loop.projectId) navigate(`/workspace/project/${loop.projectId}`)
    else navigate('/todos')
  }

  if (isLoading) return (
    <div className="p-6 space-y-5">
      <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
      <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    </div>
  )

  const projectFlow: any[] = data?.projectFlow ?? []

  return (
    <div className="p-5 lg:p-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{formatDate(todayStr)}</p>
          <h1 className="text-xl font-bold text-gray-900">오늘의 업무</h1>
        </div>
        {openLoops.length > 0 && (
          <span className="text-xs bg-rose-50 text-rose-500 px-2.5 py-1 rounded-full font-medium border border-rose-100">
            흐름 정지 {openLoops.length}건
          </span>
        )}
      </div>

      {/* AI 브리핑 */}
      <div className={`rounded-xl border px-4 py-3 transition-all ${briefing ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100 hover:border-indigo-200'}`}>
        {briefing ? (
          <div className="flex items-start gap-3">
            <span className="text-indigo-400 mt-0.5 shrink-0 text-xs">✦</span>
            <div className="flex-1"><DashboardBulletList text={briefing} /></div>
            <button onClick={() => setBriefing(null)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">닫기</button>
          </div>
        ) : (
          <button onClick={handleBriefing} disabled={briefingLoading}
            className="flex items-center gap-2.5 text-sm text-gray-400 hover:text-indigo-500 transition-colors w-full disabled:cursor-wait">
            <span className={`shrink-0 text-xs ${briefingLoading ? 'animate-pulse text-indigo-400' : ''}`}>✦</span>
            <span className={briefingLoading ? 'animate-pulse text-indigo-500' : ''}>
              {briefingLoading ? '브리핑 생성 중...' : 'AI로 오늘 업무 브리핑 생성'}
            </span>
            {!briefingLoading && <span className="ml-auto text-xs text-gray-200">클릭하여 생성</span>}
          </button>
        )}
      </div>

      {/* 2컬럼 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">

          {/* 루틴 — 컴팩트 진행 표시 */}
          {todayHabits.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">🔁 오늘 루틴</span>
                  <span className="text-xs text-gray-400">{completedHabitIds.size}/{todayHabits.length}</span>
                </div>
                <button onClick={() => navigate('/habits')} className="text-[10px] text-gray-400 hover:text-indigo-500">전체 →</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {todayHabits.map(h => {
                  const done = completedHabitIds.has(h.id)
                  const cl = COLOR_CLASS[h.color]
                  return (
                    <button key={h.id}
                      onClick={() => done ? uncompleteHabit.mutate(h) : completeHabit.mutate({ habit: h })}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        done ? `${cl.bg} ${cl.text} border-transparent opacity-50` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${done ? cl.dot : 'bg-gray-300'}`} />
                      <span className={done ? 'line-through' : ''}>{h.title}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* 오늘 흐름 — 투두+일정 통합 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">오늘 흐름</h2>
              <button onClick={() => navigate('/calendar')} className="text-xs text-gray-400 hover:text-indigo-500">캘린더 →</button>
            </div>
            {todayStream.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-gray-300">오늘 예정된 업무가 없습니다</p>
                <button onClick={() => navigate('/memo')} className="mt-2 text-xs text-indigo-400 hover:underline">메모로 추가</button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {todayStream.map(item => (
                  <TodayStreamRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    onComplete={() => {
                      if (item.kind === 'todo') toggleTodo.mutate({ id: item.id, completed: true })
                      else completeEvent.mutate(item.id)
                    }}
                    onSnooze={item.kind === 'todo' ? () => snoozeTodo.mutate({ id: item.id, days: 1 }) : undefined}
                    onMemo={() => navigate('/memo', {
                      state: item.raw.client_id
                        ? { clientId: item.raw.client_id, clientName: item.raw.clients?.name }
                        : { projectId: item.raw.project_id }
                    })}
                    onNavigate={() => {
                      if (item.raw.client_id) navigate(`/workspace/client/${item.raw.client_id}`)
                      else if (item.raw.project_id) navigate(`/workspace/project/${item.raw.project_id}`)
                      else if (item.kind === 'event') goEvent(item.raw)
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 흐름 정지 — Open Loops */}
          {openLoops.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-gray-500">흐름 정지</h2>
                  <span className="text-[10px] text-gray-400">후속이 필요한 업무</span>
                </div>
                <button onClick={() => navigate('/todos')} className="text-xs text-gray-400 hover:text-indigo-500">전체 →</button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {openLoops.map(loop => (
                  <OpenLoopRow
                    key={loop.id}
                    loop={loop}
                    onMemo={() => navigate('/memo', {
                      state: loop.clientId ? { clientId: loop.clientId } : { projectId: loop.projectId }
                    })}
                    onComplete={() => toggleTodo.mutate({ id: loop.id, completed: true })}
                    onSnooze={() => snoozeTodo.mutate({ id: loop.id, days: 7 })}
                    onNavigate={() => goLoop(loop)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 오른쪽 — 미니캘린더 + 프로젝트 흐름 */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <MiniCalendar events={allEvents} selectedDate={selectedDate} onDateClick={setSelectedDate} />
            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {selectedDate === todayStr ? '오늘' : formatDate(selectedDate)}
              </p>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-gray-300 py-1">일정 없음</p>
              ) : (
                <div className="space-y-1">
                  {selectedEvents.map((e: any) => (
                    <button key={e.id} onClick={() => goEvent(e)}
                      className="w-full flex items-center gap-2 text-left py-1 rounded hover:bg-gray-50 transition-colors group">
                      <span className="text-[10px] font-mono text-indigo-400 shrink-0 w-9">
                        {e.time ? e.time.slice(0, 5) : '종일'}
                      </span>
                      <span className="flex-1 text-xs text-gray-600 group-hover:text-indigo-600 truncate">{e.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {projectFlow.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">프로젝트 흐름</p>
                <button onClick={() => navigate('/projects')} className="text-xs text-gray-400 hover:text-indigo-500">전체 →</button>
              </div>
              <div className="space-y-3">
                {projectFlow.map((p: any) => (
                  <button key={p.id} onClick={() => navigate(`/workspace/project/${p.id}`)} className="w-full text-left group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 group-hover:text-indigo-600 truncate max-w-[140px] transition-colors">{p.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[10px] font-semibold text-gray-500">{p.progress}%</span>
                        {p.endDate && <span className="text-[10px] text-gray-300">{p.endDate.slice(5)}</span>}
                      </div>
                    </div>
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${p.progress >= 80 ? 'bg-emerald-400' : p.progress >= 40 ? 'bg-indigo-400' : 'bg-amber-300'}`}
                        style={{ width: `${p.progress}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── AI 브리핑 ──────────────────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, { chip: string; text: string }> = {
  Done:          { chip: 'bg-emerald-50 text-emerald-600 border border-emerald-200', text: 'text-gray-400 line-through' },
  'In Progress': { chip: 'bg-indigo-50 text-indigo-600 border border-indigo-200',   text: 'text-indigo-800' },
  Pending:       { chip: 'bg-amber-50 text-amber-600 border border-amber-200',      text: 'text-indigo-700' },
}

function DashboardBulletList({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return (
    <ul className="space-y-1.5">
      {lines.map((line, i) => {
        const m = line.match(/^\[(Done|In Progress|Pending)\]\s*(.+)$/)
        const marker = m?.[1] ?? ''
        const content = m ? m[2] : line.replace(/^[•\-·]\s*/, '').trim()
        const style = STATUS_CHIP[marker]
        return (
          <li key={i} className="flex items-start gap-2.5">
            {style
              ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${style.chip}`}>{marker}</span>
              : <span className="w-1 h-1 rounded-full bg-indigo-400 shrink-0 mt-2" />
            }
            <span className={`text-sm leading-snug ${style?.text ?? 'text-indigo-800'}`}>{content}</span>
          </li>
        )
      })}
    </ul>
  )
}

// ── 오늘 흐름 행 (투두+이벤트 통합) ─────────────────────────────────────────────

type StreamItem = {
  id: string; kind: 'todo' | 'event'
  title: string; sub: string | null
  time: string | null; isOverdue: boolean
  raw: any
}

function TodayStreamRow({ item, onComplete, onSnooze, onMemo, onNavigate }: {
  item: StreamItem
  onComplete: () => void; onSnooze?: () => void
  onMemo: () => void; onNavigate: () => void
}) {
  const leftCls = item.isOverdue
    ? 'text-red-400 font-semibold'
    : item.kind === 'event' ? 'text-indigo-400' : 'text-amber-400'

  const leftLabel = item.isOverdue ? '연체' : item.time ?? (item.kind === 'todo' ? '오늘' : '종일')

  return (
    <div className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50 group transition-colors">
      <span className={`text-[11px] font-mono shrink-0 w-10 ${leftCls}`}>{leftLabel}</span>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
        <p className={`text-sm font-medium truncate ${item.isOverdue ? 'text-red-600' : 'text-gray-800'}`}>{item.title}</p>
        {item.sub && <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onMemo} className="text-[11px] px-1.5 py-0.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">메모</button>
        <button onClick={onComplete} className="text-[11px] px-1.5 py-0.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors">완료</button>
        {onSnooze && (
          <button onClick={onSnooze} className="text-[11px] px-1.5 py-0.5 text-gray-300 hover:text-gray-500 rounded transition-colors">+1일</button>
        )}
      </div>
    </div>
  )
}

// ── Open Loop 행 ───────────────────────────────────────────────────────────────

function OpenLoopRow({ loop, onMemo, onComplete, onSnooze, onNavigate }: {
  loop: OpenLoop; onMemo: () => void; onComplete: () => void
  onSnooze: () => void; onNavigate: () => void
}) {
  const isTodo = loop.kind === 'overdue_todo'
  const contextParts = loop.context.split(' · ').slice(1)

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 mb-0.5">
            {loop.daysStalled > 0 ? `${loop.daysStalled}일 후속 없음` : '후속 필요'}
            {contextParts.length > 0 && <span className="text-gray-300"> · {contextParts.join(' · ')}</span>}
          </p>
          <p className="text-sm font-medium text-gray-800 leading-snug">{loop.title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button onClick={onMemo} className="text-[11px] px-2 py-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">메모</button>
          {isTodo && (
            <>
              <button onClick={onComplete} className="text-[11px] px-2 py-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors">완료</button>
              <button onClick={onSnooze} className="text-[11px] px-2 py-1 text-gray-300 hover:text-gray-500 rounded transition-colors">+7일</button>
            </>
          )}
          <button onClick={onNavigate} className="text-[11px] text-gray-300 hover:text-indigo-500 transition-colors px-1">→</button>
        </div>
      </div>
    </div>
  )
}
