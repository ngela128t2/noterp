import { supabase } from './supabase'
import { safeParseMemoResult } from './schemas'
import type { ParsedResult } from '../types'
import { formatShortcutHints, hasMemoShortcuts, type MemoShortcutHints } from './memoShortcuts'
import { getLocalDate } from './dateUtils'

// Edge Function 오류에서 실제 메시지를 추출
// Supabase FunctionsHttpError는 error.message = generic string이고
// 실제 원인은 error.context (Response) body에 있음
async function extractEdgeError(error: unknown): Promise<string> {
  try {
    // Supabase FunctionsHttpError 구조: error.context = Response
    const ctx = (error as any)?.context
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json()
      if (body?.error) return `[Edge Function] ${body.error}${body.step ? ` (step: ${body.step})` : ''}`
      if (body?.message) return `[Edge Function] ${body.message}`
    }
    if (ctx && typeof ctx.text === 'function') {
      const text = await ctx.text()
      if (text) return `[Edge Function] ${text.slice(0, 200)}`
    }
  } catch { /* ignore */ }
  return (error as Error)?.message ?? 'Edge Function 오류'
}

export async function generateWorkspaceSummaryEdge(
  contextName: string,
  contextType: string,
  items: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('workspace-summary', {
    body: { contextName, contextType, items },
  })
  if (error) throw new Error(await extractEdgeError(error))
  return data.text ?? ''
}

export async function parseMemoEdge(
  text: string,
  shortcuts?: MemoShortcutHints,
  context?: { existingClients?: string[]; existingProjects?: string[] },
): Promise<ParsedResult> {
  const today = getLocalDate()
  const shortcutText = shortcuts && hasMemoShortcuts(shortcuts)
    ? `\n\n빠른 입력 힌트:\n${formatShortcutHints(shortcuts)}\n\n위 힌트를 우선 적용해서 거래처명, 프로젝트명, 일정일자, 일정시간, 할 일 마감일을 해석하세요.`
    : ''

  const { data, error } = await supabase.functions.invoke('parse-memo', {
    body: {
      text,
      today,
      shortcutText,
      existingClients: (context?.existingClients ?? []).slice(0, 50),
      existingProjects: (context?.existingProjects ?? []).slice(0, 50),
    },
  })

  if (error) throw new Error(await extractEdgeError(error))
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

  if (error) throw new Error(await extractEdgeError(error))
  return data.text ?? ''
}
