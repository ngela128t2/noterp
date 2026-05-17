import { useNavigate } from 'react-router-dom'
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

function navigateToItem(item: StreamItem, navigate: ReturnType<typeof useNavigate>) {
  if (item.stream_type === 'memo') return navigate('/memo')
  if (item.client_id)  return navigate(`/workspace/client/${item.client_id}`)
  if (item.project_id) return navigate(`/workspace/project/${item.project_id}`)
  switch (item.stream_type) {
    case 'event':     return navigate('/calendar')
    case 'todo':      return navigate('/todos')
    case 'milestone': return navigate('/projects')
    case 'activity':  return navigate('/')
  }
}

// 메모 카드 — 원본 메모 + 파생 항목을 하나의 카드로 압축
function MemoCard({ memo, derived }: StreamGroup) {
  const navigate = useNavigate()
  const visible = derived.slice(0, 4)
  const hidden = derived.length - visible.length

  // 파생 항목들이 공통으로 연결된 거래처/프로젝트 추출
  const connectedClients = Array.from(
    new Set(derived.map(d => d.client_name).filter((n): n is string => !!n))
  )
  const connectedProjects = Array.from(
    new Set(derived.map(d => d.project_name).filter((n): n is string => !!n))
  )

  return (
    <button
      onClick={() => navigateToItem(memo, navigate)}
      className="w-full text-left bg-white rounded-xl border border-gray-100 hover:border-amber-200 hover:shadow-sm transition-all p-4 group"
    >
      {/* 메모 본문 — 강조 */}
      <div className="flex items-start gap-2.5 mb-1">
        <span className="text-base leading-none mt-0.5 shrink-0">📝</span>
        <p className="flex-1 text-sm font-semibold text-gray-900 leading-snug group-hover:text-indigo-600 line-clamp-2">
          {memo.title}
        </p>
        <span className="text-[10px] font-mono text-gray-300 shrink-0 mt-1">
          {timeLabel(memo.created_at)}
        </span>
      </div>

      {/* 파생 항목 — 작고 흐리게 */}
      {(connectedClients.length > 0 || connectedProjects.length > 0 || derived.length > 0) && (
        <div className="pl-7 mt-2 space-y-0.5">
          {/* 거래처 연결 — 최상단 */}
          {connectedClients.map(name => (
            <div key={`c-${name}`} className="flex items-baseline gap-1.5 text-xs">
              <span className="text-gray-300">↳</span>
              <span className="text-gray-500">거래처</span>
              <span className="text-indigo-500 font-medium truncate">· {name}</span>
            </div>
          ))}

          {/* 프로젝트 연결 */}
          {connectedProjects.map(name => (
            <div key={`p-${name}`} className="flex items-baseline gap-1.5 text-xs">
              <span className="text-gray-300">↳</span>
              <span className="text-gray-500">프로젝트</span>
              <span className="text-purple-500 font-medium truncate">· {name}</span>
            </div>
          ))}

          {/* 파생 항목 (일정/할일/마일스톤) */}
          {visible.map(d => (
            <div key={`${d.stream_type}-${d.id}`} className="flex items-baseline gap-1.5 text-xs text-gray-400">
              <span className="text-gray-300">↳</span>
              <span className="text-gray-500">{TYPE_LABEL[d.stream_type]}</span>
              <span className="text-gray-400 truncate">· {d.title}</span>
            </div>
          ))}
          {hidden > 0 && (
            <div className="text-[11px] text-gray-300 pl-3">↳ 외 {hidden}건 더</div>
          )}
        </div>
      )}
      {derived.length === 0 && connectedClients.length === 0 && connectedProjects.length === 0 && (
        <div className="pl-7 mt-1.5 text-[11px] text-gray-300">— 파생 항목 없음</div>
      )}
    </button>
  )
}

// Orphan — 메모 없이 직접 추가된 일정/할일/마일스톤 (보조)
function OrphanRow({ item }: { item: StreamItem }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigateToItem(item, navigate)}
      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left group"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[item.stream_type]}`} />
      <span className="text-[11px] text-gray-400 shrink-0 w-10">{TYPE_LABEL[item.stream_type]}</span>
      <span className="flex-1 min-w-0 text-xs text-gray-600 group-hover:text-indigo-600 truncate">{item.title}</span>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">오늘의 흐름</h2>
        </div>
        <div className="h-20 bg-gray-50 rounded-xl animate-pulse" />
      </section>
    )
  }

  const memoGroups = rows.filter((r): r is StreamGroup => r.kind === 'memo-group')
  const orphans = rows.filter((r): r is StreamOrphan => r.kind === 'orphan')

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-gray-800">오늘의 흐름</h2>
          {memoGroups.length > 0 && (
            <span className="text-[11px] text-gray-400">메모 {memoGroups.length}건</span>
          )}
        </div>
        <button onClick={() => navigate('/memo')}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
          + 메모
        </button>
      </div>

      {memoGroups.length === 0 && orphans.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-8 text-center">
          <p className="text-sm text-gray-400">오늘 새로 생긴 업무가 없습니다</p>
          <button onClick={() => navigate('/memo')} className="mt-2 text-xs text-indigo-500 hover:underline">
            메모로 시작하기 →
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* 메모 중심 카드 */}
          {memoGroups.map(g => (
            <MemoCard key={g.memo.id} {...g} />
          ))}

          {/* Orphan — 메모 없이 직접 추가된 항목들 */}
          {orphans.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
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
