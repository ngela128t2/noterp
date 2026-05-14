import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import MemoInput from '../components/memo/MemoInput'
import ParseResultCard from '../components/memo/ParseResultCard'
import { normalizeMemoName, parseMemoShortcuts } from '../lib/memoShortcuts'
import { supabase } from '../lib/supabase'
import type { ParsedResult } from '../types'

type State = 'idle' | 'loading' | 'parsed' | 'saving' | 'saved' | 'rejected'
type MemoLog = {
  id: string
  raw_text: string
  parsed_result: ParsedResult | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}
type ClientRow = { id: string; name: string; memo: string | null; needs_review?: boolean | null; source?: string | null }
type ProjectRow = { id: string; name: string; memo: string | null; client_id: string | null }
type MilestoneRow = { id: string; title: string; due_date: string | null }

function appendMemo(existing: string | null | undefined, rawText: string) {
  const stamp = new Date().toLocaleString('ko-KR', { hour12: false })
  const entry = `[${stamp}]\n${rawText.trim()}`
  return existing?.trim() ? `${existing.trim()}\n\n${entry}` : entry
}

function cleanMemoTitle(rawText: string) {
  return rawText
    .replace(/\/\[[^\]]+\]/g, '')
    .replace(/#\[[^\]]+\]/g, '')
    .replace(/\/[^\s/@#!]+/g, '')
    .replace(/#[^\s/@#!]+/g, '')
    .replace(/@\[[^\]]+\]/g, '')
    .replace(/@[^\s]+/g, '')
    .replace(/[!！](높음|보통|낮음|긴급|중요|high|medium|low)/gi, '')
    .trim() || rawText.trim()
}

function reflectedTabs(result: ParsedResult | null) {
  if (!result) return ['메모']
  const tabs = ['메모']
  if (result.events?.length) tabs.push('캘린더')
  if (result.todos?.length) tabs.push('할 일')
  if (result.clients?.length) tabs.push('거래처')
  if (result.projects?.length) tabs.push('프로젝트')
  if (result.contacts?.length) tabs.push('N-CRM')
  return tabs
}

function buildNameMap<T extends { name: string }>(rows: T[]) {
  return new Map(rows.map(row => [normalizeMemoName(row.name), row]))
}

async function writeActivityLog(input: {
  userId: string
  action: string
  entityType: string
  entityId: string | null
  entityName: string
  detail?: Record<string, string | null>
}) {
  const { error } = await supabase.from('activity_logs').insert({
    user_id: input.userId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    entity_name: input.entityName,
    detail: input.detail ?? null,
  })
  if (error) console.error('활동 로그 저장 오류:', error)
}

async function ensureMilestone(projectId: string, title: string, dueDate: string | null, cache: Map<string, MilestoneRow[]>) {
  const cleanTitle = title.trim()
  if (!cleanTitle) return

  let rows = cache.get(projectId)
  if (!rows) {
    const { data, error } = await supabase
      .from('milestones')
      .select('id, title, due_date')
      .eq('project_id', projectId)
    if (error) throw error
    rows = (data ?? []) as MilestoneRow[]
    cache.set(projectId, rows)
  }

  const exists = rows.some(row => normalizeMemoName(row.title) === normalizeMemoName(cleanTitle) && (row.due_date ?? null) === (dueDate ?? null))
  if (exists) return

  const { data, error } = await supabase
    .from('milestones')
    .insert({ project_id: projectId, title: cleanTitle, due_date: dueDate, completed: false })
    .select('id, title, due_date')
    .single()
  if (error) throw error
  rows.push(data as MilestoneRow)
}

// milestones 배열이 있으면 배열 전체를, 없으면 단일 milestone으로 fallback
async function ensureMilestones(
  projectId: string,
  project: { milestone: string | null; milestones?: Array<{ title: string; due_date: string | null }> | null },
  fallbackTitle: string,
  fallbackDate: string | null,
  cache: Map<string, MilestoneRow[]>,
) {
  const arr = project.milestones?.filter(m => m.title.trim()) ?? []
  if (arr.length > 0) {
    for (const m of arr) {
      await ensureMilestone(projectId, m.title, m.due_date, cache)
    }
  } else {
    await ensureMilestone(projectId, project.milestone || fallbackTitle, fallbackDate, cache)
  }
}

export default function MemoPage() {
  const queryClient = useQueryClient()
  const [state, setState] = useState<State>('idle')
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [rawText, setRawText] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [logs, setLogs] = useState<MemoLog[]>([])

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from('memos')
      .select('id, raw_text, parsed_result, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
    if (!error) setLogs((data ?? []) as MemoLog[])
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const handleParsed = (result: ParsedResult) => {
    setParsed(result)
    setRawText(result.raw_memo)
    setSaveError(null)
    setState('parsed')
  }

  const handleApprove = async () => {
    if (!parsed) return
    setState('saving')
    setSaveError(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('로그인이 필요합니다.')

      const shortcuts = parseMemoShortcuts(rawText)
      const memoTitle = cleanMemoTitle(rawText)
      const primaryDueDate = shortcuts.dates[0]
        ?? parsed.events?.find(event => event.date)?.date
        ?? parsed.todos?.find(todo => todo.due_date)?.due_date
        ?? null

      const { error: memoError } = await supabase.from('memos').insert({
        user_id: user.id,
        raw_text: rawText,
        parsed_result: parsed,
        status: 'approved',
      })
      if (memoError) throw memoError

      const { data: existingClients = [], error: clientReadError } = await supabase
        .from('clients')
        .select('id, name, memo, needs_review, source')
        .eq('user_id', user.id)
      if (clientReadError) throw clientReadError

      const clientByName = buildNameMap((existingClients ?? []) as ClientRow[])
      const explicitClientNames = Array.from(new Set(shortcuts.clients.map(name => name.trim()).filter(Boolean)))
      const referencedClientNames = Array.from(new Set([
        ...explicitClientNames,
        ...(parsed.events ?? []).map(event => event.client_name).filter((name): name is string => Boolean(name)),
        ...(parsed.projects ?? []).map(project => project.client_name).filter((name): name is string => Boolean(name)),
      ].map(name => name.trim()).filter(Boolean)))

      for (const name of explicitClientNames) {
        const key = normalizeMemoName(name)
        if (clientByName.has(key)) continue
        const { data, error } = await supabase
          .from('clients')
          .insert({ user_id: user.id, name, code: null, memo: appendMemo(null, rawText), needs_review: true, source: 'memo' })
          .select('id, name, memo, needs_review, source')
          .single()
        if (error) throw error
        if (data) clientByName.set(normalizeMemoName(data.name), data as ClientRow)
      }

      for (const name of referencedClientNames) {
        const existing = clientByName.get(normalizeMemoName(name))
        if (!existing) continue
        const nextMemo = appendMemo(existing.memo, rawText)
        const { error } = await supabase.from('clients').update({ memo: nextMemo }).eq('id', existing.id)
        if (error) throw error
        existing.memo = nextMemo
        await writeActivityLog({
          userId: user.id,
          action: 'memo_linked',
          entityType: 'client',
          entityId: existing.id,
          entityName: existing.name,
          detail: { memo: memoTitle },
        })
      }

      const { data: existingProjects = [], error: projectReadError } = await supabase
        .from('projects')
        .select('id, name, memo, client_id')
        .eq('user_id', user.id)
      if (projectReadError) throw projectReadError

      const projectByName = buildNameMap((existingProjects ?? []) as ProjectRow[])
      const hintedClient = explicitClientNames[0] ? clientByName.get(normalizeMemoName(explicitClientNames[0])) : null

      // 중복 방지: shortcut + Claude 파싱 결과를 name 기준으로 병합
      const projectInputMap = new Map<string, { name: string; client_name: string | null; milestone: string | null; milestones?: Array<{ title: string; due_date: string | null }> | null }>()
      for (const name of shortcuts.projects) {
        projectInputMap.set(normalizeMemoName(name), { name, client_name: explicitClientNames[0] ?? null, milestone: memoTitle, milestones: null })
      }
      const parsedExistingProjects = (parsed.projects ?? []).filter(p => projectByName.has(normalizeMemoName(p.name)))
      for (const p of parsedExistingProjects) {
        const key = normalizeMemoName(p.name)
        const existing = projectInputMap.get(key)
        if (existing) {
          projectInputMap.set(key, { ...existing, milestones: p.milestones ?? null, milestone: p.milestone ?? existing.milestone })
        } else {
          projectInputMap.set(key, { name: p.name, client_name: p.client_name, milestone: p.milestone ?? memoTitle, milestones: p.milestones ?? null })
        }
      }
      const projectInputs = Array.from(projectInputMap.values())
      const touchedProjectIds = new Set<string>()
      const milestoneCache = new Map<string, MilestoneRow[]>()

      for (const project of projectInputs) {
        const name = project.name.trim()
        if (!name) continue
        const key = normalizeMemoName(name)
        const existing = projectByName.get(key)
        const projectClient = project.client_name ? clientByName.get(normalizeMemoName(project.client_name)) ?? hintedClient : hintedClient

        if (existing) {
          const nextMemo = appendMemo(existing.memo, rawText)
          const { error } = await supabase.from('projects').update({ memo: nextMemo }).eq('id', existing.id)
          if (error) throw error
          existing.memo = nextMemo
          touchedProjectIds.add(existing.id)
          await ensureMilestones(existing.id, project, memoTitle, primaryDueDate, milestoneCache)
          continue
        }

        if (!shortcuts.projects.some(shortcut => normalizeMemoName(shortcut) === key)) continue

        const { data, error } = await supabase
          .from('projects')
          .insert({
            user_id: user.id,
            name,
            client_id: projectClient?.id ?? null,
            type: null,
            type_detail: null,
            start_date: primaryDueDate,
            end_date: null,
            status: 'in_progress',
            manager_id: null,
            memo: appendMemo(null, rawText),
            needs_review: true,
            source: 'memo',
          })
          .select('id, name, memo, client_id')
          .single()
        if (error) throw error
        if (data) {
          const row = data as ProjectRow
          projectByName.set(normalizeMemoName(row.name), row)
          touchedProjectIds.add(row.id)
          await ensureMilestones(row.id, project, memoTitle, primaryDueDate, milestoneCache)
        }
      }

      const primaryProjectName = shortcuts.projects[0] ?? parsedExistingProjects[0]?.name ?? null
      const primaryProject = primaryProjectName ? projectByName.get(normalizeMemoName(primaryProjectName)) : null
      const primaryProjectId = primaryProject?.id ?? null
      const primaryClientId = hintedClient?.id ?? primaryProject?.client_id ?? null

      // 날짜 fallback 체인: shortcuts.dates → parsed milestones → primaryDueDate
      const bestDate = shortcuts.dates[0]
        ?? parsed.projects?.flatMap(p => p.milestones ?? []).find(m => m.due_date)?.due_date
        ?? primaryDueDate

      const eventInputs: Array<{ title: string; date: string | null; time: string | null; location: string | null; client_name: string | null }> =
        parsed.events?.length
          ? parsed.events.map(e => ({ ...e, date: e.date ?? bestDate, time: e.time ?? shortcuts.times[0] ?? null }))
          : (bestDate || shortcuts.times.length)
            ? [{ title: memoTitle, date: bestDate, time: shortcuts.times[0] ?? null, location: null, client_name: explicitClientNames[0] ?? null }]
            : []

      for (const event of eventInputs) {
        if (!event.date) continue
        const eventClient = event.client_name ? clientByName.get(normalizeMemoName(event.client_name)) : null
        const { error } = await supabase.from('calendar_events').insert({
          user_id: user.id,
          title: event.title || memoTitle,
          date: event.date,
          time: event.time ?? null,
          location: event.location ?? null,
          client_id: eventClient?.id ?? primaryClientId,
          project_id: primaryProjectId,
        })
        if (error) throw error
      }

      for (const todo of parsed.todos ?? []) {
        const { error } = await supabase.from('todos').insert({
          user_id: user.id,
          title: todo.title,
          due_date: todo.due_date ?? shortcuts.dates[0] ?? null,
          priority: (todo.priority as 'high' | 'medium' | 'low') ?? shortcuts.priorities[0] ?? 'medium',
          client_id: primaryClientId,
          project_id: primaryProjectId,
        })
        if (error) throw error
      }

      const { data: existingContacts = [], error: contactReadError } = await supabase
        .from('contacts')
        .select('id, name, note')
        .eq('user_id', user.id)
      if (contactReadError) throw contactReadError

      const contactByName = buildNameMap((existingContacts ?? []) as Array<{ id: string; name: string; note: string | null }>)
      for (const contact of parsed.contacts ?? []) {
        const key = normalizeMemoName(contact.name)
        const existing = contactByName.get(key)
        if (existing) {
          const nextNote = appendMemo(existing.note, rawText)
          const { error } = await supabase.from('contacts').update({ note: nextNote, client_id: primaryClientId, project_id: primaryProjectId }).eq('id', existing.id)
          if (error) throw error
          existing.note = nextNote
          continue
        }
        const { data, error } = await supabase.from('contacts').insert({
          user_id: user.id,
          name: contact.name,
          company: contact.company ?? null,
          title: contact.title ?? null,
          client_id: primaryClientId,
          project_id: primaryProjectId,
          note: appendMemo(null, rawText),
          tags: ['메모'],
          needs_review: true,
          source: 'memo',
        }).select('id, name, note').single()
        if (error) throw error
        if (data) contactByName.set(normalizeMemoName(data.name), data)
      }

      await Promise.all([
        loadLogs(),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['milestones'] }),
        queryClient.invalidateQueries({ queryKey: ['activity_logs'] }),
        queryClient.invalidateQueries({ queryKey: ['review_badges'] }),
      ])

      setState('saved')
      setParsed(null)
    } catch (error) {
      console.error(error)
      setSaveError(error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.')
      setState('parsed')
    }
  }

  const handleReject = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('memos').insert({ user_id: user.id, raw_text: rawText, parsed_result: parsed, status: 'rejected' })
    await loadLogs()
    setState('rejected')
    setParsed(null)
  }

  const handleReset = () => {
    setState('idle')
    setParsed(null)
    setRawText('')
    setSaveError(null)
  }

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">메모 입력</h2>
      <p className="text-sm text-gray-500 mb-6">Enter로 실행하고, 승인하면 연결된 거래처/프로젝트/일정/할 일에 반영합니다.</p>

      {(state === 'idle' || state === 'loading') && (
        <div className="space-y-4">
          <MemoInput onParsed={handleParsed} onLoading={(loading) => setState(current => loading ? 'loading' : current === 'loading' ? 'idle' : current)} />
          {state === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-4 py-3 rounded-lg">
              <span className="animate-spin">●</span>
              <span>AI가 메모를 분석 중입니다...</span>
            </div>
          )}
        </div>
      )}

      {(state === 'parsed' || state === 'saving') && parsed && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 border border-gray-200">
            <span className="font-medium text-gray-700">원본:</span> {rawText}
          </div>
          {saveError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">저장 실패: {saveError}</div>}
          {state === 'saving' && <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 text-sm text-indigo-700">저장 중입니다...</div>}
          <ParseResultCard result={parsed} onApprove={handleApprove} onReject={handleReject} />
        </div>
      )}

      {state === 'saved' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="text-green-700 font-medium mb-1">저장 완료</p>
          <p className="text-sm text-green-600 mb-4">연결된 거래처 로그, 프로젝트 메모/타임라인, 캘린더와 할 일에 반영했습니다.</p>
          <button onClick={handleReset} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">새 메모 입력</button>
        </div>
      )}

      {state === 'rejected' && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-gray-600 mb-4">원본 메모만 보관했습니다.</p>
          <button onClick={handleReset} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg">새 메모 입력</button>
        </div>
      )}

      <div className="mt-8 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">메모 로그</h3>
          <button onClick={loadLogs} className="text-xs text-indigo-600 hover:underline">새로고침</button>
        </div>
        {logs.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">아직 기록된 메모가 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map(log => (
              <div key={log.id} className="p-4">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString('ko-KR', { hour12: false })}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${log.status === 'approved' ? 'bg-green-50 text-green-600' : log.status === 'rejected' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-600'}`}>
                    {log.status === 'approved' ? '승인' : log.status === 'rejected' ? '거절' : '대기'}
                  </span>
                </div>
                <p className="text-sm text-gray-800 line-clamp-2">{log.raw_text}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {reflectedTabs(log.parsed_result).map(tab => <span key={tab} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{tab}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
