import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MiniCalendar from '../components/dashboard/MiniCalendar'
import { getLocalDate, parseLocalDate } from '../lib/dateUtils'
import { useCalendarEvents, useCompleteCalendarEvent } from '../hooks/useCalendarEvents'
import { useDashboardStats } from '../hooks/useDashboard'
import { useDeadlineDashboardStats } from '../hooks/useDeadlines'
import { useOpenLoops } from '../hooks/useOpenLoops'
import { useSnoozeTodo, useToggleTodo } from '../hooks/useTodos'
import { generateBriefingEdge as generateDailyBriefing } from '../lib/edgeFunctions'
import { useHabits, useTodayHabitLogs, useCompleteHabit, useUncompleteHabit, isScheduledToday, COLOR_CLASS } from '../hooks/useHabits'
import type { OpenLoop } from '../hooks/useOpenLoops'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(dateStr: string) {
  const d = parseLocalDate(dateStr)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`
}

function timeLabel(time: string | null) {
  if (!time) return '종일'
  const [h, m] = time.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`
}

function detectActionLabel(title: string, source: 'event' | 'todo'): { label: string; cls: string } {
  const t = title.toLowerCase()
  if (/전화|통화|연락/.test(t))             return { label: '전화 필요', cls: 'bg-rose-100 text-rose-600' }
  if (/회의|미팅|tf|워크숍|면담/.test(t))   return { label: '오늘 회의', cls: 'bg-blue-100 text-blue-600' }
  if (/발송|제출|신고|보고|마감|전달/.test(t)) return { label: '자료 발송', cls: 'bg-emerald-100 text-emerald-600' }
  if (source === 'todo')                   return { label: '처리 필요', cls: 'bg-amber-100 text-amber-600' }
  return { label: '오늘 업무', cls: 'bg-indigo-100 text-indigo-600' }
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
  const completedHabitIds = new Set(habitLogs.map(l => l.habit_id))
  const todayHabits = habits.filter(isScheduledToday)

  const todayStr = getLocalDate()
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)

  // ③ 섹션: 항상 오늘 기준 (캘린더 클릭에 영향받지 않음)
  const todayScheduleEvents = useMemo(() =>
    allEvents
      .filter(e => e.date === todayStr && !e.completed)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [allEvents, todayStr]
  )

  // 캘린더 선택일 이벤트 (오른쪽 캘린더 아래에만 표시)
  const selectedEvents = useMemo(() =>
    allEvents
      .filter(e => e.date === selectedDate && !e.completed)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [allEvents, selectedDate]
  )

  const overdueTodos = useMemo(() =>
    (data?.pendingTodos ?? []).filter((t: any) => t.due_date && t.due_date < todayStr),
    [data?.pendingTodos, todayStr]
  )

  // ① = 연체/오늘 마감 투두만. 캘린더 이벤트는 ③에서만 표시 (중복 방지)
  const todayActionItems = useMemo(() =>
    (data?.pendingTodos ?? [])
      .filter((t: any) => t.due_date && t.due_date <= todayStr)
      .map((t: any) => ({ ...t, _source: 'todo' as const })),
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

  if (isLoading) {
    return (
      <div className="p-6 space-y-5">
        <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
          <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  const pendingTodos: any[] = data?.pendingTodos ?? []
  const projectFlow: any[] = data?.projectFlow ?? []

  return (
    <div className="p-5 lg:p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{formatDate(todayStr)}</p>
          <h1 className="text-xl font-bold text-gray-900">오늘의 업무</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {openLoops.length > 0 && (
            <span className="text-xs bg-rose-50 text-rose-500 px-2.5 py-1 rounded-full font-medium border border-rose-100">
              Open Loops {openLoops.length}
            </span>
          )}
          {deadlineStats && deadlineStats.overdue > 0 && (
            <span className="text-xs bg-orange-50 text-orange-500 px-2.5 py-1 rounded-full font-medium border border-orange-100">
              마감 {deadlineStats.overdue}건
            </span>
          )}
        </div>
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
          <button
            onClick={handleBriefing}
            disabled={briefingLoading}
            className="flex items-center gap-2.5 text-sm text-gray-400 hover:text-indigo-500 transition-colors w-full disabled:cursor-wait"
          >
            <span className={`shrink-0 text-xs ${briefingLoading ? 'animate-pulse text-indigo-400' : ''}`}>✦</span>
            <span className={briefingLoading ? 'animate-pulse text-indigo-500' : ''}>
              {briefingLoading ? '브리핑 생성 중...' : 'AI로 오늘 업무 브리핑 생성'}
            </span>
            {!briefingLoading && <span className="ml-auto text-xs text-gray-200">클릭하여 생성</span>}
          </button>
        )}
      </div>

      {/* 메인 2컬럼 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

        {/* ━━━ 왼쪽 ━━━ */}
        <div className="xl:col-span-2 space-y-8">

          {/* 🔁 오늘의 습관 루틴 (습관이 있을 때만) */}
          {todayHabits.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔁</span>
                  <h2 className="text-sm font-semibold text-gray-800">오늘의 루틴</h2>
                  <span className="text-xs text-gray-400">{completedHabitIds.size}/{todayHabits.length}</span>
                </div>
                <button onClick={() => navigate('/habits')} className="text-[10px] text-indigo-500 hover:underline">전체 보기 →</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {todayHabits.map(h => {
                  const done = completedHabitIds.has(h.id)
                  const cl = COLOR_CLASS[h.color]
                  return (
                    <button
                      key={h.id}
                      onClick={() => done ? uncompleteHabit.mutate(h) : completeHabit.mutate({ habit: h })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        done
                          ? `${cl.bg} ${cl.text} border-transparent opacity-60`
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${done ? cl.dot : 'bg-gray-300'}`} />
                      <span className={done ? 'line-through' : ''}>{h.title}</span>
                      {h.streak > 1 && <span className="text-orange-400">🔥{h.streak}</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* ① 지금 해야 하는 것 — PRIMARY: 강하게 강조 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${todayActionItems.length > 0 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</span>
                <h2 className="text-sm font-semibold text-gray-800">지금 해야 하는 것</h2>
                <span className="text-xs text-gray-400 hidden sm:inline">우선순위 높은 순</span>
              </div>
              <button onClick={() => navigate('/todos')} className="text-xs text-indigo-500 hover:underline">전체 →</button>
            </div>
            {todayActionItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-4 text-center">
                <p className="text-sm text-gray-400">오늘 처리할 긴급 업무가 없습니다</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 lg:mx-0 lg:px-0 snap-x snap-mandatory">
                {todayActionItems.map((item: any) => (
                  <TodayActionCard
                    key={item.id}
                    item={item}
                    todayStr={todayStr}
                    onMemo={() => navigate('/memo', {
                      state: item.client_id
                        ? { clientId: item.client_id, clientName: item.clients?.name }
                        : { projectId: item.project_id }
                    })}
                    onComplete={() => {
                      if (item._source === 'todo') toggleTodo.mutate({ id: item.id, completed: true })
                      else completeEvent.mutate(item.id)
                    }}
                    onSnooze={item._source === 'todo'
                      ? () => snoozeTodo.mutate({ id: item.id, days: 1 })
                      : undefined}
                    onNavigate={() => {
                      if (item.client_id) navigate(`/workspace/client/${item.client_id}`)
                      else if (item.project_id) navigate(`/workspace/project/${item.project_id}`)
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 오늘 일정 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-gray-600">오늘 일정</h2>
                {todayScheduleEvents.length > 0 && (
                  <span className="text-[10px] text-gray-400">{todayScheduleEvents.length}건</span>
                )}
              </div>
              <button onClick={() => navigate('/calendar')} className="text-xs text-gray-400 hover:text-indigo-500">캘린더 →</button>
            </div>
            {todayScheduleEvents.length === 0 ? (
              <div className="flex items-center gap-3 py-2">
                <p className="text-sm text-gray-400">오늘은 예정된 일정이 없습니다</p>
                <button onClick={() => navigate('/calendar')} className="text-xs text-indigo-400 hover:underline shrink-0">+ 추가</button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {todayScheduleEvents.map((event: any) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onClick={() => goEvent(event)}
                    onMemo={() => navigate('/memo', {
                      state: event.client_id
                        ? { clientId: event.client_id, clientName: event.clients?.name }
                        : { projectId: event.project_id }
                    })}
                    onComplete={() => completeEvent.mutate(event.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ② Open Loops — SECONDARY: 가볍게 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                <h2 className="text-sm font-medium text-gray-600">흐름이 멈춘 업무</h2>
                <span className="text-[10px] text-gray-400">Open Loops</span>
              </div>
              <button onClick={() => navigate('/todos')} className="text-xs text-gray-400 hover:text-indigo-500">전체 →</button>
            </div>
            {openLoops.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-4 text-center">
                <p className="text-sm text-gray-400">멈춘 업무가 없습니다</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {openLoops.map(loop => (
                  <OpenLoopRow
                    key={loop.id}
                    loop={loop}
                    onMemo={() => navigate('/memo', {
                      state: loop.clientId
                        ? { clientId: loop.clientId }
                        : { projectId: loop.projectId }
                    })}
                    onComplete={() => toggleTodo.mutate({ id: loop.id, completed: true })}
                    onSnooze={() => snoozeTodo.mutate({ id: loop.id, days: 7 })}
                    onNavigate={() => goLoop(loop)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 미완료 할 일 */}
          {pendingTodos.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-gray-600">미완료 할 일</h2>
                  <span className="text-[10px] text-gray-400">{pendingTodos.length}건</span>
                </div>
                <button onClick={() => navigate('/todos')} className="text-xs text-gray-400 hover:text-indigo-500">전체 →</button>
              </div>
              <ul className="space-y-0.5">
                {pendingTodos.slice(0, 6).map((todo: any) => (
                  <li
                    key={todo.id}
                    onClick={() => todo.client_id ? navigate(`/workspace/client/${todo.client_id}`) : undefined}
                    className={`flex items-center gap-3 py-2 px-1 rounded-lg ${todo.client_id ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors group`}
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      onClick={e => e.stopPropagation()}
                      onChange={e => toggleTodo.mutate({ id: todo.id, completed: e.target.checked })}
                      className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer shrink-0"
                    />
                    <span className={`flex-1 text-sm truncate ${todo.due_date && todo.due_date < todayStr ? 'text-red-500 font-medium' : 'text-gray-700'}`}>
                      {todo.title}
                    </span>
                    {todo.clients?.name && (
                      <span className="text-[10px] text-gray-400 shrink-0 truncate max-w-[80px] hidden sm:block">{todo.clients.name}</span>
                    )}
                    {todo.due_date && (
                      <span className={`text-[10px] tabular-nums shrink-0 ${todo.due_date < todayStr ? 'text-red-400 font-semibold' : 'text-gray-300'}`}>
                        {todo.due_date.slice(5)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ━━━ 오른쪽 — 컨텍스트 영역 ━━━ */}
        <div className="space-y-5">
          {/* 미니 캘린더 — 보조, 가볍게 */}
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
                    <button
                      key={e.id}
                      onClick={() => goEvent(e)}
                      className="w-full flex items-center gap-2 text-left py-1 rounded hover:bg-gray-50 transition-colors group"
                    >
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

          {/* 프로젝트 흐름 — 보조 */}
          {projectFlow.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">프로젝트 흐름</p>
                <button onClick={() => navigate('/projects')} className="text-xs text-gray-400 hover:text-indigo-500">전체 →</button>
              </div>
              <div className="space-y-3">
                {projectFlow.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/workspace/project/${p.id}`)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 group-hover:text-indigo-600 truncate max-w-[140px] transition-colors">{p.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[10px] font-semibold text-gray-500">{p.progress}%</span>
                        {p.endDate && <span className="text-[10px] text-gray-300">{p.endDate.slice(5)}</span>}
                      </div>
                    </div>
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          p.progress >= 80 ? 'bg-emerald-400' : p.progress >= 40 ? 'bg-indigo-400' : 'bg-amber-300'
                        }`}
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 수금 / 마감 — 최소화 */}
          {((data?.billingMonthly ?? 0) > 0 || (data?.unpaidAmount ?? 0) > 0) && (
            <button
              onClick={() => navigate('/billing')}
              className="w-full text-left py-3 border-t border-gray-100 group"
            >
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">수금 현황</p>
              <div className="flex gap-4">
                {(data?.billingMonthly ?? 0) > 0 && (
                  <div>
                    <p className="text-sm font-bold text-blue-500 tabular-nums">₩{Number(data?.billingMonthly ?? 0).toLocaleString('ko-KR')}</p>
                    <p className="text-[10px] text-gray-400">이번 달 청구</p>
                  </div>
                )}
                {(data?.unpaidAmount ?? 0) > 0 && (
                  <div>
                    <p className="text-sm font-bold text-red-400 tabular-nums">₩{Number(data?.unpaidAmount ?? 0).toLocaleString('ko-KR')}</p>
                    <p className="text-[10px] text-gray-400">미수금</p>
                  </div>
                )}
              </div>
            </button>
          )}

          {deadlineStats && (deadlineStats.overdue + deadlineStats.upcoming) > 0 && (
            <button
              onClick={() => navigate('/deadlines')}
              className="w-full text-left py-3 border-t border-gray-100 group"
            >
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">마감 기한</p>
              <div className="flex gap-4">
                {deadlineStats.overdue > 0 && (
                  <div>
                    <p className="text-lg font-bold text-red-400">{deadlineStats.overdue}</p>
                    <p className="text-[10px] text-gray-400">연체</p>
                  </div>
                )}
                {deadlineStats.upcoming > 0 && (
                  <div>
                    <p className="text-lg font-bold text-indigo-400">{deadlineStats.upcoming}</p>
                    <p className="text-[10px] text-gray-400">30일 내</p>
                  </div>
                )}
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── AI 브리핑 ──────────────────────────────────────────────────────────────

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
            {style ? (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${style.chip}`}>{marker}</span>
            ) : (
              <span className="w-1 h-1 rounded-full bg-indigo-400 shrink-0 mt-2" />
            )}
            <span className={`text-sm leading-snug ${style?.text ?? 'text-indigo-800'}`}>{content}</span>
          </li>
        )
      })}
    </ul>
  )
}

