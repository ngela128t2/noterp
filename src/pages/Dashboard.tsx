import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MiniCalendar from '../components/dashboard/MiniCalendar'
import TodayFlow from '../components/dashboard/TodayFlow'
import { getLocalDate, parseLocalDate } from '../lib/dateUtils'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
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

export default function Dashboard() {
  const { data, isLoading } = useDashboardStats()
  const { data: allEvents = [] } = useCalendarEvents()
  const { data: deadlineStats } = useDeadlineDashboardStats()
  const { data: openLoops = [] } = useOpenLoops()
  const toggleTodo = useToggleTodo()
  const snoozeTodo = useSnoozeTodo()
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-5">

          {/* 메인: 오늘의 흐름 — 메모 중심 카드 */}
          <TodayFlow />

          {/* 보조: AI 브리핑 — 오늘 먼저 볼 일 */}
          <BriefingSection
            briefing={briefing}
            loading={briefingLoading}
            onGenerate={handleBriefing}
            onClose={() => setBriefing(null)}
          />

          {/* 루틴 — 한 줄 */}
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

          {/* 흐름 정지 — Open Loops (후속이 필요한 업무) */}
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
// 새 형식: "오늘 먼저 볼 일" — 행동 우선순위 1, 2, 3...
//   1. 제목
//      · 디테일1
//      · 디테일2

type BriefingItem = { title: string; details: string[] }

function parseBriefing(text: string): BriefingItem[] {
  const items: BriefingItem[] = []
  let current: BriefingItem | null = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    // "1." 또는 "1)" 형식
    const numMatch = line.match(/^\d+[.)]\s*(.+)/)
    if (numMatch) {
      if (current) items.push(current)
      // 마크다운 잔재 제거
      const cleaned = numMatch[1].replace(/^\*+|\*+$/g, '').replace(/^["'`]|["'`]$/g, '').trim()
      current = { title: cleaned, details: [] }
      continue
    }
    // 디테일 라인: · - • or whitespace indented
    const detailMatch = line.match(/^[·\-•*]\s*(.+)/)
    if (detailMatch && current) {
      current.details.push(detailMatch[1].trim())
      continue
    }
    // [Done] 등 마커는 무시
    if (line.match(/^\[(Done|In Progress|Pending)\]/i)) continue
  }
  if (current) items.push(current)
  return items
}

function BriefingSection({ briefing, loading, onGenerate, onClose }: {
  briefing: string | null
  loading: boolean
  onGenerate: () => void
  onClose: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const items = useMemo(() => briefing ? parseBriefing(briefing) : [], [briefing])
  const visible = showAll ? items : items.slice(0, 3)
  const hidden = items.length - visible.length

  if (!briefing) {
    return (
      <button
        onClick={onGenerate}
        disabled={loading}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-indigo-500 hover:bg-indigo-50/40 border border-dashed border-gray-200 hover:border-indigo-200 transition-colors disabled:cursor-wait"
      >
        <span className={`text-xs shrink-0 ${loading ? 'animate-pulse text-indigo-400' : ''}`}>✦</span>
        <span className={loading ? 'animate-pulse text-indigo-500' : ''}>
          {loading ? '오늘 먼저 볼 일을 정리하는 중...' : '오늘 먼저 볼 일 — AI에게 정리받기'}
        </span>
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-indigo-400 text-xs">✦</span>
          <p className="text-xs font-semibold text-gray-700">오늘 먼저 볼 일</p>
        </div>
        <button onClick={onClose} className="text-[10px] text-gray-300 hover:text-gray-500">닫기</button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 whitespace-pre-line">{briefing}</p>
      ) : (
        <>
          <ol className="space-y-2.5">
            {visible.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 min-w-0">
                <span className="text-xs font-semibold text-indigo-400 shrink-0 w-4 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate break-keep">{item.title}</p>
                  {item.details.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {item.details.map((d, j) => (
                        <li key={j} className="text-[11px] text-gray-500 flex items-center gap-1.5 min-w-0">
                          <span className="text-gray-300 shrink-0">·</span>
                          <span className="truncate break-keep flex-1 min-w-0">{d}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {hidden > 0 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-3 text-[11px] text-indigo-500 hover:underline"
            >
              + {hidden}건 더보기
            </button>
          )}
        </>
      )}
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
    <div className="px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 mb-0.5 truncate">
            {loop.daysStalled > 0 ? `${loop.daysStalled}일 후속 없음` : '후속 필요'}
            {contextParts.length > 0 && <span className="text-gray-300"> · {contextParts.join(' · ')}</span>}
          </p>
          <p className="text-sm font-medium text-gray-800 truncate break-keep">{loop.title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
