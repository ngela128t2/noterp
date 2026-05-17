import { useMemo } from 'react'
import type { CalendarEvent, Milestone, Todo } from '../types'
import { useClientCalendarEvents, useProjectCalendarEvents } from './useCalendarEvents'
import { useClientLogs, useProjectLogs, type ActivityLog } from './useLogs'
import { useClientProjects, useMilestones } from './useProjects'
import { useClientTodos, useProjectTodos } from './useTodos'

// 업무 이벤트 중심 통합 모델
export type WorkItem = {
  id: string
  title: string
  date: string | null
  time: string | null
  location: string | null
  completed: boolean
  completedAt: string | null
  source: 'event' | 'milestone' | 'todo'
  priority?: 'high' | 'medium' | 'low'
  projectId: string | null
  memoId: string | null  // 원본 메모 추적
  rawEvent?: CalendarEvent
  rawMilestone?: Milestone
  rawTodo?: Todo
}

export type TimelineItem =
  | { kind: 'work'; sortKey: string; item: WorkItem }
  | { kind: 'log'; sortKey: string; data: ActivityLog }

// 이벤트 + 마일스톤 + 투두를 업무 이벤트로 통합, 동명+동일날짜 중복 제거
function buildWorkItems(
  events: CalendarEvent[],
  milestones: Milestone[],
  todos: Todo[],
): WorkItem[] {
  const items: WorkItem[] = []
  const usedMilestoneIds = new Set<string>()

  for (const event of events) {
    // 같은 제목 + 같은 날짜의 마일스톤과 병합 (중복 제거)
    const match = milestones.find(
      m =>
        !usedMilestoneIds.has(m.id) &&
        m.title.trim().toLowerCase() === event.title.trim().toLowerCase() &&
        m.due_date === event.date,
    )
    if (match) {
      usedMilestoneIds.add(match.id)
      items.push({
        id: `event-${event.id}`,
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        // 마일스톤 완료 OR 이벤트 완료 중 하나라도 true면 완료
        completed: event.completed || match.completed,
        completedAt: event.completed_at,
        source: 'event',
        projectId: event.project_id,
        memoId: event.memo_id ?? match.memo_id ?? null,
        rawEvent: event,
        rawMilestone: match,
      })
    } else {
      items.push({
        id: `event-${event.id}`,
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        completed: event.completed,
        completedAt: event.completed_at,
        source: 'event',
        projectId: event.project_id,
        memoId: event.memo_id ?? null,
        rawEvent: event,
      })
    }
  }

  // Layer 4: 마일스톤과 이벤트가 같은 내용이면 마일스톤 제거
  // 대괄호·대시·특수문자 제거 후 양방향 포함 체크 (날짜 14일 이내)
  const normT = (s: string) =>
    s.trim().toLowerCase()
      .replace(/[\[\]()（）【】「」\-–—·]/g, ' ')
      .replace(/\s+/g, ' ').trim()

  const eventItems = items.filter(i => i.source === 'event')
  for (const m of milestones) {
    if (usedMilestoneIds.has(m.id)) continue
    const mNorm = normT(m.title)
    const isDupOfEvent = eventItems.some(ev => {
      const evNorm = normT(ev.title)
      if (mNorm.length < 4 || evNorm.length < 4) return false
      // 양방향: 마일스톤이 이벤트 포함하거나, 이벤트가 마일스톤 포함
      if (!mNorm.includes(evNorm) && !evNorm.includes(mNorm)) return false
      // 날짜 14일 이내
      const d1 = m.due_date ? new Date(m.due_date).getTime() : null
      const d2 = ev.date ? new Date(ev.date).getTime() : null
      if (d1 === null || d2 === null) return true
      return Math.abs(d1 - d2) <= 14 * 24 * 60 * 60 * 1000
    })
    if (isDupOfEvent) usedMilestoneIds.add(m.id)
  }

  // 이벤트와 병합되지 않은 나머지 마일스톤 — 같은 날짜에 제목이 포함 관계인 것끼리도 중복 제거
  const remainingMilestones = milestones.filter(m => !usedMilestoneIds.has(m.id))
  const milestoneDupIds = new Set<string>()
  for (let i = 0; i < remainingMilestones.length; i++) {
    if (milestoneDupIds.has(remainingMilestones[i].id)) continue
    for (let j = i + 1; j < remainingMilestones.length; j++) {
      if (milestoneDupIds.has(remainingMilestones[j].id)) continue
      const a = remainingMilestones[i]
      const b = remainingMilestones[j]
      if (a.due_date !== b.due_date) continue
      const at = a.title.trim().toLowerCase()
      const bt = b.title.trim().toLowerCase()
      if (at.includes(bt) || bt.includes(at)) {
        // 더 긴 쪽(날짜/시간이 붙은 쪽)을 중복으로 표시, 짧고 깔끔한 쪽 유지
        milestoneDupIds.add(at.length > bt.length ? a.id : b.id)
      }
    }
  }
  for (const m of remainingMilestones) {
    if (milestoneDupIds.has(m.id)) continue
    items.push({
      id: `milestone-${m.id}`,
      title: m.title,
      date: m.due_date,
      time: m.time,
      location: null,
      completed: m.completed,
      completedAt: null,
      source: 'milestone',
      projectId: m.project_id,
      memoId: m.memo_id ?? null,
      rawMilestone: m,
    })
  }

  // 투두 — 같은 날짜에 제목이 포함 관계인 마일스톤·이벤트가 있으면 중복으로 제거
  const existingTitlesWithDate = items.map(i => ({
    title: i.title.trim().toLowerCase(),
    date: i.date,
  }))

  for (const t of todos) {
    const tTitle = t.title.trim().toLowerCase()
    const isDup = existingTitlesWithDate.some(
      e => e.date === t.due_date && (e.title.includes(tTitle) || tTitle.includes(e.title))
    )
    if (isDup) continue
    items.push({
      id: `todo-${t.id}`,
      title: t.title,
      date: t.due_date,
      time: null,
      location: null,
      completed: t.completed,
      completedAt: null,
      source: 'todo',
      priority: t.priority,
      projectId: t.project_id ?? null,
      memoId: t.memo_id ?? null,
      rawTodo: t,
    })
  }

  return items
}