// ─── ① 오늘 해야 할 것 — 액션 카드 (강조) ────────────────────────────────────

function TodayActionCard({ item, todayStr, onMemo, onComplete, onSnooze, onNavigate }: {
  item: any
  todayStr: string
  onMemo: () => void
  onComplete: () => void
  onSnooze?: () => void
  onNavigate: () => void
}) {
  const { label, cls } = detectActionLabel(item.title, item._source)
  const phone = item.clients?.contact_phone ?? null
  const email = item.clients?.contact_email ?? null
  const isOverdue = item._source === 'todo' && item.due_date && item.due_date < todayStr

  return (
    <div className="min-w-[200px] max-w-[240px] snap-start bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden shrink-0">
      <div className="px-4 pt-4 pb-3 flex-1">
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
          {isOverdue && <span className="text-[10px] font-bold text-red-400">연체</span>}
        </div>
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-1.5">{item.title}</p>
        <div className="space-y-0.5">
          {item.clients?.name && (
            <p className="text-[11px] text-gray-400 truncate">{item.clients.name}</p>
          )}
          {item.time && (
            <p className="text-[11px] font-mono text-indigo-400">{item.time.slice(0, 5)}</p>
          )}
          {item.location && (
            <p className="text-[11px] text-gray-400 truncate">📍 {item.location}</p>
          )}
        </div>
      </div>
      <div className="border-t border-gray-100 px-3 py-2.5 flex items-center gap-3 bg-gray-50/60">
        {phone && (
          <a href={`tel:${phone}`} onClick={e => e.stopPropagation()} title={phone}
            className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-indigo-600 transition-colors">
            <span className="text-base">📞</span>
            <span className="text-[9px]">전화</span>
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} onClick={e => e.stopPropagation()} title={email}
            className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-indigo-600 transition-colors">
            <span className="text-base">✉️</span>
            <span className="text-[9px]">메일</span>
          </a>
        )}
        <button onClick={onMemo} className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-indigo-600 transition-colors">
          <span className="text-base">📝</span>
          <span className="text-[9px]">메모</span>
        </button>
        <button onClick={onComplete} className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-emerald-600 transition-colors">
          <span className="text-base">✅</span>
          <span className="text-[9px]">완료</span>
        </button>
        {onSnooze && (
          <button onClick={onSnooze} className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-amber-500 transition-colors">
            <span className="text-base">⏰</span>
            <span className="text-[9px]">내일</span>
          </button>
        )}
        <button onClick={onNavigate} className="ml-auto text-gray-300 hover:text-indigo-500 transition-colors text-sm">→</button>
      </div>
    </div>
  )
}

