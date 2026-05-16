import { useState } from 'react'
import type { Client, Project } from '../../types'
import { getLocalDate } from '../../lib/dateUtils'

interface MilestoneInput {
  title: string
  due_date: string
}

interface Props {
  initial?: Partial<Project>
  initialMilestones?: MilestoneInput[]   // 템플릿에서 자동 생성된 마일스톤
  clients: Client[]
  error?: string | null
  onSave: (data: Omit<Project, 'id' | 'created_at'>, milestones: MilestoneInput[]) => void
  onClose: () => void
}

const PROJECT_DETAILS: Record<string, string[]> = {
  세무대리: ['기장', '조정', '신고대리', '기타'],
  외부감사: ['법정감사', '임의감사', '검토', '기타'],
  컨설팅: ['세무컨설팅', '회계컨설팅', '경영컨설팅', '기타'],
  자문: ['세무자문', '회계자문', '기타'],
  한공회: ['품질관리', '감리', '기타'],
  품질관리: ['사전심리', '행정', '감리', '모니터링', '기타'],
  중회협: ['임원회의', 'TF', '기타'],
  강의: ['사내강의', '외부강의', '기타'],
  기타: ['기타'],
}

const PROJECT_TYPES = Object.keys(PROJECT_DETAILS)
const today = getLocalDate()
const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

export default function ProjectFormModal({ initial, initialMilestones, clients, error, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    user_id: '',
    name: initial?.name ?? '',
    client_id: initial?.client_id ?? '',
    type: initial?.type ?? '세무대리',
    type_detail: initial?.type_detail ?? '',
    start_date: initial?.start_date ?? today,
    end_date: initial?.end_date ?? '',
    status: (initial?.status ?? 'in_progress') as Project['status'],
    manager_id: initial?.manager_id ?? null,
    memo: initial?.memo ?? '',
    needs_review: initial?.needs_review ?? false,
    source: initial?.source ?? null,
  })

  const [milestones, setMilestones] = useState<MilestoneInput[]>(
    initialMilestones?.length
      ? initialMilestones
      : initial
      ? []
      : [{ title: '', due_date: '' }],
  )

  const set = (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(current => ({ ...current, [key]: event.target.value || null }))

  const setType = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const type = event.target.value
    setForm(current => ({ ...current, type, type_detail: '' }))
  }

  const addMilestone = () => setMilestones(current => [...current, { title: '', due_date: '' }])
  const removeMilestone = (index: number) => setMilestones(current => current.filter((_, itemIndex) => itemIndex !== index))
  const setMilestone = (index: number, key: keyof MilestoneInput, value: string) =>
    setMilestones(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validMilestones = milestones.filter(milestone => milestone.title.trim())
    onSave({
      ...form,
      client_id: form.client_id || null,
      type: form.type || null,
      type_detail: form.type_detail || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      memo: form.memo || null,
      needs_review: form.needs_review,
      source: form.source,
    } as Omit<Project, 'id' | 'created_at'>, validMilestones)
  }

  const detailOptions = form.type ? PROJECT_DETAILS[form.type] ?? [] : []

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">
            {initial?.name ? '프로젝트 수정' : '프로젝트 추가'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <Field label="프로젝트명 *">
              <input
                required
                value={form.name}
                onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                placeholder="네일클린 사전심리 2026"
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="거래처">
                <select value={form.client_id ?? ''} onChange={set('client_id')} className={inputClass}>
                  <option value="">선택</option>
                  {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </Field>
              <Field label="카테고리">
                <select value={form.type ?? ''} onChange={setType} className={inputClass}>
                  {PROJECT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </Field>
            </div>

            <Field label="세부항목">
              <select value={form.type_detail ?? ''} onChange={set('type_detail')} className={inputClass}>
                <option value="">선택</option>
                {detailOptions.map(detail => <option key={detail} value={detail}>{detail}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="시작일">
                <input type="date" value={form.start_date ?? today} onChange={set('start_date')} className={inputClass} />
              </Field>
              <Field label="종료일">
                <input type="date" value={form.end_date ?? ''} onChange={set('end_date')} className={inputClass} />
              </Field>
            </div>

            <Field label="상태">
              <select value={form.status} onChange={set('status')} className={inputClass}>
                <option value="preparing">준비</option>
                <option value="in_progress">진행 중</option>
                <option value="review">검토</option>
                <option value="completed">완료</option>
              </select>
            </Field>

            <Field label="프로젝트 메모">
              <textarea value={form.memo ?? ''} onChange={set('memo')} rows={4} className={`${inputClass} resize-none`} placeholder="프로젝트 관련 메모가 여기에 쌓입니다." />
            </Field>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">단계 및 마일스톤</label>
                <button type="button" onClick={addMilestone} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  + 항목 추가
                </button>
              </div>
              <div className="space-y-2">
                {milestones.map((milestone, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      value={milestone.title}
                      onChange={event => setMilestone(index, 'title', event.target.value)}
                      placeholder={`마일스톤 ${index + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="date"
                      value={milestone.due_date}
                      onChange={event => setMilestone(index, 'due_date', event.target.value)}
                      className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="button" onClick={() => removeMilestone(index)} className="text-gray-300 hover:text-red-400 text-sm w-6 shrink-0">
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="px-6 pb-3">
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            </div>
          )}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
            <button type="submit" className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg">저장</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
