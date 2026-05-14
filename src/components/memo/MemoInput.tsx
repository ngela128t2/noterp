import { useMemo, useRef, useState } from 'react'
import { useClients } from '../../hooks/useClients'
import { useProjects } from '../../hooks/useProjects'
import { parseMemo } from '../../lib/claude'
import { hasMemoShortcuts, parseMemoShortcuts } from '../../lib/memoShortcuts'
import type { ParsedResult } from '../../types'

interface Props {
  onParsed: (result: ParsedResult) => void
  onLoading: (loading: boolean) => void
}

type ActiveToken = {
  symbol: '/' | '#'
  query: string
  start: number
  end: number
} | null

const hintClass = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium'

function getActiveToken(text: string, cursor: number): ActiveToken {
  const beforeCursor = text.slice(0, cursor)
  const match = beforeCursor.match(/(^|\s)([\/#])([^\s\/#@!]*)$/)
  if (!match) return null
  const symbol = match[2] as '/' | '#'
  const query = match[3] ?? ''
  const start = cursor - query.length - 1
  return { symbol, query, start, end: cursor }
}

export default function MemoInput({ onParsed, onLoading }: Props) {
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const [text, setText] = useState('')
  const [cursor, setCursor] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const shortcuts = useMemo(() => parseMemoShortcuts(text), [text])
  const activeToken = useMemo(() => getActiveToken(text, cursor), [cursor, text])
  const suggestions = useMemo(() => {
    if (!activeToken) return []
    const query = activeToken.query.toLowerCase()
    const source = activeToken.symbol === '/' ? projects.map(project => project.name) : clients.map(client => client.name)
    return source.filter(name => !query || name.toLowerCase().includes(query)).slice(0, 6)
  }, [activeToken, clients, projects])

  const handleParse = async () => {
    if (!text.trim() || running) return
    setError(null)
    setRunning(true)
    onLoading(true)

    try {
      const result = await Promise.race([
        parseMemo(text, shortcuts),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('분석 시간이 너무 오래 걸립니다. 잠시 후 다시 실행해 주세요.')), 45000)
        }),
      ])
      onParsed(result)
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : '파싱 중 오류가 발생했습니다. 다시 시도해 주세요.')
      onLoading(false)
    } finally {
      setRunning(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleParse()
    }
  }

  const insertSuggestion = (value: string) => {
    if (!activeToken) return
    const wrapped = `${activeToken.symbol}[${value}] `
    const next = `${text.slice(0, activeToken.start)}${wrapped}${text.slice(activeToken.end)}`
    const nextCursor = activeToken.start + wrapped.length
    setText(next)
    setCursor(nextCursor)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor)
    })
  }

  const updateCursor = (element: HTMLTextAreaElement) => {
    setCursor(element.selectionStart)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-gray-700">메모 입력</label>
        <span className="text-xs text-gray-400">Enter 실행 · Shift+Enter 줄바꿈</span>
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            updateCursor(event.target)
          }}
          onClick={(event) => updateCursor(event.currentTarget)}
          onKeyUp={(event) => updateCursor(event.currentTarget)}
          onKeyDown={handleKeyDown}
          rows={6}
          placeholder={`예) /기록작업 #네일클린 오늘 2시에 카톡생성 및 전화하기\n예) /사전심리 #회계법인성지 이번주 일요일 감사보고서 미팅 준비`}
          className="w-full resize-none text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />

        {activeToken && suggestions.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
            <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-100">
              {activeToken.symbol === '/' ? '프로젝트 추천' : '거래처 추천'}
            </div>
            {suggestions.map(suggestion => (
              <button
                key={suggestion}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  insertSuggestion(suggestion)
                }}
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          <span><strong>/</strong> 프로젝트</span>
          <span><strong>#</strong> 거래처</span>
          <span><strong>@</strong> 날짜</span>
          <span><strong>!</strong> 우선순위</span>
        </div>
        {hasMemoShortcuts(shortcuts) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {shortcuts.projects.map(project => (
              <span key={`project-${project}`} className={`${hintClass} bg-purple-50 text-purple-700`}>프로젝트 {project}</span>
            ))}
            {shortcuts.clients.map(client => (
              <span key={`client-${client}`} className={`${hintClass} bg-indigo-50 text-indigo-700`}>거래처 {client}</span>
            ))}
            {shortcuts.dates.map(date => (
              <span key={`date-${date}`} className={`${hintClass} bg-blue-50 text-blue-700`}>날짜 {date}</span>
            ))}
            {shortcuts.times.map(time => (
              <span key={`time-${time}`} className={`${hintClass} bg-cyan-50 text-cyan-700`}>시간 {time}</span>
            ))}
            {shortcuts.priorities.map(priority => (
              <span key={`priority-${priority}`} className={`${hintClass} bg-orange-50 text-orange-700`}>
                우선순위 {priority === 'high' ? '높음' : priority === 'medium' ? '보통' : '낮음'}
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      <div className="flex justify-end mt-3">
        <button
          onClick={handleParse}
          disabled={!text.trim() || running}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {running ? '실행 중...' : '실행'}
        </button>
      </div>
    </div>
  )
}
