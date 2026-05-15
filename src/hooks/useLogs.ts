import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface ActivityLog {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  detail: Record<string, string> | null
  created_at: string
}

const ACTION_LABEL: Record<string, string> = {
  created: '등록',
  updated: '수정',
  deleted: '삭제',
  approved: '메모 승인',
  rejected: '메모 거절',
  pending: '메모 대기',
  memo_linked: '메모 연결',
}

const ENTITY_LABEL: Record<string, string> = {
  client: '거래처',
  project: '프로젝트',
  memo: '메모',
  todo: '할 일',
  calendar_event: '일정',
  contact: '연락처',
}

export function formatLog(log: ActivityLog): string {
  const action = ACTION_LABEL[log.action] ?? log.action
  const entity = ENTITY_LABEL[log.entity_type] ?? log.entity_type
  const name = log.entity_name ? `"${log.entity_name}"` : ''

  if (log.action === 'memo_linked') {
    const memo = log.detail?.memo ? `: ${log.detail.memo}` : ''
    return `${entity} ${name}에 메모 연결${memo}`
  }

  if (log.detail?.status_from && log.detail?.status_to) {
    const STATUS: Record<string, string> = {
      preparing: '준비',
      in_progress: '진행 중',
      review: '검토',
      completed: '완료',
    }
    return `${entity} ${name} 상태 변경: ${STATUS[log.detail.status_from] ?? log.detail.status_from} → ${STATUS[log.detail.status_to] ?? log.detail.status_to}`
  }

  return `${entity} ${name} ${action}`
}

export function useRecentLogs(limit = 20) {
  return useQuery({
    queryKey: ['activity_logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as ActivityLog[]
    },
  })
}

export function useProjectLogs(projectId: string) {
  return useQuery({
    queryKey: ['activity_logs', 'project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('entity_type', 'project')
        .eq('entity_id', projectId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ActivityLog[]
    },
    enabled: !!projectId,
  })
}

export function useClientLogs(clientId: string) {
  return useQuery({
    queryKey: ['activity_logs', 'client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('entity_type', 'client')
        .eq('entity_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ActivityLog[]
    },
  })
}
