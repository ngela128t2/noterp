import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardStats } from '../hooks/useDashboard'
import { useToggleTodo } from '../hooks/useTodos'
import MiniCalendar from '../components/dashboard/MiniCalendar'

const KPI_CONFIG = [
  { key: 'projectCount', label: '진행 중 프로젝트', icon: 'P', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', link: '/projects' },
  { key: 'clientCount', label: '활성 거래처', icon: 'C', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', link: '/clients' },
  { key: 'weekEventsLen', label: '이번 주 일정', icon: 'D', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', link: '/calendar' },
  { key: 'pendingLen', label: '미완료 할 일', icon: 'T', color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100', link: '/todos' },
]

export default function Dashboard() {
  const { data, isLoading } = useDashboardStats()
  const toggleTodo = useToggleTodo()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  const kpiValues: Record<string, number> = {
    projectCount: data?.projectCount ?? 0,
    clientCount: data?.clientCount ?? 0,
    weekEventsLen: data?.weekEvents.length ?? 0,
    pendingLen: data?.pendingTodos.length ?? 0,
  }

  return (
    <div className="p-6 space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CONFIG.map(({ key, label, icon, color, bg, border, link }) => (
          <button
            key={key}
            onClick={() => navigate(link)}
            className={`rounded-xl border ${border} ${bg} p-4 text-left hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`w-7 h-7 rounded-lg bg-white/70 flex items-center justify-center text-xs font-bold ${color}`}>{icon}</span>
              <span className={`text-2xl font-bold ${color}`}>{kpiValues[key]}</span>
            </div>
            <p className="text-xs text-gray-500">{label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <MiniCalendar
              events={data?.weekEvents ?? []}
              onDateClick={() => navigate('/calendar')}
            />
          </div>

          <Card title="미완료 할 일" action={{ label: '전체 보기', onClick: () => navigate('/todos') }}>
            {(data?.pendingTodos ?? []).length === 0 ? (
              <Empty text="미완료 할 일이 없습니다." />
            ) : (
              <ul className="space-y-1">
                {data!.pendingTodos.slice(0, 6).map((todo: any) => (
                  <li key={todo.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={event => toggleTodo.mutate({ id: todo.id, completed: event.target.checked })}
                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer shrink-0"
                    />
                    <span className="text-sm text-gray-700 truncate flex-1">{todo.title}</span>
                    {todo.due_date && (
                      <span className={`text-xs shrink-0 tabular-nums ${todo.due_date < new Date().toISOString().split('T')[0] ? 'text-red-400' : 'text-gray-400'}`}>
                        {todo.due_date.slice(5)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <Card title="오늘 일정" action={{ label: '전체 보기', onClick: () => navigate('/calendar') }}>
            {(data?.todayEvents ?? []).length === 0 ? (
              <Empty text="오늘 일정이 없습니다." />
            ) : (
              <ul className="divide-y divide-gray-50">
                {data!.todayEvents.map((event: any) => (
                  <li key={event.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-14 text-xs text-indigo-500 font-medium shrink-0">
                      {event.time?.slice(0, 5) ?? '종일'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{event.title}</p>
                      {event.clients && <p className="text-xs text-gray-400 truncate">{event.clients.name}</p>}
                    </div>
                    {event.location && <span className="text-xs text-gray-400 shrink-0 truncate max-w-32">{event.location}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="오늘 마감 할 일" action={{ label: '전체 보기', onClick: () => navigate('/todos') }}>
            {(data?.todayTodos ?? []).length === 0 ? (
              <Empty text="오늘 마감 할 일이 없습니다." />
            ) : (
              <ul className="space-y-1.5">
                {data!.todayTodos.map((todo: any) => (
                  <li key={todo.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={event => toggleTodo.mutate({ id: todo.id, completed: event.target.checked })}
                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer shrink-0"
                    />
                    <span className="text-sm text-gray-800 flex-1 truncate">{todo.title}</span>
                    {todo.clients && <span className="text-xs text-gray-400 shrink-0 truncate max-w-32">{todo.clients.name}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="이번 주 일정" action={{ label: '캘린더로', onClick: () => navigate('/calendar') }}>
            {(data?.weekEvents ?? []).length === 0 ? (
              <Empty text="이번 주 일정이 없습니다." />
            ) : (
              <ul className="divide-y divide-gray-50">
                {data!.weekEvents.slice(0, 6).map((event: any) => (
                  <li key={event.id} className="flex items-center gap-3 py-2">
                    <span className="text-xs text-gray-400 w-12 shrink-0 tabular-nums">{event.date.slice(5)}</span>
                    <span className="text-xs text-gray-400 w-12 shrink-0">{event.time?.slice(0, 5) ?? '종일'}</span>
                    <span className="text-sm text-gray-700 truncate flex-1">{event.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children, action }: {
  title: string
  children: ReactNode
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {action && (
          <button onClick={action.onClick} className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline">
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 py-2">{text}</p>
}
