import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MiniCalendar from '../components/dashboard/MiniCalendar'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { useDashboardStats } from '../hooks/useDashboard'
import { useDeadlineDashboardStats } from '../hooks/useDeadlines'
import { useOpenLoops } from '../hooks/useOpenLoops'
import { useToggleTodo } from '../hooks/useTodos'
import { generateBriefingEdge as generateDailyBriefing } from '../lib/edgeFunctions'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`
}

function timeLabel(time: string | null) {
  if (!time) return '종일'
  const [h, m] = time.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`
}

export default function Dashboard() {
  const { data, isLoading } = useDashboardStats()
  const { data: allEvents = [] } = useCalendarEvents()
  const { data: deadlineStats } = useDeadlineDashboardStats()
  const { data: openLoops = [] } = useOpenLoops()
  const toggleTodo = useToggleTodo()
  const navigate = useNavigate()

  const todayStr = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)

  const selectedEvents = useMemo(() =>
    allEvents
      .filter(e => e.date === selectedDate)
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
          title: e.title,
          time: e.time,
          clientName: e.clients?.name ?? null,
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

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 space-y-3">
            {[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
          <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  const todayEvents: any[] = data?.todayEvents ?? []
  const pendingTodos: any[] = data?.pendingTodos ?? []
  const weekEvents: any[] = data?.weekEvents ?? []

  return (
    <div className="p-5 lg:p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{formatDate(todayStr)}</p>
          <h1 className="text-2xl font-bold text-gray-900">오늘의 업무</h1>
        </div>
        <div className="flex items-center gap-2">
          {todayEvents.length > 0 && (
            <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">
              오늘 일정 {todayEvents.length}건
            </span>
          )}
          {overdueTodos.length > 0 && (
            <span className="text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded-full font-medium">
              연체 {overdueTodos.length}건
            </span>
          )}
          {deadlineStats && deadlineStats.overdue > 0 && (
            <span className="text-xs bg-orange-50 text-orange-500 px-2.5 py-1 rounded-full font-medium">
              마감 {deadlineStats.overdue}건
            </span>
          )}
        </div>
      </div>

      {/* AI 브리핑 */}
      <div className={`rounded-xl border px-4 py-3 transition-all ${briefing ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200 hover:border-indigo-200'}`}>
        {briefing ? (
          <div className="flex items-start gap-3">
            <span className="text-indigo-400 mt-0.5 shrink-0">✦</span>
            <div className="flex-1">
              <DashboardBulletList text={briefing} />
            </div>
            <button
              onClick={() => setBriefing(null)}
              className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
            >닫기</button>
          </div>
        ) : (
          <button
            onClick={handleBriefing}
            disabled={briefingLoading}
            className="flex items-center gap-2.5 text-sm text-gray-400 hover:text-indigo-600 transition-colors w-full disabled:cursor-wait"
          >
            <span className={`shrink-0 ${briefingLoading ? 'animate-pulse text-indigo-400' : ''}`}>✦</span>
            <span className={briefingLoading ? 'animate-pulse' : ''}>
              {briefingLoading ? '브리핑 생성 중...' : 'AI로 오늘 업무 브리핑 생성'}
            </span>
            {!briefingLoading && <span className="ml-auto text-xs text-gray-200">클릭하여 생성</span>}
          </button>
        )}
      </div>

      {/* 메인 2컬럼 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">

        {/* 왼쪽 2/3: 오늘 일정 context cards + follow-up + 이번 주 */}
        <div className="xl:col-span-2 space-y-5">

          {/* 오늘/선택일 일정 — Context Entry Points */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                {selectedDate === todayStr ? '오늘 일정' : `${formatDate(selectedDate)} 일정`}
              </h2>
              <button onClick={() => navigate('/calendar')} className="text-xs text-indigo-500 hover:underline">
                캘린더로 →
              </button>
            </div>

            {selectedEvents.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-400">일정이 없습니다</p>
                <button onClick={() => navigate('/calendar')} className="text-xs text-indigo-500 mt-1.5 hover:underline">
                  + 일정 추가
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedEvents.map((event: any) => (
                  <EventContextCard
                    key={event.id}
                    event={event}
                    onClick={() => {
                      if (event.client_id) navigate(`/workspace/client/${event.client_id}`)
                      else if (event.project_id) navigate(`/workspace/project/${event.project_id}`)
                      else navigate('/calendar')
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Open Loops */}
          {openLoops.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                  Open Loops
                  <span className="text-xs font-normal text-gray-400">— 흐름이 멈춘 업무</span>
                </h2>
                <button onClick={() => navigate('/todos')} className="text-xs text-indigo-500 hover:underline">
                  전체 →
                </button>
              </div>
              <div className="space-y-2">
                {openLoops.map(loop => (
                  <div
                    key={loop.id}
                    onClick={() => {
                      if (loop.clientId) navigate(`/workspace/client/${loop.clientId}`)
                      else if (loop.projectId) navigate(`/workspace/project/${loop.projectId}`)
                      else navigate('/todos')
                    }}
                    className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-rose-300 hover:shadow-sm transition-all group"
                  >
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 whitespace-nowrap ${
                      loop.kind === 'overdue_todo'
                        ? 'bg-rose-50 text-rose-600 border-rose-200'
                        : 'bg-violet-50 text-violet-600 border-violet-200'
                    }`}>
                      {loop.kind === 'overdue_todo' ? 'Todo' : 'Project'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{loop.title}</p>
                      <p className="text-xs text-gray-400 truncate">{loop.context}</p>
                    </div>
                    <span className="text-xs text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0">
                      워크스페이스 →
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 이번 주 타임라인 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">이번 주</h2>
            </div>
            <WeekTimeline
              events={weekEvents}
              todayStr={todayStr}
              onDateClick={setSelectedDate}
              onEventClick={(event: any) => {
                if (event.client_id) navigate(`/workspace/client/${event.client_id}`)
                else if (event.project_id) navigate(`/workspace/project/${event.project_id}`)
                else navigate('/calendar')
              }}
            />
          </section>
        </div>

        {/* 오른쪽 1/3: 캘린더 + 할 일 + 마감 */}
        <div className="space-y-4">
          {/* 미니 캘린더 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <MiniCalendar
              events={allEvents}
              selectedDate={selectedDate}
              onDateClick={setSelectedDate}
            />
          </div>

          {/* 미완료 할 일 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">미완료 할 일</h3>
              <button onClick={() => navigate('/todos')} className="text-xs text-indigo-500 hover:underline">전체 →</button>
            </div>
            {pendingTodos.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">없습니다</p>
            ) : (
              <ul className="space-y-1.5">
                {pendingTodos.slice(0, 7).map((todo: any) => (
                  <li
                    key={todo.id}
                    onClick={() => todo.client_id ? navigate(`/workspace/client/${todo.client_id}`) : undefined}
                    className={`flex items-center gap-2.5 py-1 rounded group ${todo.client_id ? 'cursor-pointer' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      onClick={e => e.stopPropagation()}
                      onChange={e => toggleTodo.mutate({ id: todo.id, completed: e.target.checked })}
                      className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer shrink-0"
                    />
                    <span className={`flex-1 text-xs truncate ${todo.due_date && todo.due_date < todayStr ? 'text-red-500' : 'text-gray-700'}`}>
                      {todo.title}
                    </span>
                    {todo.due_date && (
                      <span className={`text-[10px] tabular-nums shrink-0 ${todo.due_date < todayStr ? 'text-red-400' : 'text-gray-300'}`}>
                        {todo.due_date.slice(5)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 수금 현황 */}
          {((data?.billingMonthly ?? 0) > 0 || (data?.unpaidAmount ?? 0) > 0) && (
            <button
              onClick={() => navigate('/billing')}
              className="w-full bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-left hover:border-blue-200 hover:bg-blue-50/20 transition-colors"
            >
              <h3 className="text-sm font-semibold text-gray-700 mb-2.5">수금 현황</h3>
              <div className="flex gap-5">
                {(data?.billingMonthly ?? 0) > 0 && (
                  <div>
                    <p className="text-sm font-bold text-blue-600 tabular-nums">₩{Number(data?.billingMonthly ?? 0).toLocaleString('ko-KR')}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">이번 달 청구</p>
                  </div>
                )}
                {(data?.unpaidAmount ?? 0) > 0 && (
                  <div>
                    <p className="text-sm font-bold text-red-500 tabular-nums">₩{Number(data?.unpaidAmount ?? 0).toLocaleString('ko-KR')}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">미수금</p>
                  </div>
                )}
              </div>
            </button>
          )}

          {/* 마감 기한 */}
          {deadlineStats && (deadlineStats.overdue + deadlineStats.thisWeek + deadlineStats.upcoming) > 0 && (
            <button
              onClick={() => navigate('/deadlines')}
              className="w-full bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-left hover:border-orange-200 hover:bg-orange-50/20 transition-colors"
            >
              <h3 className="text-sm font-semibold text-gray-700 mb-2.5">마감 기한</h3>
              <div className="flex gap-5">
                {deadlineStats.overdue > 0 && (
                  <div>
                    <p className="text-xl font-bold text-red-500">{deadlineStats.overdue}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">연체</p>
                  </div>
                )}
                {deadlineStats.thisWeek > 0 && (
                  <div>
                    <p className="text-xl font-bold text-orange-400">{deadlineStats.thisWeek}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">이번 주</p>
                  </div>
                )}
                {deadlineStats.upcoming > 0 && (
                  <div>
                    <p className="text-xl font-bold text-indigo-400">{deadlineStats.upcoming}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">30일 내</p>
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

const STATUS_CHIP: Record<string, { chip: string; text: string }> = {
  Done:          { chip: 'bg-emerald-50 text-emerald-600 border border-emerald-200', text: 'text-gray-400 line-through' },
  'In Progress': { chip: 'bg-indigo-50  text-indigo-600  border border-indigo-200',  text: 'text-indigo-800' },
  Pending:       { chip: 'bg-amber-50   text-amber-600   border border-amber-200',   text: 'text-indigo-700' },
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
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5 whitespace-nowrap ${style.chip}`}>
                {marker}
              </span>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
            )}
            <span className={`text-sm leading-snug ${style?.text ?? 'text-indigo-800'}`}>{content}</span>
          </li>
        )
      })}
    </ul>
  )
}

// 일정 Context Card — workspace 진입점
function EventContextCard({ event, onClick }: { event: any; onClick: () => void }) {
  const hasWorkspace = !!(event.client_id || event.project_id)
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border px-4 py-3.5 transition-all group ${
        hasWorkspace
          ? 'border-gray-200 hover:border-indigo-300 hover:shadow-md cursor-pointer'
          : 'border-gray-200 cursor-default'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-mono text-indigo-500 shrink-0">{timeLabel(event.time)}</span>
            {event.clients?.name && (
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium shrink-0 max-w-[140px] truncate">
                {event.clients.name}
              </span>
            )}
            {event.projects?.name && (
              <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium shrink-0 max-w-[140px] truncate">
                {event.projects.name}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900">{event.title}</p>
          {event.location && (
            <p className="text-xs text-gray-400 mt-1">📍 {event.location}</p>
          )}
        </div>
        {hasWorkspace && (
          <span className="text-xs text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0 whitespace-nowrap pt-0.5">
            워크스페이스 →
          </span>
        )}
      </div>
    </div>
  )
}

// 이번 주 7일 타임라인
function WeekTimeline({ events, todayStr, onDateClick, onEventClick }: {
  events: any[]
  todayStr: string
  onDateClick: (date: string) => void
  onEventClick: (event: any) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStr)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    return {
      dateStr,
      dayLabel: DAYS[d.getDay()],
      dayNum: d.getDate(),
      dayEvents: events.filter(e => e.date === dateStr),
    }
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ dateStr, dayLabel, dayNum, dayEvents }) => {
          const isToday = dateStr === todayStr
          return (
            <div
              key={dateStr}
              onClick={() => onDateClick(dateStr)}
              className={`rounded-lg p-2 text-center min-h-[80px] cursor-pointer transition-colors ${
                isToday ? 'bg-indigo-50' : 'hover:bg-gray-50'
              }`}
            >
              <p className={`text-[10px] font-medium mb-0.5 ${isToday ? 'text-indigo-500' : 'text-gray-400'}`}>
                {dayLabel}
              </p>
              <p className={`text-sm font-bold mb-1.5 ${isToday ? 'text-indigo-700' : 'text-gray-600'}`}>
                {dayNum}
              </p>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((e: any) => (
                  <button
                    key={e.id}
                    onClick={ev => { ev.stopPropagation(); onEventClick(e) }}
                    className="w-full text-left bg-blue-100 text-blue-700 rounded px-1 py-0.5 hover:bg-blue-200 transition-colors leading-tight"
                    title={e.title}
                  >
                    <span className="text-[9px] block truncate">
                      {e.time ? e.time.slice(0, 5) + ' ' : ''}{e.title}
                    </span>
                  </button>
                ))}
                {dayEvents.length > 2 && (
                  <p className="text-[9px] text-gray-400">+{dayEvents.length - 2}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
