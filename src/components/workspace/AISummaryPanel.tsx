import { useEffect, useRef, useState } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import type { TimelineItem } from '../../hooks/useContextTimeline'

const ai = new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true })

const CACHE_TTL = 60 * 60 * 1000

function cacheKey(type: string, id: string) {
  return `ws-brief:${type}:${id}`
}

function readCache(key: string): string | null {
  try {
    const v = sessionStorage.getItem(key)
    if (!v) return null
    const { t, s } = JSON.parse(v)
    if (Date.now() - t > CACHE_TTL) { sessionStorage.removeItem(key); return null }
    // "..." 이름으로 생성된 잘못된 캐시는 무시
    if (typeof s === 'string' && s.includes("'...'")) { sessionStorage.removeItem(key); return null }
    return s
  } catch { return null }
}

function writeCache(key: string, text: string) {
  try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), s: text })) } catch {}
}

function serialize(item: TimelineItem): string {
  if (item.kind === 'log') return `[활동] ${item.data.action} "${item.data.entity_name ?? ''}" (${item.data.created_at.slice(0, 10)})`
  if (item.kind === 'event') return `[일정] ${item.data.title} ${item.data.date}${item.data.time ? ' ' + item.data.time.slice(0, 5) : ''}`
  if (item.kind === 'milestone') return `[마일스톤] ${item.data.completed ? '✓' : '○'} ${item.data.title}${item.data.due_date ? ' (' + item.data.due_date + ')' : ''}`
  if (item.kind === 'todo') return `[할일] ${item.data.completed ? '✓' : '○'} ${item.data.title}${item.data.due_date ? ' ~' + item.data.due_date : ''}`
  return ''
}

function daysAgo(dateStr: string): string {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (d === 0) return '오늘'
  if (d === 1) return '어제'
  return `${d}일 전`
}

interface Props {
  contextId: string
  contextName: string
  contextType: string
  items: TimelineItem[]
}

