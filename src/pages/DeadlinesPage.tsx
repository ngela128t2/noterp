import { useMemo, useState } from 'react'
import { useClients } from '../hooks/useClients'
import { getLocalDate, localDateOffset } from '../lib/dateUtils'
import {
  useDeadlineTemplates, useDeadlineInstances,
  useCreateDeadlineTemplate, useUpdateDeadlineTemplate, useDeleteDeadlineTemplate,
  useCreateDeadlineInstance, useToggleDeadlineInstance, useDeleteDeadlineInstance,
  useBulkCreateDeadlineInstances,
} from '../hooks/useDeadlines'
import type { DeadlineTemplate } from '../types'

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
const RECURRENCE_LABEL: Record<string, string> = { yearly: '매년', quarterly: '매분기', monthly: '매월' }

type Filter = 'all' | 'pending' | 'completed'

interface TplForm {
  name: string; recurrence: 'yearly' | 'quarterly' | 'monthly'
  month: string; day: string; alert_days: string
}
interface InstForm {
  template_id: string; client_id: string; name: string; due_date: string
}
interface BulkForm {
  template_id: string; name: string; due_date: string; client_ids: string[]
}

const EMPTY_TPL: TplForm = { name: '', recurrence: 'yearly', month: '', day: '', alert_days: '7, 3, 1' }
const EMPTY_INST: InstForm = { template_id: '', client_id: '', name: '', due_date: '' }

