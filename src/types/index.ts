export interface User {
  id: string
  email: string
  created_at: string
}

export interface Client {
  id: string
  user_id: string
  code: string | null
  name: string
  entity_type: string | null       // 법인 / 개인
  client_type: string | null       // 매출처 / 매입처 / 공통
  business_number: string | null   // 사업자번호
  corp_number: string | null       // 법인번호
  fss_number: string | null        // 금감원 고유번호
  representative: string | null
  established_date: string | null
  industry: string | null
  audit_type: string | null
  fiscal_month: number | null
  address: string | null
  tax_office: string | null        // 관할 세무서
  contract_date: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  // 용역
  services: string | null          // 기존 호환
  service_category: string | null  // 제공 용역 대분류
  service_detail: string | null    // 상세분류
  tax_type: string | null          // 과세유형
  withholding_type: string | null  // 원천세신고유형
  manager: string | null           // 담당자(내부)
  memo: string | null
  // 계좌
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
  status: 'active' | 'inactive'
  needs_review: boolean | null
  source: string | null
  created_at: string
}

export interface Project {
  id: string
  client_id: string
  name: string
  type: string | null
  type_detail: string | null
  start_date: string | null
  end_date: string | null
  status: 'preparing' | 'in_progress' | 'review' | 'completed'
  manager_id: string | null
  memo: string | null
  needs_review: boolean | null
  source: string | null
  created_at: string
}

export interface Milestone {
  id: string
  project_id: string
  title: string
  due_date: string | null
  completed: boolean
  created_at: string
}

export interface Todo {
  id: string
  user_id: string
  title: string
  due_date: string | null
  priority: 'high' | 'medium' | 'low'
  completed: boolean
  client_id: string | null
  project_id: string | null
  created_at: string
}

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  date: string
  time: string | null
  location: string | null
  client_id: string | null
  project_id: string | null
  created_at: string
}

export interface Contact {
  id: string
  user_id: string
  name: string
  company: string | null
  title: string | null
  phone: string | null
  email: string | null
  client_id: string | null
  project_id: string | null
  tags: string[]
  note: string | null
  needs_review: boolean | null
  source: string | null
  created_at: string
}

export interface Memo {
  id: string
  raw_text: string
  parsed_result: ParsedResult | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface ParsedResult {
  events: Array<{
    title: string
    date: string | null
    time: string | null
    location: string | null
    client_name: string | null
  }>
  todos: Array<{
    title: string
    due_date: string | null
    priority: string | null
    assignee: string | null
  }>
  clients: Array<{
    name: string
    action: string | null
    is_new: boolean
  }>
  projects: Array<{
    name: string
    client_name: string | null
    milestone: string | null
    milestones: Array<{ title: string; due_date: string | null }> | null
  }>
  contacts: Array<{
    name: string
    company: string | null
    title: string | null
  }>
  raw_memo: string
}
