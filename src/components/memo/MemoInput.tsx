import { useEffect, useMemo, useRef, useState } from 'react'
import { useClients } from '../../hooks/useClients'
import { useProjects } from '../../hooks/useProjects'
import { parseMemoEdge as parseMemo } from '../../lib/edgeFunctions'
import { hasMemoShortcuts, parseMemoShortcuts } from '../../lib/memoShortcuts'
import type { ParsedResult } from '../../types'

interface Props {
  onParsed: (result: ParsedResult) => void
  onLoading: (loading: boolean) => void
  initialClientId?: string
  initialProjectId?: string
}

type ActiveToken = {
  symbol: '/' | '#'
  query: string
  start: number
  end: number
} | null

const hintClass = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium'
const selCls = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

function getActiveToken(text: string, cursor: number): ActiveToken {
  const beforeCursor = text.slice(0, cursor)
  const match = beforeCursor.match(/(^|\s)([\/#])([^\s\/#@!]*)$/)
  if (!match) return null
  const symbol = match[2] as '/' | '#'
  const query = match[3] ?? ''
  const start = cursor - query.length - 1
  return { symbol, query, start, end: cursor }
}

const isSpeechSupported =
  typeof window !== 'undefined' &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  !!((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)

export default function MemoInput({ onParsed, onLoading, initialClientId = '', initialProjectId = '' }: Props) {
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const [text, setText] = useState('')
  const [cursor, setCursor] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 음성 인식
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    return () => { recognitionRef.current?.abort() }
  }, [])

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'ko-KR'
    rec.continuous = true
    rec.interimResults = true

    rec.onstart = () => setListening(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let finalChunk = ''
      let interimChunk = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalChunk += t
        else interimChunk += t
      }
      if (finalChunk) setText(prev => prev ? `${prev} ${finalChunk}` : finalChunk)
      setInterim(interimChunk)
    }

    rec.onerror = () => { setListening(false); setInterim('') }
    rec.onend   = () => { setListening(false); setInterim('') }

    recognitionRef.current = rec
    rec.start()
  }

  const [expanded, setExpanded] = useState(!!(initialClientId || initialProjectId))
  const [pickedClientId, setPickedClientId] = useState(initialClientId)
  const [pickedProjectId, setPickedProjectId] = useState(initialProjectId)
  const [pickedDate, setPickedDate] = useState('')
  const [pickedTime, setPickedTime] = useState('')

  const pickerProjects = useMemo(
    () => pickedClientId ? projects.filter(p => p.client_id === pickedClientId) : projects,
    [pickedClientId, projects],
  )

  const shortcuts = useMemo(() => parseMemoShortcuts(text), [text])
  const activeToken = useMemo(() => getActiveToken(text, cursor), [cursor, text])
  const suggestions = useMemo(() => {
    if (!activeToken) return []
    const query = activeToken.query.toLowerCase()
    const source = activeToken.symbol === '/' ? projects.map(p => p.name) : clients.map(c => c.name)
    return source.filter(name => !query || name.toLowerCase().includes(query)).slice(0, 6)
  }, [activeToken, clients, projects])

  const hasPickerContext = !!(pickedClientId || pickedProjectId || pickedDate || pickedTime)
  const canRun = (text.trim().length > 0 || hasPickerContext) && !running

  const clearPickers = () => {
    setPickedClientId('')
    setPickedProjectId('')
    setPickedDate('')
    setPickedTime('')
  }

  const handleParse = async () => {
    if (!canRun) return

    const prefixes: string[] = []
    if (pickedClientId) {
      const c = clients.find(c => c.id === pickedClientId)
      if (c) prefixes.push(`#[${c.name}]`)
    }
    if (pickedProjectId) {
      const p = projects.find(p => p.id === pickedProjectId)
      if (p) prefixes.push(`/[${p.name}]`)
    }
    if (pickedDate) prefixes.push(`@${pickedDate}`)
    if (pickedTime) prefixes.push(`@${pickedTime}`)
    const fullText = prefixes.length ? `${prefixes.join(' ')} ${text}`.trim() : text

    setError(null)
    setRunning(true)
    onLoading(true)

    try {
      const merged = parseMemoShortcuts(fullText)
      const result = await Promise.race([
        parseMemo(fullText, merged, {
          existingClients: clients.map(c => c.name),
          existingProjects: projects.map(p => p.name),
        }),
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

  const updateCursor = (element: HTMLTextAreaElement) => setCursor(element.selectionStart)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-semibold text-gray-700">메모 입력</label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setExpanded(v => !v)} className="text-xs text-gray-400 hover:text-indigo-600 transition-colors">
            {expanded ? '접기' : '긴 텍스트'}
          </button>
          <span className="text-xs text-gray-400 hidden sm:inline">Enter 실행 · Shift+Enter 줄바꿈</span>
        </div>
      </div>

      {/* 1차: 자유 텍스트 (제일 위) */}
      <div className="relative mb-3 flex gap-2 items-stretch">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={event => { setText(event.target.value); updateCursor(event.target) }}
          onClick={event => updateCursor(event.currentTarget)}
          onKeyUp={event => updateCursor(event.currentTarget)}
          onKeyDown={handleKeyDown}
          rows={expanded ? 14 : 4}
          placeholder={hasPickerContext
            ? '추가 내용을 입력하세요 (없으면 비워도 됩니다)'
            : `예) #[중소회계법인] /감사보고서 오늘 오전10시 미팅\n예) * 오전10시 1차미팅  * 오후3시 내부검토`}
          className="flex-1 resize-none text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {isSpeechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            title={listening ? '음성 인식 중지' : '음성으로 입력'}
            className={`flex flex-col items-center justify-center gap-1 w-14 rounded-xl border-2 transition-all shrink-0 ${
              listening
                ? 'border-red-400 bg-red-50 text-red-500'
                : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-500'
            }`}
          >
            <span className={`text-2xl leading-none ${listening ? 'animate-pulse' : ''}`}>🎤</span>
            <span className="text-[10px] font-medium leading-none">{listening ? '중지' : '음성'}</span>
          </button>
        )}
        {interim && (
          <p className="absolute bottom-2 left-3 text-sm text-gray-300 pointer-events-none truncate" style={{ right: '4rem' }}>
            {interim}
          </p>
        )}

        {activeToken && suggestions.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
            <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-100">
              {activeToken.symbol === '/' ? '프로젝트 추천' : '거래처 추천'}
            </div>
            {suggestions.map(suggestion => (
              <button
                key={suggestion}
                type="button"
                onMouseDown={event => { event.preventDefault(); insertSuggestion(suggestion) }}
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2차: 거래처·프로젝트·날짜 선택 */}
      <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">연결 선택 <span className="text-gray-400 font-normal">(선택 사항)</span></span>
          {hasPickerContext && (
            <button type="button" onClick={clearPickers} className="text-xs text-gray-400 hover:text-gray-600">
              초기화
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">거래처</label>
            <select value={pickedClientId} onChange={e => { setPickedClientId(e.target.value); setPickedProjectId('') }} className={selCls}>
              <option value="">— 선택 안 함 —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">프로젝트</label>
            <select value={pickedProjectId} onChange={e => setPickedProjectId(e.target.value)} className={selCls}>
              <option value="">— 선택 안 함 —</option>
              {pickerProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">날짜</label>
            <input type="date" value={pickedDate} onChange={e => setPickedDate(e.target.value)} className={selCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">시간</label>
            <input type="time" value={pickedTime} onChange={e => setPickedTime(e.target.value)} className={selCls} />
          </div>
        </div>
      </div>

      {/* 단축어 힌트 */}
      <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
        <div className="flex flex-wrap gap-2 text-xs text-gray-400">
          <span><strong className="text-gray-500">#</strong> 거래처</span>
          <span><strong className="text-gray-500">/</strong> 프로젝트</span>
          <span><strong className="text-gray-500">@</strong> 날짜·시간</span>
          <span><strong className="text-gray-500">@이름</strong> 담당자</span>
          <span><strong className="text-gray-500">!</strong> 우선순위</span>
          <span><strong className="text-gray-500">*</strong> 개별일정</span>
        </div>
        {hasMemoShortcuts(shortcuts) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shortcuts.projects.map(p => (
              <span key={`p-${p}`} className={`${hintClass} bg-purple-50 text-purple-700`}>프로젝트 {p}</span>
            ))}
            {shortcuts.clients.map(c => (
              <span key={`c-${c}`} className={`${hintClass} bg-indigo-50 text-indigo-700`}>거래처 {c}</span>
            ))}
            {shortcuts.dates.map(d => (
              <span key={`d-${d}`} className={`${hintClass} bg-blue-50 text-blue-700`}>날짜 {d}</span>
            ))}
            {shortcuts.times.map(t => (
              <span key={`t-${t}`} className={`${hintClass} bg-cyan-50 text-cyan-700`}>시간 {t}</span>
            ))}
            {shortcuts.priorities.map(pr => (
              <span key={`pr-${pr}`} className={`${hintClass} bg-orange-50 text-orange-700`}>
                {pr === 'high' ? '높음' : pr === 'medium' ? '보통' : '낮음'}
              </span>
            ))}
            {shortcuts.people.map(person => (
              <span key={`pe-${person}`} className={`${hintClass} bg-pink-50 text-pink-700`}>담당자 {person}</span>
            ))}
            {shortcuts.scheduleItems.map((item, i) => (
              <span key={`s-${i}`} className={`${hintClass} bg-teal-50 text-teal-700`}>일정 {item.slice(0, 20)}{item.length > 20 ? '…' : ''}</span>
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
          disabled={!canRun}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {running ? '실행 중...' : '실행'}
        </button>
      </div>
    </div>
  )
}
