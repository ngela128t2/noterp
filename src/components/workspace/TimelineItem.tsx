import type { TimelineItem } from '../../hooks/useContextTimeline'
import { formatLog } from '../../hooks/useLogs'


function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

const STRIP: Record<string, string> = {
  log: 'bg-gray-300',
  event: 'bg-blue-400',
  milestone: 'bg-purple-400',
  todo: 'bg-orange-400',
}

const LABEL: Record<string, string> = {
  log: '활동',
  event: '일정',
  milestone: '타임라인',
  todo: '할 일',
}

export default function TimelineItemRow({ item }: { item: TimelineItem }) {
  return (
    <li className="flex gap-3 py-3 px-4 hover:bg-gray-50 transition-colors">
      <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
        <span className={`w-2 h-2 rounded-full ${STRIP[item.kind]}`} />
        <span className="text-[10px] text-gray-400 leading-none">{LABEL[item.kind]}</span>
      </div>

      <div className="flex-1 min-w-0">
        {item.kind === 'log' && (
          <>
            <p className="text-sm text-gray-700">{formatLog(item.data)}</p>
            {item.data.detail?.memo && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{item.data.detail.memo}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(item.data.created_at)}</p>
          </>
        )}

        {item.kind === 'event' && (
          <>
            <p className="text-sm font-medium text-gray-800">{item.data.title}</p>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
              <span className="text-blue-500">{formatDay(item.data.date)}</span>
              {item.data.time && <span>{item.data.time.slice(0, 5)}</span>}
              {item.data.location && <span>📍 {item.data.location}</span>}
            </div>
          </>
        )}

        {item.kind === 'milestone' && (
          <>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${item.data.completed ? 'bg-emerald-500' : 'bg-purple-400'}`} />
              <p className={`text-sm font-medium ${item.data.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.data.title}</p>
            </div>
            {item.data.due_date && (
              <p className="text-xs text-gray-400 mt-0.5 ml-4">
                {item.data.time ? `${formatDay(item.data.due_date)} ${item.data.time.slice(0, 5)}` : formatDay(item.data.due_date)}
                {item.data.completed && ' · 완료'}
              </p>
            )}
          </>
        )}

        {item.kind === 'todo' && (
          <>
            <p className={`text-sm ${item.data.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.data.title}</p>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
              {item.data.due_date && <span className="text-orange-500">{formatDay(item.data.due_date)}</span>}
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${item.data.priority === 'high' ? 'bg-red-50 text-red-500' : item.data.priority === 'medium' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-400'}`}>
                {item.data.priority === 'high' ? '높음' : item.data.priority === 'medium' ? '보통' : '낮음'}
              </span>
            </div>
          </>
        )}
      </div>
    </li>
  )
}