// ─── ② Open Loop 행 (심플) ────────────────────────────────────────────────────

function OpenLoopRow({ loop, onMemo, onComplete, onSnooze, onNavigate }: {
  loop: OpenLoop
  onMemo: () => void
  onComplete: () => void
  onSnooze: () => void
  onNavigate: () => void
}) {
  const isTodo = loop.kind === 'overdue_todo'
  const contextParts = loop.context.split(' · ').slice(1)

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 mb-0.5">
            {loop.daysStalled > 0 ? `${loop.daysStalled}일 동안 후속 없음` : '후속 필요'}
            {contextParts.length > 0 && <span className="text-gray-300"> · {contextParts.join(' · ')}</span>}
          </p>
          <p className="text-sm font-medium text-gray-800 leading-snug">{loop.title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button onClick={onMemo}
            className="text-[11px] px-2 py-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
            메모
          </button>
          {isTodo && (
            <>
              <button onClick={onComplete}
                className="text-[11px] px-2 py-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
                완료
              </button>
              <button onClick={onSnooze}
                className="text-[11px] px-2 py-1 text-gray-300 hover:text-gray-500 rounded transition-colors">
                +7일
              </button>
            </>
          )}
          <button onClick={onNavigate} className="text-[11px] text-gray-300 hover:text-indigo-500 transition-colors px-1">→</button>
        </div>
      </div>
    </div>
  )
}

