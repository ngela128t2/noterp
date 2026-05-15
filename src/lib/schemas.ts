import { z } from 'zod'

export const ParsedEventSchema = z.object({
  title: z.string().min(1),
  date: z.string().nullable(),
  time: z.string().nullable(),
  location: z.string().nullable(),
  client_name: z.string().nullable(),
})

export const ParsedTodoSchema = z.object({
  title: z.string().min(1),
  due_date: z.string().nullable(),
  priority: z.enum(['high', 'medium', 'low']).nullable(),
  assignee: z.string().nullable(),
})

export const ParsedClientSchema = z.object({
  name: z.string().min(1),
  action: z.string().nullable(),
  is_new: z.boolean(),
})

export const ParsedProjectSchema = z.object({
  name: z.string().min(1),
  client_name: z.string().nullable(),
  milestone: z.string().nullable(),
  milestones: z.array(z.object({
    title: z.string(),
    due_date: z.string().nullable(),
  })).nullable(),
})

export const ParsedContactSchema = z.object({
  name: z.string().min(1),
  company: z.string().nullable(),
  title: z.string().nullable(),
})

export const ParsedResultSchema = z.object({
  events: z.array(ParsedEventSchema).default([]),
  todos: z.array(ParsedTodoSchema).default([]),
  clients: z.array(ParsedClientSchema).default([]),
  projects: z.array(ParsedProjectSchema).default([]),
  contacts: z.array(ParsedContactSchema).default([]),
  raw_memo: z.string().default(''),
})

export type ParsedResultInput = z.input<typeof ParsedResultSchema>

export function safeParseMemoResult(raw: unknown) {
  const result = ParsedResultSchema.safeParse(raw)
  if (result.success) return result.data

  // 실패 시 빈 결과 반환 (파싱 오류로 앱이 깨지지 않도록)
  console.warn('[zod] AI 파싱 결과 검증 실패:', result.error.flatten())
  return ParsedResultSchema.parse({
    events: [], todos: [], clients: [], projects: [], contacts: [], raw_memo: '',
  })
}
