import { useNavigate } from 'react-router-dom'
import { useTodayFlow, type StreamItem } from '../../hooks/useActivityStream'

function timeLabel(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const STREAM_META: Record<StreamItem['stream_type'], { label: string; emoji: string; cls: string }> = {
  memo:      { label: '메모',       emoji: '📝', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  event:     { label: '일정',       emoji: '📅', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  todo:      { label: '할 일',      emoji: '✓',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  milestone: { label: '마일스톤',   emoji: '🎯', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  activity:  { label: '활동',       emoji: '·',  cls: 'bg-gray-50 text-gray-500 border-gray-200' },
}

function navigateToItem(item: StreamItem, navigate: ReturnType<typeof useNavigate>) {
  // 우선순위: 메모 → 메모 페이지 / 그 외 → workspace 또는 기능 페이지
  if (item.stream_type === 'memo') {
    navigate('/memo')
    return
  }
  if (item.client_id)  return navigate(`/workspace/client/${item.client_id}`)
  if (item.project_id) return navigate(`/workspace/project/${item.project_id}`)

  switch (item.stream_type) {
    case 'event':     return navigate('/calendar')
    case 'todo':      return navigate('/todos')
    case 'milestone': return navigate('/projects')
    case 'activity':  return navigate('/')
  }
}

function ItemRow({ item, indent = false, showMemoBadge = false }: { item: StreamItem; indent?: boolean; showMemoBadge?: boolean }) {
  const navigate = useNavigate()
  const meta = STREAM_META[item.stream_type]
  return (
    <button
      onClick={() => navigateToItem(item, navigate)}
      className={`w-full flex items-start gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left group ${indent ? 'pl-9' : ''}`}
    >
      <span className="text-[10px] font-mono text-gray-300 shrink-0 pt-1 w-10">{timeLabel(item.created_at)}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 mt-0.5 font-medium ${meta.cls}`}>
        <span className="mr-0.5">{meta.emoji}</span>{meta.label}
      </span>
      <span className="flex-1 min-w-0 text-sm text-gray-700 group-hover:text-indigo-600 truncate">
        {item.title}
      </span>
      {showMemoBadge && item.memo_id && (
        <span className="text-[10px] text-amber-500 shrink-0 mt-1" title="원본 메모에서 생성됨">↳</span>
      )}
    </button>
  )
}

export default function TodayFlow() {
  const { rows, isLoading, rawCount } = useTodayFlow()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">📊 오늘의 흐름</h2>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-6 text-center text-xs text-gray-300">
          불러오는 중...
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-800">📊 오늘의 흐름</h2>
          {rawCount > 0 && (
            <span className="text-[10px] text-gray-400">{rawCount}건</span>
          )}
        </div>
        <button onClick={() => navigate('/memo')} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
          + 메모
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-8 text-center">
          <p className="text-sm text-gray-400">오늘 새로 생긴 업무가 없습니다</p>
          <button onClick={() => navigate('/memo')} className="mt-2 text-xs text-indigo-500 hover:underline">
            메모로 시작하기 →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {rows.map((row, idx) => {
            if (row.kind === 'memo-group') {
              const { memo, derived } = row
              return (
                <div key={`memo-${memo.id}-${idx}`} className="bg-amber-50/30">
                  <ItemRow item={memo} />
                  {derived.length > 0 && (
                    <div className="bg-white">
                      {derived.map(d => (
                        <ItemRow key={`${d.stream_type}-${d.id}`} item={d} indent showMemoBadge />
                      ))}
                    </div>
                  )}
                </div>
              )
            }
            return <ItemRow key={`${row.item.stream_type}-${row.item.id}-${idx}`} item={row.item} />
          })}
        </div>
      )}
    </section>
  )
}