export default function AISummaryPanel({ contextId, contextName, contextType, items }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const triggeredRef = useRef<string | null>(null)
  const key = cacheKey(contextType, contextId)
  const lastDate = items[0]?.sortKey.slice(0, 10) ?? null

  // Auto-load on workspace entry (once per contextId+name, with 1h cache)
  useEffect(() => {
    const triggerKey = `${contextId}:${contextName}`
    if (triggeredRef.current === triggerKey) return
    if (!contextName || contextName === '...') return  // wait for name to resolve
    const cached = readCache(key)
    if (cached) {
      setSummary(cached)
      triggeredRef.current = triggerKey
      return
    }
    if (items.length === 0) return  // wait for timeline data
    triggeredRef.current = triggerKey

    let cancelled = false
    setLoading(true)
    setSummary(null)

    const context = items.slice(0, 20).map(serialize).join('\n')
    ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `회계법인 업무 비서. ${contextType === 'client' ? '거래처' : '프로젝트'} "${contextName}"의 업무 흐름을 4~6개 항목으로 복원하세요.\n각 항목 앞에 반드시 아래 마커 중 하나를 붙이세요:\n  [Done]        완료된 일\n  [In Progress] 현재 진행·예정 중인 일\n  [Pending]     아직 시작 안 됨·미확정·follow-up 필요\n형식: "[마커] 한 줄 행동 중심 텍스트"\n예시: "[Done] 감사보고서 제출 완료", "[In Progress] 담당자 미팅 일정 진행 중", "[Pending] 수임료 납부 확인 필요"`,
      messages: [{ role: 'user', content: `최근 활동 (최신순):\n${context}` }],
    }).then(({ content }) => {
      if (cancelled) return
      const text = content[0].type === 'text' ? content[0].text : ''
      setSummary(text)
      writeCache(key, text)
    }).catch(() => {
      if (!cancelled) setSummary('흐름 복원 중 오류가 발생했습니다.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [contextId, contextName, items.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const regenerate = () => {
    triggeredRef.current = null
    setSummary(null)
    sessionStorage.removeItem(key)
    // Re-trigger by resetting — next effect run will pick it up
    triggeredRef.current = null
    if (items.length === 0) return
    triggeredRef.current = contextId

    let cancelled = false
    setLoading(true)
    const context = items.slice(0, 20).map(serialize).join('\n')
    ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `회계법인 업무 비서. ${contextType === 'client' ? '거래처' : '프로젝트'} "${contextName}"의 업무 흐름을 4~6개 항목으로 복원하세요.\n각 항목 앞에 반드시 아래 마커 중 하나를 붙이세요:\n  [Done]        완료된 일\n  [In Progress] 현재 진행·예정 중인 일\n  [Pending]     아직 시작 안 됨·미확정·follow-up 필요\n형식: "[마커] 한 줄 행동 중심 텍스트"\n예시: "[Done] 감사보고서 제출 완료", "[In Progress] 담당자 미팅 일정 진행 중", "[Pending] 수임료 납부 확인 필요"`,
      messages: [{ role: 'user', content: `최근 활동 (최신순):\n${context}` }],
    }).then(({ content }) => {
      if (cancelled) return
      const text = content[0].type === 'text' ? content[0].text : ''
      setSummary(text)
      writeCache(key, text)
    }).catch(() => {
      if (!cancelled) setSummary('흐름 복원 중 오류가 발생했습니다.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-indigo-400">✦</span>
          <span className="text-xs font-semibold text-indigo-700">업무 흐름 복원</span>
          {lastDate && !loading && (
            <span className="text-[10px] text-indigo-300 bg-white border border-indigo-100 px-1.5 py-0.5 rounded-full">
              마지막 활동 {daysAgo(lastDate)}
            </span>
          )}
        </div>
        <button
          onClick={regenerate}
          disabled={loading}
          className="text-[10px] text-indigo-300 hover:text-indigo-500 disabled:opacity-40 transition-colors"
        >
          {loading ? '분석 중...' : '다시 생성'}
        </button>
      </div>

      {loading && (
        <div className="space-y-2 py-1">
          <div className="h-2.5 bg-indigo-100 rounded-full animate-pulse" />
          <div className="h-2.5 bg-indigo-100 rounded-full animate-pulse w-5/6" />
          <div className="h-2.5 bg-indigo-100 rounded-full animate-pulse w-2/3" />
        </div>
      )}

      {summary && !loading && <BulletList text={summary} />}

      {!summary && !loading && items.length === 0 && (
        <p className="text-xs text-gray-400 py-1">아직 기록된 활동이 없습니다. 메모를 입력하면 흐름이 쌓입니다.</p>
      )}
    </div>
  )
}

const STATUS_CHIP: Record<string, { label: string; chip: string; text: string }> = {
  Done:        { label: 'Done',        chip: 'bg-emerald-50 text-emerald-600 border-emerald-200', text: 'text-gray-400 line-through' },
  'In Progress':{ label: 'In Progress', chip: 'bg-indigo-50 text-indigo-600 border-indigo-200',   text: 'text-gray-800' },
  Pending:     { label: 'Pending',     chip: 'bg-amber-50 text-amber-600 border-amber-200',       text: 'text-gray-700' },
}

function parseMarker(line: string): { marker: string; content: string } {
  const m = line.match(/^\[(Done|In Progress|Pending)\]\s*(.+)$/)
  if (m) return { marker: m[1], content: m[2] }
  return { marker: '', content: line.replace(/^[•\-·]\s*/, '').trim() }
}

function BulletList({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return (
    <ul className="space-y-2">
      {lines.map((line, i) => {
        const { marker, content } = parseMarker(line)
        const style = STATUS_CHIP[marker]
        return (
          <li key={i} className="flex items-start gap-2.5">
            {style ? (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 whitespace-nowrap ${style.chip}`}>
                {style.label}
              </span>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0 mt-1.5" />
            )}
            <span className={`text-sm leading-snug ${style?.text ?? 'text-gray-700'}`}>{content}</span>
          </li>
        )
      })}
    </ul>
  )
}