export default function DeadlinesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('pending')
  const [clientFilter, setClientFilter] = useState('')

  const [tplModal, setTplModal] = useState<'create' | DeadlineTemplate | null>(null)
  const [instModal, setInstModal] = useState<'create' | null>(null)
  const [bulkModal, setBulkModal] = useState(false)
  const [tplForm, setTplForm] = useState<TplForm>(EMPTY_TPL)
  const [instForm, setInstForm] = useState<InstForm>(EMPTY_INST)
  const [bulkForm, setBulkForm] = useState<BulkForm>({ template_id: '', name: '', due_date: '', client_ids: [] })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data: clients = [] } = useClients()
  const { data: templates = [] } = useDeadlineTemplates()
  const { data: instances = [] } = useDeadlineInstances({
    completed: filter === 'all' ? undefined : filter === 'completed',
    clientId: clientFilter || undefined,
  })

  const createTemplate = useCreateDeadlineTemplate()
  const updateTemplate = useUpdateDeadlineTemplate()
  const deleteTemplate = useDeleteDeadlineTemplate()
  const createInstance = useCreateDeadlineInstance()
  const toggleInstance = useToggleDeadlineInstance()
  const deleteInstance = useDeleteDeadlineInstance()
  const bulkCreate = useBulkCreateDeadlineInstances()

  const today = getLocalDate()

  const filteredInstances = useMemo(() => {
    if (!selectedTemplate) return instances
    return instances.filter(i => i.template_id === selectedTemplate)
  }, [instances, selectedTemplate])

  const grouped = useMemo(() => {
    const week = localDateOffset(7)
    const month = localDateOffset(30)
    const overdue = filteredInstances.filter(i => !i.completed && i.due_date < today)
    const thisWeek = filteredInstances.filter(i => !i.completed && i.due_date >= today && i.due_date <= week)
    const thisMonth = filteredInstances.filter(i => !i.completed && i.due_date > week && i.due_date <= month)
    const later = filteredInstances.filter(i => !i.completed && i.due_date > month)
    const done = filteredInstances.filter(i => i.completed)
    return { overdue, thisWeek, thisMonth, later, done }
  }, [filteredInstances, today])

  const openTplCreate = () => { setTplForm(EMPTY_TPL); setSaveError(null); setTplModal('create') }
  const openTplEdit = (t: DeadlineTemplate) => {
    setTplForm({
      name: t.name, recurrence: t.recurrence,
      month: String(t.month ?? ''), day: String(t.day),
      alert_days: t.alert_days.join(', '),
    })
    setSaveError(null)
    setTplModal(t)
  }

  const saveTpl = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    setSaving(true); setSaveError(null)
    try {
      const payload = {
        user_id: '',
        name: tplForm.name,
        recurrence: tplForm.recurrence,
        month: tplForm.month ? Number(tplForm.month) : null,
        day: Number(tplForm.day),
        alert_days: tplForm.alert_days.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)),
      }
      if (tplModal === 'create') await createTemplate.mutateAsync(payload as any)
      else if (tplModal && typeof tplModal === 'object') await updateTemplate.mutateAsync({ id: tplModal.id, ...payload } as any)
      setTplModal(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const saveInst = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    setSaving(true); setSaveError(null)
    try {
      await createInstance.mutateAsync({
        user_id: '', template_id: instForm.template_id || null,
        client_id: instForm.client_id, name: instForm.name,
        due_date: instForm.due_date, completed: false, completed_at: null,
      })
      setInstModal(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const saveBulk = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving || bulkForm.client_ids.length === 0) return
    setSaving(true); setSaveError(null)
    try {
      await bulkCreate.mutateAsync({
        template_id: bulkForm.template_id || null,
        client_ids: bulkForm.client_ids,
        name: bulkForm.name,
        due_date: bulkForm.due_date,
      })
      setBulkModal(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">마감 기한</h2>
          <p className="text-sm text-gray-400 mt-1">세무신고·감사보고서 등 법정 마감 기한을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openTplCreate} className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 rounded-lg">+ 템플릿</button>
          <button onClick={() => { setInstForm(EMPTY_INST); setSaveError(null); setInstModal('create') }} className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 rounded-lg">+ 단건 추가</button>
          <button onClick={() => { setBulkForm({ template_id: selectedTemplate ?? '', name: '', due_date: '', client_ids: [] }); setSaveError(null); setBulkModal(true) }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">일괄 생성</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* 왼쪽: 템플릿 목록 */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">마감 템플릿</p>
            </div>
            <ul>
              <li>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${!selectedTemplate ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  전체 ({instances.length})
                </button>
              </li>
              {templates.map(t => (
                <li key={t.id} className="border-t border-gray-50">
                  <div
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`flex items-center px-4 py-3 cursor-pointer group transition-colors ${selectedTemplate === t.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${selectedTemplate === t.id ? 'text-indigo-700' : 'text-gray-800'}`}>{t.name}</p>
                      <p className="text-xs text-gray-400">
                        {RECURRENCE_LABEL[t.recurrence]} {t.month ? `${t.month}월 ` : ''}{t.day}일
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={e => { e.stopPropagation(); openTplEdit(t) }} className="text-xs text-gray-400 hover:text-indigo-600 px-1">수정</button>
                      <button onClick={e => { e.stopPropagation(); if (confirm('삭제?')) deleteTemplate.mutate(t.id) }} className="text-xs text-gray-400 hover:text-red-500 px-1">삭제</button>
                    </div>
                  </div>
                </li>
              ))}
              {templates.length === 0 && (
                <li className="px-4 py-6 text-center text-xs text-gray-400">템플릿이 없습니다</li>
              )}
            </ul>
          </div>
        </div>

        {/* 오른쪽: 인스턴스 목록 */}
        <div className="xl:col-span-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'pending', 'completed'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-indigo-300 bg-white'}`}
              >
                {f === 'all' ? '전체' : f === 'pending' ? '진행 중' : '완료'}
              </button>
            ))}
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none">
              <option value="">전체 거래처</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* 연체 */}
          {grouped.overdue.length > 0 && (
            <InstanceGroup label={`⚠ 연체 (${grouped.overdue.length})`} color="text-red-600" bgHeader="bg-red-50">
              {grouped.overdue.map(i => <InstanceRow key={i.id} instance={i} today={today} onToggle={toggleInstance.mutate} onDelete={deleteInstance.mutate} />)}
            </InstanceGroup>
          )}

          {grouped.thisWeek.length > 0 && (
            <InstanceGroup label={`이번 주 (${grouped.thisWeek.length})`} color="text-orange-600" bgHeader="bg-orange-50">
              {grouped.thisWeek.map(i => <InstanceRow key={i.id} instance={i} today={today} onToggle={toggleInstance.mutate} onDelete={deleteInstance.mutate} />)}
            </InstanceGroup>
          )}

          {grouped.thisMonth.length > 0 && (
            <InstanceGroup label={`이번 달 (${grouped.thisMonth.length})`} color="text-indigo-600" bgHeader="bg-indigo-50">
              {grouped.thisMonth.map(i => <InstanceRow key={i.id} instance={i} today={today} onToggle={toggleInstance.mutate} onDelete={deleteInstance.mutate} />)}
            </InstanceGroup>
          )}

          {grouped.later.length > 0 && (
            <InstanceGroup label={`이후 (${grouped.later.length})`} color="text-gray-600" bgHeader="bg-gray-50">
              {grouped.later.map(i => <InstanceRow key={i.id} instance={i} today={today} onToggle={toggleInstance.mutate} onDelete={deleteInstance.mutate} />)}
            </InstanceGroup>
          )}

          {grouped.done.length > 0 && filter !== 'pending' && (
            <InstanceGroup label={`완료 (${grouped.done.length})`} color="text-emerald-600" bgHeader="bg-emerald-50">
              {grouped.done.map(i => <InstanceRow key={i.id} instance={i} today={today} onToggle={toggleInstance.mutate} onDelete={deleteInstance.mutate} />)}
            </InstanceGroup>
          )}

          {filteredInstances.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-gray-400 text-sm">마감 기한이 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 템플릿 모달 */}
      {tplModal !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{tplModal === 'create' ? '템플릿 추가' : '템플릿 수정'}</h3>
            <form onSubmit={saveTpl} className="space-y-3">
              <Field label="이름 *">
                <input required value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="부가세 1기 예정신고" />
              </Field>
              <Field label="반복 주기">
                <select value={tplForm.recurrence} onChange={e => setTplForm(f => ({ ...f, recurrence: e.target.value as any }))} className={inp}>
                  <option value="yearly">매년</option>
                  <option value="quarterly">매분기</option>
                  <option value="monthly">매월</option>
                </select>
              </Field>
              {tplForm.recurrence !== 'monthly' && (
                <Field label="월">
                  <input type="number" min={1} max={12} value={tplForm.month} onChange={e => setTplForm(f => ({ ...f, month: e.target.value }))} className={inp} placeholder="4" />
                </Field>
              )}
              <Field label="일 *">
                <input required type="number" min={1} max={31} value={tplForm.day} onChange={e => setTplForm(f => ({ ...f, day: e.target.value }))} className={inp} placeholder="25" />
              </Field>
              <Field label="알림 (며칠 전, 쉼표 구분)">
                <input value={tplForm.alert_days} onChange={e => setTplForm(f => ({ ...f, alert_days: e.target.value }))} className={inp} placeholder="7, 3, 1" />
              </Field>
              {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setTplModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg">{saving ? '저장 중...' : '저장'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 단건 추가 모달 */}
      {instModal !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">마감 기한 추가</h3>
            <form onSubmit={saveInst} className="space-y-3">
              <Field label="거래처 *">
                <select required value={instForm.client_id} onChange={e => setInstForm(f => ({ ...f, client_id: e.target.value }))} className={inp}>
                  <option value="">선택</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="마감명 *">
                <input required value={instForm.name} onChange={e => setInstForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="부가세 1기 예정신고" />
              </Field>
              <Field label="마감일 *">
                <input required type="date" value={instForm.due_date} onChange={e => setInstForm(f => ({ ...f, due_date: e.target.value }))} className={inp} />
              </Field>
              <Field label="템플릿 연결">
                <select value={instForm.template_id} onChange={e => setInstForm(f => ({ ...f, template_id: e.target.value }))} className={inp}>
                  <option value="">선택 안 함</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setInstModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg">{saving ? '저장 중...' : '저장'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 일괄 생성 모달 */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">일괄 생성</h3>
            <form onSubmit={saveBulk} className="space-y-3">
              <Field label="마감명 *">
                <input required value={bulkForm.name} onChange={e => setBulkForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="부가세 2기 확정신고" />
              </Field>
              <Field label="마감일 *">
                <input required type="date" value={bulkForm.due_date} onChange={e => setBulkForm(f => ({ ...f, due_date: e.target.value }))} className={inp} />
              </Field>
              <Field label="거래처 선택 (복수)">
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {clients.map(c => (
                    <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bulkForm.client_ids.includes(c.id)}
                        onChange={e => setBulkForm(f => ({
                          ...f,
                          client_ids: e.target.checked ? [...f.client_ids, c.id] : f.client_ids.filter(id => id !== c.id),
                        }))}
                        className="accent-indigo-600"
                      />
                      <span className="text-sm text-gray-700">{c.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">{bulkForm.client_ids.length}개 선택됨</p>
              </Field>
              {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setBulkModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button type="submit" disabled={saving || bulkForm.client_ids.length === 0} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg">
                  {saving ? '생성 중...' : `${bulkForm.client_ids.length}개 생성`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function InstanceGroup({ label, color, bgHeader, children }: { label: string; color: string; bgHeader: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <p className={`px-4 py-2 text-xs font-semibold ${color} ${bgHeader} border-b border-gray-100`}>{label}</p>
      <ul className="divide-y divide-gray-50">{children}</ul>
    </div>
  )
}

function InstanceRow({ instance: i, today, onToggle, onDelete }: {
  instance: any; today: string
  onToggle: (args: { id: string; completed: boolean }) => void
  onDelete: (id: string) => void
}) {
  const overdueDays = !i.completed && i.due_date < today
    ? Math.floor((new Date(today).getTime() - new Date(i.due_date).getTime()) / 86400000)
    : 0

  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
      <input
        type="checkbox"
        checked={i.completed}
        onChange={e => onToggle({ id: i.id, completed: e.target.checked })}
        className="w-4 h-4 rounded accent-indigo-600 shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${i.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{i.name}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
          <span>{i.clients?.name ?? '-'}</span>
          {overdueDays > 0 && <span className="text-red-500 font-medium">{overdueDays}일 연체</span>}
        </div>
      </div>
      <span className={`text-xs font-mono shrink-0 ${overdueDays > 0 ? 'text-red-500' : i.completed ? 'text-emerald-500' : 'text-indigo-500'}`}>
        {i.due_date.slice(5)}
      </span>
      <button
        onClick={() => { if (confirm('삭제?')) onDelete(i.id) }}
        className="opacity-0 group-hover:opacity-100 text-xs text-gray-300 hover:text-red-400 px-1 transition-opacity"
      >✕</button>
    </li>
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
