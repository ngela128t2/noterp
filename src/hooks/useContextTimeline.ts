import { useMemo } from 'react'
import type { CalendarEvent, Milestone, Todo } from '../types'
import { useClientCalendarEvents, useProjectCalendarEvents } from './useCalendarEvents'
import { useClientLogs, useProjectLogs, type ActivityLog } from './useLogs'
import { useClientProjects, useMilestones } from './useProjects'
import { useClientTodos, useProjectTodos } from './useTodos'

export type TimelineItem =
  | { kind: 'log'; sortKey: string; data: ActivityLog }
  | { kind: 'event'; sortKey: string; data: CalendarEvent & { clients?: { name: string } | null } }
  | { kind: 'milestone'; sortKey: string; data: Milestone }
  | { kind: 'todo'; sortKey: string; data: Todo & { clients?: { name: string } | null } }

function sortDesc(items: TimelineItem[]): TimelineItem[] {
  return items.sort((a, b) => b.sortKey.localeCompare(a.sortKey))
}

export function useClientTimeline(clientId: string) {
  const { data: logs = [] } = useClientLogs(clientId)
  const { data: events = [] } = useClientCalendarEvents(clientId)
  const { data: todos = [] } = useClientTodos(clientId)
  const { data: clientProjects = [] } = useClientProjects(clientId)

  return useMemo<TimelineItem[]>(() => {
    const milestones: TimelineItem[] = clientProjects.flatMap(p =>
      (p.milestones ?? [])
        .filter(m => m.due_date)
        .map(m => ({
          kind: 'milestone' as const,
          sortKey: `${m.due_date}T${m.time ?? '00:00'}`,
          data: { ...m, project_id: p.id } as Milestone,
        }))
    )
    return sortDesc([
      ...logs.map((d: ActivityLog) => ({ kind: 'log' as const, sortKey: d.created_at, data: d })),
      ...events.map((d: CalendarEvent) => ({ kind: 'event' as const, sortKey: `${d.date}T${d.time ?? '00:00'}`, data: d })),
      ...todos.map((d: Todo) => ({ kind: 'todo' as const, sortKey: d.created_at, data: d })),
      ...milestones,
    ])
  }, [logs, events, todos, clientProjects])
}

export function useProjectTimeline(projectId: string) {
  const { data: logs = [] } = useProjectLogs(projectId)
  const { data: events = [] } = useProjectCalendarEvents(projectId)
  const { data: todos = [] } = useProjectTodos(projectId)
  const { data: milestones = [] } = useMilestones(projectId)

  return useMemo<TimelineItem[]>(() => sortDesc([
    ...logs.map(d => ({ kind: 'log' as const, sortKey: d.created_at, data: d })),
    ...events.map(d => ({ kind: 'event' as const, sortKey: `${d.date}T${d.time ?? '00:00'}`, data: d })),
    ...todos.map(d => ({ kind: 'todo' as const, sortKey: d.created_at, data: d })),
    ...milestones.map(d => ({
      kind: 'milestone' as const,
      sortKey: d.due_date ? `${d.due_date}T00:00` : d.created_at,
      data: d,
    })),
  ]), [logs, events, todos, milestones])
}
