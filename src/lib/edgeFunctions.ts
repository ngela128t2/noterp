import { supabase } from './supabase'
import { safeParseMemoResult } from './schemas'
import type { ParsedResult } from '../types'
import { formatShortcutHints, hasMemoShortcuts, type MemoShortcutHints } from './memoShortcuts'

export async function generateWorkspaceSummaryEdge(
  contextName: string,
  contextType: string,
  items: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('workspace-summary', {
    body: { contextName, contextType, items },
  })
  if (error) throw new Error(`Edge Function 오류: ${error.message}`)
  return data.text ?? ''
}

export async function parseMemoEdge(text: string, shortcuts?: MemoShortcutHints): Promise<ParsedResult> {
  const today = new Date().toISOString().split('T')[0]
  const shortcutText = shortcuts && hasMemoShortcuts(shortcuts)
    ? `\n\n빠른 입력 힌트:\n${formatShortcutHints(shortcuts)}\n\n위 힌트를 우선 적용해서 거래처명, 프로젝트명, 일정일자, 일정시간, 할 일 마감일을 해석하세요.`
    : ''

  const { data, error } = await supabase.functions.invoke('parse-memo', {
    body: { text, today, shortcutText },
  })

  if (error) throw new Error(`Edge Function 오류: ${error.message}`)
  return safeParseMemoResult(data) as ParsedResult
}

export async function generateBriefingEdge(context: {
  date: string
  todayEvents: Array<{ title: string; time: string | null; clientName: string | null }>
  weekEventCount: number
  overdueCount: number
  pendingCount: number
  deadlineCount: number
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-briefing', {
    body: context,
  })

  if (error) throw new Error(`Edge Function 오류: ${error.message}`)
  return data.text ?? ''
}