function workSortKey(item: WorkItem): string {
  return item.date ? `${item.date}T${item.time ?? '00:00'}` : '0000-00-00T00:00'
}

function sortDesc(items: TimelineItem[]): TimelineItem[] {
  return [...items].sort((a, b) => b.sortKey.localeCompare(a.sortKey))
}

export function useClientTimeline(clientId: string) {
  const { data: logs = [] } = useClientLogs(clientId)
  const { data: events = [] } = useClientCalendarEvents(clientId)
  const { data: todos = [] } = useClientTodos(clientId)
  const { data: clientProjects = [] } = useClientProjects(clientId)

  return useMemo<TimelineItem[]>(() => {
    // useClientProjects의 inline milestones에 project_id를 수동으로 설정
    const allMilestones: Milestone[] = clientProjects.flatMap(p =>
      (p.milestones ?? []).map(m => ({ ...m, project_id: p.id, memo_id: (m as Milestone).memo_id ?? null })),
    )
    const workItems = buildWorkItems(events as CalendarEvent[], allMilestones, todos as Todo[])

    return sortDesc([
      ...logs.map((d: ActivityLog) => ({ kind: 'log' as const, sortKey: d.created_at, data: d })),
      ...workItems.map(item => ({
        kind: 'work' as const,
        sortKey: workSortKey(item),
        item,
      })),
    ])
  }, [logs, events, todos, clientProjects])
}

export function useProjectTimeline(projectId: string) {
  const { data: logs = [] } = useProjectLogs(projectId)
  const { data: events = [] } = useProjectCalendarEvents(projectId)
  const { data: todos = [] } = useProjectTodos(projectId)
  const { data: milestones = [] } = useMilestones(projectId)

  return useMemo<TimelineItem[]>(() => {
    const workItems = buildWorkItems(events as CalendarEvent[], milestones, todos as Todo[])

    return sortDesc([
      ...logs.map(d => ({ kind: 'log' as const, sortKey: d.created_at, data: d })),
      ...workItems.map(item => ({
        kind: 'work' as const,
        sortKey: workSortKey(item),
        item,
      })),
    ])
  }, [logs, events, todos, milestones])
}