// ─── ③ 일정 행 (인라인 액션 hover) ──────────────────────────────────────────

function EventRow({ event, onClick, onMemo, onComplete }: {
  event: any
  onClick: () => void
  onMemo: () => void
  onComplete: () => void
}) {
  const phone = event.clients?.contact_phone ?? null
  const email = event.clients?.contact_email ?? null

  return (
    <div className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-gray-50 group transition-colors">
      <span className="text-[11px] font-mono text-indigo-400 shrink-0 w-12">{timeLabel(event.time)}</span>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <p className="text-sm font-medium text-gray-800 truncate">{event.title}</p>
        {(event.clients?.name || event.location) && (
          <p className="text-[11px] text-gray-400 truncate">
            {[event.clients?.name ?? event.projects?.name, event.location].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {phone && <a href={`tel:${phone}`} onClick={e => e.stopPropagation()} className="text-gray-300 hover:text-indigo-500 text-sm transition-colors" title="전화">📞</a>}
        {email && <a href={`mailto:${email}`} onClick={e => e.stopPropagation()} className="text-gray-300 hover:text-indigo-500 text-sm transition-colors" title="메일">✉️</a>}
        <button onClick={e => { e.stopPropagation(); onMemo() }} className="text-gray-300 hover:text-indigo-500 text-sm transition-colors" title="메모">📝</button>
        <button onClick={e => { e.stopPropagation(); onComplete() }} className="text-gray-300 hover:text-emerald-500 text-sm transition-colors" title="완료">✅</button>
      </div>
    </div>
  )
}
