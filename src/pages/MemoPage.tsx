import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useWorkspaceStore } from '../store/workspaceStore'
import MemoInput from '../components/memo/MemoInput'
import ParseResultCard, { type ContextClient, type ContextProject } from '../components/memo/ParseResultCard'
import { normalizeMemoName, normalizeTimeToken, parseMemoShortcuts } from '../lib/memoShortcuts'
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
  if (!rawText) return ''
  return rawText
    .replace(/\/\[[^\]]+\]/g, '')
    .replace(/#\[[^\]]+\]/g, '')
    .replace(/\/[^\s/@#!*]+/g, '')
    .replace(/#[^\s/@#!*]+/g, '')
    .replace(/@\[[^\]]+\]/g, '')
    .replace(/@[^\s]+/g, '')
    .replace(/[!！](높음|보통|낮음|긴급|중요|high|medium|low)/gi, '')
    .replace(/^\*[ \t]+/gm, '')
    .trim() || rawText.trim()
}

// 날짜·시간·요일만으로 된 제목인지 검사 (프로젝트·마일스톤 제목 차단)
const DATE_TIME_ONLY_RE = /^[\d\s\/\.\-~·년월일요(월화수목금토일)전오후시분초:]+$/
function isDateOnlyTitle(title: string): boolean {
  const t = title.trim()
  if (!t || t.length <= 2) return true
  // 한글 단어가 하나도 없고 날짜/숫자/시간 문자만 있는 경우
  if (DATE_TIME_ONLY_RE.test(t)) return true
  // "17일", "5/17", "오전 9시" 패턴 — 날짜/시간 제거 후 의미있는 단어가 없는 경우
  const stripped = t
    .replace(/\d{1,4}[\/\-\.]\d{1,2}([\/\-\.]\d{1,4})?/g, '')
    .replace(/\d{1,2}월\s*\d{1,2}일?/g, '')
    .replace(/\d{1,2}일/g, '')
    .replace(/(오전|오후)?\s*\d{1,2}시\s*\d{0,2}분?/g, '')
    .replace(/(월|화|수|목|금|토|일)요일/g, '')
    .replace(/\s+/g, ' ').trim()
  return stripped.length <= 1
}

function parseScheduleItemTime(item: string): { title: string; time: string | null } {
  const timeMatch = item.match(/(오전|오후)\s*\d{1,2}시(?:\s*\d{1,2}분?)?|\d{1,2}시(?:\s*\d{1,2}분?)?|\d{1,2}:\d{2}/)
  if (!timeMatch) return { title: item.trim(), time: null }
  const time = normalizeTimeToken(timeMatch[0])
  const title = item.replace(timeMatch[0], '').trim() || item.trim()
  return { title, time }
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
  return new Map(rows.filter(row => row.name).map(row => [normalizeMemoName(row.name), row]))
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

async function ensureMilestone(projectId: string, title: string, dueDate: string | null, cache: Map<string, MilestoneRow[]>, memoId: string | null = null) {
  const cleanTitle = title.trim()
  if (!cleanTitle || isDateOnlyTitle(cleanTitle)) return  // 날짜형 제목 차단

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
    .insert({ project_id: projectId, title: cleanTitle, due_date: dueDate, completed: false, memo_id: memoId })
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
  memoId: string | null = null,
) {
  const arr = project.milestones?.filter(m => m.title.trim()) ?? []
  if (arr.length > 0) {
    for (const m of arr) {
      await ensureMilestone(projectId, m.title, m.due_date, cache, memoId)
    }
  } else {
    await ensureMilestone(projectId, project.milestone || fallbackTitle, fallbackDate, cache, memoId)
  }
}

type SavedContext = { type: 'client' | 'project'; id: string; name: string }

export default function MemoPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  useWorkspaceStore(s => s.lastContext) // 구독 유지 (lastContext 저장용)
  // 워크스페이스 "메모 추가" 버튼으로 명시적 진입한 경우만 거래처/프로젝트 pre-fill
  // FAB·사이드바·직접 진입 시에는 항상 빈 상태로 시작
  const routeState = location.state as { clientId?: string; projectId?: string } | null
  const [state, setState] = useState<State>('idle')
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [rawText, setRawText] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isAutoSave, setIsAutoSave] = useState(false)
  const [logs, setLogs] = useState<MemoLog[]>([])
  const [savedContext, setSavedContext] = useState<SavedContext | null>(null)
  // 거래처/프로젝트 매칭 컨텍스트 (ParseResultCard에 전달)
  const [contextClients, setContextClients] = useState<ContextClient[]>([])
  const [contextProjects, setContextProjects] = useState<ContextProject[]>([])

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from('memos')
      .select('id, raw_text, parsed_result, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
    if (!error) setLogs((data ?? []) as MemoLog[])
  }

  // 거래처/프로젝트 컨텍스트 로드 (매칭 표시용)
  const loadContext = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: clients }, { data: projects }] = await Promise.all([
      supabase.from('clients').select('id, name, service_category').eq('user_id', user.id),
      supabase.from('projects').select('id, name, client_id').eq('user_id', user.id),
    ])
    setContextClients((clients ?? []) as ContextClient[])
    setContextProjects((projects ?? []) as ContextProject[])
  }

  useEffect(() => {
    loadLogs()
    loadContext()
  }, [])

  const handleParsed = async (result: ParsedResult) => {
    setParsed(result)
    setRawText(result.raw_memo ?? '')
    setSaveError(null)
    if ((result.confidence ?? 0) >= 0.9) {
      await handleApprove({ parsedOverride: result, rawTextOverride: result.raw_memo ?? '', auto: true })
    } else {
      setState('parsed')
    }
  }

  const handleApprove = async (opts?: { parsedOverride: ParsedResult; rawTextOverride: string; auto?: boolean }) => {
    const ep = opts?.parsedOverride ?? parsed
    const rt = opts?.rawTextOverride ?? rawText
    if (!ep) return
    if (opts?.auto) setIsAutoSave(true)
    else setIsAutoSave(false)
    setState('saving')
    setSaveError(null)

    let step = 'init'
    let memoId: string | null = null

    try {
      step = 'auth'
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('로그인이 필요합니다.')

      const shortcuts = parseMemoShortcuts(rt)
      const memoTitle = cleanMemoTitle(rt)
      const primaryDueDate = shortcuts.dates[0]
        ?? ep.events?.find(event => event.date)?.date
        ?? ep.todos?.find(todo => todo.due_date)?.due_date
        ?? null

      step = 'memos_insert'
      const { data: memoRow, error: memoError } = await supabase.from('memos').insert({
        user_id: user.id,
        raw_text: rt,
        parsed_result: ep,
        status: 'approved',
      }).select('id').single()
      if (memoError) throw memoError
      memoId = memoRow?.id ?? null

      step = 'clients_read'
      const { data: existingClients = [], error: clientReadError } = await supabase
        .from('clients')
        .select('id, name, memo, needs_review, source')
        .eq('user_id', user.id)
      if (clientReadError) throw clientReadError

      const clientByName = buildNameMap((existingClients ?? []) as ClientRow[])
      // normalized key 기준으로 중복 제거 (예: "#서울회생법원"과 "#[서울회생법원]" 동일 처리)
      const seenExplicit = new Set<string>()
      const explicitClientNames: string[] = []
      for (const name of shortcuts.clients.map(n => n.trim()).filter(Boolean)) {
        const key = normalizeMemoName(name)
        if (!seenExplicit.has(key)) { seenExplicit.add(key); explicitClientNames.push(name) }
      }
      const seenRef = new Set<string>()
      const referencedClientNames: string[] = []
      for (const raw of [
        ...explicitClientNames,
        ...(ep.events ?? []).map(e => e.client_name).filter((n): n is string => Boolean(n)),
        ...(ep.projects ?? []).map(p => p.client_name).filter((n): n is string => Boolean(n)),
      ]) {
        const name = raw.trim()
        if (!name) continue
        const key = normalizeMemoName(name)
        if (!seenRef.has(key)) { seenRef.add(key); referencedClientNames.push(name) }
      }

      // ① 명시적(#[name])으로 지정된 거래처 — 없으면 자동 생성
      for (const name of explicitClientNames) {
        const key = normalizeMemoName(name)
        if (clientByName.has(key)) continue
        const { data, error } = await supabase
          .from('clients')
          .insert({ user_id: user.id, name, code: null, memo: appendMemo(null, rt), needs_review: true, source: 'memo' })
          .select('id, name, memo, needs_review, source')
          .single()
        if (error) throw error
        if (data) clientByName.set(normalizeMemoName(data.name), data as ClientRow)
      }

      // ② AI가 식별한 신규 거래처도 자동 생성 (이전에는 SKIP되어 client_id 연결이 끊겼음)
      //    - ep.clients[].is_new === true 인 항목
      //    - events/projects.client_name 중 신규
      //    needs_review: true 로 마크하여 사용자가 워크스페이스에서 확인/병합 가능
      const newClientCandidates = new Set<string>()
      for (const c of (ep.clients ?? [])) {
        if (c.name?.trim() && c.is_new) newClientCandidates.add(c.name.trim())
      }
      for (const name of referencedClientNames) {
        if (!clientByName.has(normalizeMemoName(name))) newClientCandidates.add(name)
      }
      for (const name of newClientCandidates) {
        const key = normalizeMemoName(name)
        if (clientByName.has(key)) continue   // 위 ①에서 이미 생성된 경우 스킵
        if (isDateOnlyTitle(name)) continue   // 날짜형 이름은 거래처가 아님
        const { data, error } = await supabase
          .from('clients')
          .insert({ user_id: user.id, name, code: null, memo: appendMemo(null, rt), needs_review: true, source: 'memo_ai' })
          .select('id, name, memo, needs_review, source')
          .single()
        if (error) {
          console.warn('[clients_ai_insert] 실패:', error.message)
          continue   // 부분 실패해도 계속 (UNIQUE 위반 등)
        }
        if (data) clientByName.set(normalizeMemoName(data.name), data as ClientRow)
      }

      // ③ 모든 referencedClientNames에 대해 거래처 메모 append (이제 신규도 포함됨)
      for (const name of referencedClientNames) {
        const existing = clientByName.get(normalizeMemoName(name))
        if (!existing) continue
        const nextMemo = appendMemo(existing.memo, rt)
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

      step = 'projects_read'
      const { data: existingProjects = [], error: projectReadError } = await supabase
        .from('projects')
        .select('id, name, memo, client_id')
        .eq('user_id', user.id)
      if (projectReadError) throw projectReadError

      // 프로젝트 매칭: (name + client_id) 조합 키
      // 같은 이름 프로젝트가 여러 거래처에 있을 수 있으므로 client_id까지 고려해야 함
      // 예: "2026 종소세 신고" 가 어마마법인과 태성산업 양쪽에 따로 존재 가능
      const projectsByNameAndClient = new Map<string, ProjectRow>()
      const projectsByNameOnly = new Map<string, ProjectRow[]>()   // client 미지정 매칭용 fallback
      for (const p of (existingProjects ?? []) as ProjectRow[]) {
        const nameKey = normalizeMemoName(p.name)
        projectsByNameAndClient.set(`${nameKey}::${p.client_id ?? 'null'}`, p)
        const arr = projectsByNameOnly.get(nameKey) ?? []
        arr.push(p)
        projectsByNameOnly.set(nameKey, arr)
      }
      // 이름만으로 검색 (헬퍼)
      const findProjectByNameAndClient = (nameKey: string, clientId: string | null): ProjectRow | null => {
        // 1) 이름 + 정확한 client_id 매칭
        const exact = projectsByNameAndClient.get(`${nameKey}::${clientId ?? 'null'}`)
        if (exact) return exact
        // 2) client_id 후보가 없거나 null인 경우, 이름만 매칭되는 client_id=null 프로젝트
        if (clientId) {
          const orphan = projectsByNameAndClient.get(`${nameKey}::null`)
          if (orphan) return orphan
        }
        return null
      }
      const hintedClient = explicitClientNames[0] ? clientByName.get(normalizeMemoName(explicitClientNames[0])) : null

      // 중복 방지: shortcut + Claude 파싱 결과를 name 기준으로 병합
      const projectInputMap = new Map<string, { name: string; client_name: string | null; milestone: string | null; milestones?: Array<{ title: string; due_date: string | null }> | null }>()
      // 명시적 shortcut(/[name])으로 지정된 프로젝트
      for (const name of shortcuts.projects) {
        projectInputMap.set(normalizeMemoName(name), { name, client_name: explicitClientNames[0] ?? null, milestone: memoTitle, milestones: null })
      }
      // AI가 추출한 모든 프로젝트 (기존/신규 모두) — 신규는 자동 생성됨
      const allAiProjects = (ep.projects ?? []).filter(p => p.name?.trim() && !isDateOnlyTitle(p.name))
      for (const p of allAiProjects) {
        const key = normalizeMemoName(p.name)
        const existing = projectInputMap.get(key)
        if (existing) {
          projectInputMap.set(key, {
            ...existing,
            milestones: p.milestones ?? existing.milestones,
            milestone: p.milestone ?? existing.milestone,
          })
        } else {
          projectInputMap.set(key, {
            name: p.name,
            client_name: p.client_name,
            milestone: p.milestone ?? memoTitle,
            milestones: p.milestones ?? null,
          })
        }
      }
      const projectInputs = Array.from(projectInputMap.values())
      const touchedProjectIds = new Set<string>()
      const milestoneCache = new Map<string, MilestoneRow[]>()

      for (const project of projectInputs) {
        const name = project.name.trim()
        if (!name) continue
        const key = normalizeMemoName(name)
        const projectClient = project.client_name ? clientByName.get(normalizeMemoName(project.client_name)) ?? hintedClient : hintedClient
        // 매칭: 이름 + client_id 정확 매칭. 다른 거래처에 같은 이름 프로젝트가 있어도 충돌하지 않음.
        const existing = findProjectByNameAndClient(key, projectClient?.id ?? null)

        if (existing) {
          const nextMemo = appendMemo(existing.memo, rt)
          const { error } = await supabase.from('projects').update({ memo: nextMemo }).eq('id', existing.id)
          if (error) throw error
          existing.memo = nextMemo
          touchedProjectIds.add(existing.id)
          // AI가 명시한 마일스톤이 있을 때만 생성 (메모 텍스트를 마일스톤으로 만들지 않음)
          const hasExplicitMilestone =
            (project.milestones?.filter(m => m.title.trim()).length ?? 0) > 0 ||
            (project.milestone != null && project.milestone.trim().length > 0)
          if (hasExplicitMilestone) {
            await ensureMilestones(existing.id, project, memoTitle, primaryDueDate, milestoneCache, memoId)
          }
          continue
        }

        // 신규 프로젝트 — shortcut 또는 AI 식별 모두 자동 생성 (needs_review: true 로 마크)
        if (isDateOnlyTitle(name)) continue                 // 날짜형 이름 차단
        if (name.length < 3) continue                        // 너무 짧은 이름 차단

        const fromShortcut = shortcuts.projects.some(s => normalizeMemoName(s) === key)
        const source = fromShortcut ? 'memo' : 'memo_ai'

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
            memo: appendMemo(null, rt),
            needs_review: true,
            source,
            created_from_memo_id: memoId,
          })
          .select('id, name, memo, client_id')
          .single()
        if (error) {
          console.warn('[projects_insert] 실패:', error.message)
          continue
        }
        if (data) {
          const row = data as ProjectRow
          const nameKey = normalizeMemoName(row.name)
          projectsByNameAndClient.set(`${nameKey}::${row.client_id ?? 'null'}`, row)
          const arr = projectsByNameOnly.get(nameKey) ?? []
          arr.push(row)
          projectsByNameOnly.set(nameKey, arr)
          touchedProjectIds.add(row.id)
          await ensureMilestones(row.id, project, memoTitle, primaryDueDate, milestoneCache, memoId)
        }
      }

      // 거래처 fallback 체인 (먼저 결정 — primaryClient가 primaryProject 매칭에 사용됨):
      //   1) 명시(#[name])로 지정된 거래처
      //   2) AI가 events/projects/clients에서 식별한 첫 거래처
      //   3) primary project의 client_id (마지막 fallback — 다른 거래처의 같은 이름 프로젝트와 충돌 방지)
      const firstReferencedClient = referencedClientNames
        .map(n => clientByName.get(normalizeMemoName(n)))
        .find(c => !!c) ?? null

      // primary project: (이름 + primaryClient 조합)으로 정확히 매칭
      //   같은 이름이 다른 거래처에 있어도 의도한 거래처의 프로젝트만 매칭됨
      const primaryProjectName = shortcuts.projects[0] ?? allAiProjects[0]?.name ?? null
      const primaryClientCandidate = hintedClient ?? firstReferencedClient
      const primaryProject = primaryProjectName
        ? findProjectByNameAndClient(normalizeMemoName(primaryProjectName), primaryClientCandidate?.id ?? null)
        : null
      const primaryProjectId = primaryProject?.id ?? null

      const primaryClientId =
        hintedClient?.id
        ?? firstReferencedClient?.id
        ?? primaryProject?.client_id
        ?? null

      // 날짜 fallback 체인: shortcuts.dates → parsed milestones → primaryDueDate
      const bestDate = shortcuts.dates[0]
        ?? ep.projects?.flatMap(p => p.milestones ?? []).find(m => m.due_date)?.due_date
        ?? primaryDueDate

      const eventInputs: Array<{ title: string; date: string | null; time: string | null; location: string | null; client_name: string | null }> =
        shortcuts.scheduleItems.length > 0
          ? shortcuts.scheduleItems.map(item => {
              const { title, time } = parseScheduleItemTime(item)
              return { title: title || memoTitle, date: bestDate, time, location: null, client_name: explicitClientNames[0] ?? null }
            })
          : ep.events?.length
            ? ep.events.map(e => ({ ...e, date: e.date ?? bestDate, time: e.time ?? shortcuts.times[0] ?? null }))
            : (bestDate || shortcuts.times.length)
              ? [{ title: memoTitle, date: bestDate, time: shortcuts.times[0] ?? null, location: null, client_name: explicitClientNames[0] ?? null }]
              : []

      step = 'calendar_events_insert'
      // 같은 날짜+제목 이벤트 중복 방지를 위해 기존 이벤트 조회
      const { data: existingEvents = [] } = await supabase
        .from('calendar_events')
        .select('title, date')
        .eq('user_id', user.id)
      const existingEventKeys = new Set(
        (existingEvents ?? []).map((e: { title: string; date: string }) => `${normalizeMemoName(e.title)}|${e.date}`),
      )

      for (const event of eventInputs) {
        if (!event.date) continue
        const eventTitle = event.title || memoTitle
        const dupKey = `${normalizeMemoName(eventTitle)}|${event.date}`
        if (existingEventKeys.has(dupKey)) continue   // 중복 스킵
        existingEventKeys.add(dupKey)

        const eventClient = event.client_name ? clientByName.get(normalizeMemoName(event.client_name)) : null
        const { error } = await supabase.from('calendar_events').insert({
          user_id: user.id,
          title: eventTitle,
          date: event.date,
          time: event.time ?? null,
          location: event.location ?? null,
          client_id: eventClient?.id ?? primaryClientId,
          project_id: primaryProjectId,
          memo_id: memoId,
        })
        if (error) throw error
      }

      step = 'todos_insert'
      for (const todo of ep.todos ?? []) {
        const { error } = await supabase.from('todos').insert({
          user_id: user.id,
          title: todo.title,
          due_date: todo.due_date ?? shortcuts.dates[0] ?? null,
          priority: (todo.priority as 'high' | 'medium' | 'low') ?? shortcuts.priorities[0] ?? 'medium',
          client_id: primaryClientId,
          project_id: primaryProjectId,
          memo_id: memoId,
        })
        if (error) throw error
      }

      step = 'contacts_read'
      const { data: existingContacts = [], error: contactReadError } = await supabase
        .from('contacts')
        .select('id, name, note')
        .eq('user_id', user.id)
      if (contactReadError) throw contactReadError

      const contactByName = buildNameMap((existingContacts ?? []) as Array<{ id: string; name: string; note: string | null }>)

      // Claude 파싱 연락처 + @이름 멘션 병합
      type ContactInput = { name: string; company?: string | null; title?: string | null }
      const allContacts: ContactInput[] = [
        ...(ep.contacts ?? []).filter(c => c.name?.trim()),
        ...shortcuts.people.filter(name => !ep.contacts?.some(c => normalizeMemoName(c.name) === normalizeMemoName(name))).map(name => ({ name })),
      ]

      for (const contact of allContacts) {
        if (!contact.name?.trim()) continue
        const key = normalizeMemoName(contact.name)
        const existing = contactByName.get(key)
        if (existing) {
          const nextNote = appendMemo(existing.note, rt)
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
          note: appendMemo(null, rt),
          tags: ['메모'],
          needs_review: true,
          source: 'memo',
          memo_id: memoId,
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

      // 승인 후 워크스페이스 CTA: 이미 계산된 hintedClient / primaryProject 재사용
      const ctxClient = hintedClient
        ?? (referencedClientNames[0] ? clientByName.get(normalizeMemoName(referencedClientNames[0])) ?? null : null)
      if (ctxClient?.id) {
        setSavedContext({ type: 'client', id: ctxClient.id, name: ctxClient.name })
      } else if (primaryProject?.id) {
        setSavedContext({ type: 'project', id: primaryProject.id, name: primaryProject.name })
      } else {
        setSavedContext(null)
      }

      setState('saved')
      setParsed(null)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[handleApprove][${step}]`, error)
      setSaveError(`[${step}] ${msg}`)
      setState('parsed')
      // memos_insert 이후 단계 실패 시 메모를 rejected로 변경 (부분 저장 방지)
      if (memoId && step !== 'memos_insert') {
        await supabase.from('memos').update({ status: 'rejected' }).eq('id', memoId)
      }
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
    <div className="p-4 lg:p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">메모 입력</h2>
      <p className="text-sm text-gray-500 mb-4">Enter로 실행하고, 승인하면 연결된 거래처/프로젝트/일정/할 일에 반영합니다.</p>

      {/* 데스크톱: 좌측 입력 + 우측 로그 / 모바일: 세로 스택 */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* ── 왼쪽: 메모 입력 / 파싱 결과 ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {(state === 'idle' || state === 'loading') && (
            <>
              <MemoInput
                onParsed={handleParsed}
                onLoading={(loading) => setState(current => loading ? 'loading' : current === 'loading' ? 'idle' : current)}
                initialClientId={routeState?.clientId ?? ''}
                initialProjectId={routeState?.projectId ?? ''}
              />
              {state === 'loading' && (
                <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-4 py-3 rounded-lg">
                  <span className="animate-spin">●</span>
                  <span>AI가 메모를 분석 중입니다...</span>
                </div>
              )}
            </>
          )}

          {state === 'saving' && isAutoSave && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="animate-spin text-indigo-500">●</span>
                <p className="text-indigo-700 text-sm font-medium">자동 저장 중... (신뢰도 높음)</p>
              </div>
            </div>
          )}

          {(state === 'parsed' || (state === 'saving' && !isAutoSave)) && parsed && (
            <>
              {saveError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">저장 실패: {saveError}</div>}
              {state === 'saving' && <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 text-sm text-indigo-700">저장 중입니다...</div>}
              {parsed.memo_type && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400">메모 유형</span>
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">{parsed.memo_type}</span>
                  {parsed.confidence !== undefined && (
                    <span className="text-[10px] text-gray-400">신뢰도 {Math.round(parsed.confidence * 100)}%</span>
                  )}
                </div>
              )}
              <ParseResultCard
                result={parsed}
                rawText={rawText}
                onChange={setParsed}
                onApprove={handleApprove}
                onReject={handleReject}
                existingClients={contextClients}
                existingProjects={contextProjects}
              />
            </>
          )}

          {state === 'saved' && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-green-500">✓</span>
                  <p className="text-green-700 font-medium text-sm">
                    {isAutoSave ? '자동 저장 완료' : '저장 완료'}
                  </p>
                </div>
                <p className="text-xs text-green-600">거래처 로그, 프로젝트 메모, 캘린더, 할 일에 반영했습니다.</p>
              </div>
              {savedContext && (
                <button
                  onClick={() => navigate(`/workspace/${savedContext.type}/${savedContext.id}`)}
                  className="w-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl px-5 py-4 text-left flex items-center justify-between transition-colors group"
                >
                  <div>
                    <p className="text-[10px] text-indigo-400 mb-0.5">
                      {savedContext.type === 'client' ? '거래처' : '프로젝트'} 워크스페이스에서 계속하기
                    </p>
                    <p className="text-sm font-semibold text-indigo-700">{savedContext.name}</p>
                  </div>
                  <span className="text-indigo-400 group-hover:text-indigo-600 transition-colors text-lg">→</span>
                </button>
              )}
              <button
                onClick={handleReset}
                className="w-full px-4 py-2.5 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition-colors"
              >
                새 메모 입력
              </button>
            </div>
          )}

          {state === 'rejected' && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
              <p className="text-gray-600 mb-4">원본 메모만 보관했습니다.</p>
              <button onClick={handleReset} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg">새 메모 입력</button>
            </div>
          )}
        </div>

        {/* ── 오른쪽: 메모 로그 ── */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">메모 로그</h3>
              <button onClick={loadLogs} className="text-xs text-indigo-600 hover:underline">새로고침</button>
            </div>
            {logs.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">아직 기록된 메모가 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                {logs.map(log => (
                  <div key={log.id} className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] text-gray-400">{new Date(log.created_at).toLocaleString('ko-KR', { hour12: false })}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${log.status === 'approved' ? 'bg-green-50 text-green-600' : log.status === 'rejected' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-600'}`}>
                        {log.status === 'approved' ? '승인' : log.status === 'rejected' ? '거절' : '대기'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-2">{log.raw_text}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {reflectedTabs(log.parsed_result).map(tab => (
                        <span key={tab} className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{tab}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
