import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClients } from '../hooks/useClients'
import { useContacts } from '../hooks/useContacts'
import { useClientLogs, type ActivityLog } from '../hooks/useLogs'
import { useTaxTasks, useUpsertTaxTask, useUpdateTaxStatus, TAX_STATUSES, TAX_TYPES, TAX_STATUS_COLOR } from '../hooks/useTaxTasks'
import { useLaborCheck, useUpsertLaborCheck } from '../hooks/useLaborChecks'
import {
  useClientBillingContract, useClientBillingRecords,
  useCreateBillingContract, useUpdateBillingContract,
  useCreateBillingRecord, useUpdateBillingRecord, useDeleteBillingRecord,
} from '../hooks/useBilling'
import type { BillingContract, BillingRecord } from '../types'
import { getLocalDate } from '../lib/dateUtils'

const TODAY = getLocalDate()
const THIS_MONTH = TODAY.slice(0, 7)

type Tab = 'overview' | 'tax' | 'labor' | 'timeline' | 'fees'
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'tax',      label: '세무 업무' },
  { key: 'labor',    label: '노무 체크' },
  { key: 'timeline', label: '업무 기록' },
  { key: 'fees',     label: '기장료' },
]

export default function TaxClientPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [addingTask, setAddingTask] = useState(false)

  const { data: clients = [] } = useClients()
  const { data: contacts = [] } = useContacts()
  const { data: taxTasks = [] } = useTaxTasks(id ?? '')
  const { data: laborCheck } = useLaborCheck(id ?? '')
  const upsertTask = useUpsertTaxTask()
  const updateStatus = useUpdateTaxStatus()
  const upsertLabor = useUpsertLaborCheck()

  const client = clients.find(c => c.id === id)
  if (!client) return <div className="p-6 text-gray-400 text-sm">거래처를 찾을 수 없습니다.</div>

  const clientContacts = contacts.filter(c => c.client_id === id)
  const thisMonthTasks = taxTasks.filter(t => t.month === THIS_MONTH)

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
          <button onClick={() => navigate('/tax')} className="hover:text-emerald-600 transition-colors">세무대리</button>
          <span>/</span>
          <span className="text-gray-600">{client.name}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {client.code && <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{client.code}</span>}
              {client.service_detail && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{client.service_detail}</span>}
              {client.tax_type && <span className="text-[10px] text-gray-400">{client.tax_type}</span>}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
          </div>
          <button
            onClick={() => navigate('/memo', { state: { clientId: id, clientName: client.name } })}
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shrink-0"
          >
            + 메모
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-0 mt-3 -mb-4 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm border-b-2 transition-colors whitespace-nowrap -mb-px ${
                tab === t.key
                  ? 'border-emerald-600 text-emerald-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-3xl">

          {/* ── 개요 ── */}
          {tab === 'overview' && (
            <div className="space-y-4">
              <Section title="기본 정보">
                <Row label="거래처유형" value={client.entity_type} />
                <Row label="업무유형" value={client.service_detail} />
                <Row label="부가세유형" value={client.tax_type} />
                <Row label="사업자번호" value={client.business_number} mono />
                <Row label="개업일" value={client.established_date} />
                <Row label="대표자" value={client.representative} />
                <Row label="주소" value={client.address} />
                <Row label="업종" value={client.services} />
                <Row label="담당자" value={client.manager} />
              </Section>

              {clientContacts.length > 0 && (
                <Section title="연락처">
                  {clientContacts.map(c => (
                    <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold shrink-0">
                        {c.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{c.name}</p>
                        {c.title && <p className="text-xs text-gray-400">{c.title}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.phone && <a href={`tel:${c.phone}`} className="text-xs text-gray-500 hover:text-indigo-600">📞</a>}
                        {c.phone && <a href={`sms:${c.phone}`} className="text-xs text-gray-500 hover:text-emerald-600">💬</a>}
                        {c.email && <a href={`mailto:${c.email}`} className="text-xs text-gray-500 hover:text-indigo-600">✉️</a>}
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              {client.memo && (
                <Section title="메모">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{client.memo}</p>
                </Section>
              )}

              {/* 이번 달 업무 요약 */}
              {thisMonthTasks.length > 0 && (
                <Section title={`이번 달 업무 (${THIS_MONTH})`}>
                  <div className="space-y-1.5">
                    {thisMonthTasks.map(t => (
                      <div key={t.id} className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TAX_STATUS_COLOR[t.status]}`}>{t.status}</span>
                        <span className="text-sm text-gray-700">{t.task_type}</span>
                        {t.memo && <span className="text-xs text-gray-400 truncate">{t.memo}</span>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* ── 세무 업무 ── */}
          {tab === 'tax' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">월별 세무 업무</h2>
                <button
                  onClick={() => setAddingTask(true)}
                  className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
                >
                  + 업무 추가
                </button>
              </div>

              {/* 업무 추가 폼 */}
              {addingTask && (
                <AddTaskForm
                  clientId={id!}
                  onSave={async (data) => {
                    await upsertTask.mutateAsync(data)
                    setAddingTask(false)
                  }}
                  onCancel={() => setAddingTask(false)}
                />
              )}

              {/* 업무 목록 (최근 달 순) */}
              {taxTasks.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">등록된 업무가 없습니다</p>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['월', '업무', '상태', '요청일', '수신일', '메모'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {taxTasks.map(task => (
                        <tr key={task.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-3 py-2.5 text-xs font-mono text-gray-600">{task.month}</td>
                          <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{task.task_type}</td>
                          <td className="px-3 py-2.5">
                            <select
                              value={task.status}
                              onChange={e => updateStatus.mutate({ id: task.id, status: e.target.value as any, clientId: id! })}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium border-0 cursor-pointer focus:outline-none ${TAX_STATUS_COLOR[task.status]}`}
                            >
                              {TAX_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-400">{task.requested_at?.slice(5) ?? '—'}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-400">{task.received_at?.slice(5) ?? '—'}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[120px] truncate">{task.memo ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── 노무 체크 ── */}
          {tab === 'labor' && (
            <LaborCheckTab clientId={id!} check={laborCheck ?? null} onSave={d => upsertLabor.mutate(d)} />
          )}

          {/* ── 업무 기록 ── */}
          {tab === 'timeline' && (
            <TimelineTab clientId={id!} clientName={client.name} />
          )}

          {/* ── 기장료 ── */}
          {tab === 'fees' && (
            <FeesTab clientId={id!} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 업무 추가 폼 ─────────────────────────────────────────────────────────────

function AddTaskForm({ clientId, onSave, onCancel }: {
  clientId: string
  onSave: (data: any) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    month: THIS_MONTH,
    task_type: '원천세' as any,
    status: '대기' as any,
    due_date: '',
    requested_at: '',
    received_at: '',
    memo: '',
  })
  const inputClass = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400'

  return (
    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">귀속월</label>
          <input type="month" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">업무 유형</label>
          <select value={form.task_type} onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))} className={inputClass}>
            {TAX_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">상태</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
            {TAX_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">자료 요청일</label>
          <input type="date" value={form.requested_at} onChange={e => setForm(f => ({ ...f, requested_at: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">자료 수신일</label>
          <input type="date" value={form.received_at} onChange={e => setForm(f => ({ ...f, received_at: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">마감일</label>
          <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputClass} />
        </div>
      </div>
      <input
        value={form.memo}
        onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
        placeholder="메모"
        className={inputClass}
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
        <button
          onClick={() => onSave({ ...form, client_id: clientId, due_date: form.due_date || null, requested_at: form.requested_at || null, received_at: form.received_at || null, memo: form.memo || null })}
          className="px-4 py-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium"
        >
          저장
        </button>
      </div>
    </div>
  )
}

// ─── 노무 체크 탭 ─────────────────────────────────────────────────────────────

function LaborCheckTab({ clientId, check, onSave }: {
  clientId: string
  check: any | null
  onSave: (d: any) => void
}) {
  const [form, setForm] = useState({
    employee_count: check?.employee_count ?? 0,
    new_hire: check?.new_hire ?? false,
    resignation: check?.resignation ?? false,
    contract_status: check?.contract_status ?? '미확인',
    has_salary_ledger: check?.has_salary_ledger ?? false,
    insurance_filed: check?.insurance_filed ?? false,
    annual_leave_issue: check?.annual_leave_issue ?? false,
    memo: check?.memo ?? '',
  })

  const empCount = form.employee_count
  const under5 = empCount > 0 && empCount < 5
  const over10 = empCount >= 10
  const over30 = empCount >= 30

  const save = () => onSave({ ...form, client_id: clientId, memo: form.memo || null })

  return (
    <div className="space-y-4">
      <Section title="기본 현황">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 w-28 shrink-0">상시 직원 수</label>
            <input
              type="number"
              value={form.employee_count}
              onChange={e => setForm(f => ({ ...f, employee_count: +e.target.value }))}
              className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <span className="text-xs text-gray-400">명</span>
            {under5 && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-200">5인 미만</span>}
            {over10 && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-200">10인 이상</span>}
            {over30 && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-200">30인 이상</span>}
          </div>
          {[
            { key: 'new_hire',        label: '입사자 발생' },
            { key: 'resignation',     label: '퇴사자 발생' },
            { key: 'has_salary_ledger', label: '급여대장 작성' },
            { key: 'insurance_filed', label: '4대보험 취득/상실 신고 완료' },
            { key: 'annual_leave_issue', label: '연차 이슈 있음' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <label className="text-xs text-gray-500 w-28 shrink-0">{label}</label>
              <input
                type="checkbox"
                checked={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                className="w-4 h-4 accent-emerald-600"
              />
            </div>
          ))}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 w-28 shrink-0">근로계약서</label>
            <select
              value={form.contract_status}
              onChange={e => setForm(f => ({ ...f, contract_status: e.target.value }))}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              {['완료', '일부', '미확인'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {/* 인원수 기준 안내 */}
      {under5 && (
        <Section title="5인 미만 사업장 체크">
          <p className="text-xs text-amber-600 mb-2">아래 항목 적용 여부를 고객에게 확인하세요.</p>
          {['연장·야간·휴일 가산수당', '연차휴가', '공휴일·대체휴일', '직장 내 괴롭힘 금지', '휴업수당 지급'].map(item => (
            <p key={item} className="text-xs text-gray-600 py-0.5">· {item}</p>
          ))}
        </Section>
      )}
      {over10 && (
        <Section title="10인 이상 사업장 체크">
          {['취업규칙 작성·신고 여부', '성희롱 예방교육 자료 게시/배포 여부'].map(item => (
            <p key={item} className="text-xs text-gray-600 py-0.5">· {item}</p>
          ))}
        </Section>
      )}
      {over30 && (
        <Section title="30인 이상 사업장 체크">
          {['노사협의회 설치 여부', '고충처리위원 선임 여부', '채용절차 의무 검토'].map(item => (
            <p key={item} className="text-xs text-gray-600 py-0.5">· {item}</p>
          ))}
        </Section>
      )}

      <Section title="메모">
        <textarea
          value={form.memo}
          onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
          placeholder="노무 관련 특이사항"
        />
      </Section>

      <button
        onClick={save}
        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        저장
      </button>
    </div>
  )
}

// ─── 업무 기록 탭 ─────────────────────────────────────────────────────────────

function TimelineTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data: logs = [] } = useClientLogs(clientId)
  const navigate = useNavigate()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-gray-700">업무 기록</h2>
        <button
          onClick={() => navigate('/memo', { state: { clientId, clientName } })}
          className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
        >
          + 메모 추가
        </button>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">업무 기록이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {(logs as ActivityLog[]).map(log => (
            <div key={log.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{log.entity_name} — {log.action}</p>
                  {log.detail?.memo && <p className="text-xs text-gray-400 mt-0.5 truncate">{String(log.detail.memo)}</p>}
                  <p className="text-[10px] text-gray-300 mt-1">{log.created_at.slice(0, 16).replace('T', ' ')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 기장료 탭 ────────────────────────────────────────────────────────────────

const CYCLE_LABEL: Record<string, string> = { monthly: '매월', quarterly: '분기별', once: '일회성' }
const RECORD_STATUS_LABEL: Record<string, string> = { pending: '미처리', billed: '청구', paid: '납부완료', overdue: '연체' }
const RECORD_STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-500',
  billed:  'bg-blue-100 text-blue-600',
  paid:    'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-600',
}

function FeesTab({ clientId }: { clientId: string }) {
  const { data: contract } = useClientBillingContract(clientId)
  const { data: records = [] } = useClientBillingRecords(clientId)
  const createContract = useCreateBillingContract()
  const updateContract = useUpdateBillingContract()
  const createRecord = useCreateBillingRecord()
  const updateRecord = useUpdateBillingRecord()
  const deleteRecord = useDeleteBillingRecord()

  const [editingContract, setEditingContract] = useState(false)
  const [addingRecord, setAddingRecord] = useState(false)
  const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {/* 계약 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">기장료 계약</p>
          <button
            onClick={() => setEditingContract(v => !v)}
            className="text-xs text-emerald-600 hover:underline"
          >
            {editingContract ? '취소' : (contract ? '수정' : '등록')}
          </button>
        </div>

        {editingContract ? (
          <ContractForm
            initial={contract}
            clientId={clientId}
            onSave={async (data) => {
              if (contract) await updateContract.mutateAsync({ id: contract.id, ...data } as any)
              else await createContract.mutateAsync(data as any)
              setEditingContract(false)
            }}
          />
        ) : contract ? (
          <div className="space-y-2">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-[10px] text-gray-400">월 기장료</p>
                <p className="text-xl font-bold text-gray-900">₩{contract.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">청구주기</p>
                <p className="text-sm font-medium text-gray-700">{CYCLE_LABEL[contract.billing_cycle] ?? contract.billing_cycle}</p>
              </div>
              {contract.billing_day && (
                <div>
                  <p className="text-[10px] text-gray-400">출금일</p>
                  <p className="text-sm font-medium text-gray-700">매월 {contract.billing_day}일</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-gray-400">계약 시작</p>
                <p className="text-sm font-medium text-gray-700">{contract.start_date}</p>
              </div>
              {contract.end_date && (
                <div>
                  <p className="text-[10px] text-gray-400">계약 종료</p>
                  <p className="text-sm font-medium text-gray-700">{contract.end_date}</p>
                </div>
              )}
            </div>
            {contract.memo && <p className="text-xs text-gray-400 mt-1">{contract.memo}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-3">등록된 계약이 없습니다</p>
        )}
      </div>

      {/* 청구 내역 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">청구 내역</p>
          <button
            onClick={() => { setAddingRecord(true); setEditingRecord(null) }}
            className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
          >
            + 청구 추가
          </button>
        </div>

        {(addingRecord || editingRecord) && (
          <RecordForm
            initial={editingRecord}
            defaultAmount={contract?.amount}
            clientId={clientId}
            contractId={contract?.id ?? null}
            onSave={async (data) => {
              if (editingRecord) await updateRecord.mutateAsync({ id: editingRecord.id, ...data } as any)
              else await createRecord.mutateAsync(data as any)
              setAddingRecord(false)
              setEditingRecord(null)
            }}
            onCancel={() => { setAddingRecord(false); setEditingRecord(null) }}
          />
        )}

        {records.length === 0 && !addingRecord ? (
          <p className="text-sm text-gray-400 text-center py-3">청구 내역이 없습니다</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-100 mt-2">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['청구일', '금액', '상태', '납부일', '메모', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map(r => (
                  confirmDeleteId === r.id ? (
                    <tr key={r.id} className="bg-red-50">
                      <td colSpan={6} className="px-3 py-2 text-xs text-red-600">
                        삭제하시겠습니까?
                        <button onClick={() => { deleteRecord.mutate(r.id); setConfirmDeleteId(null) }} className="ml-3 font-semibold hover:underline">삭제</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="ml-2 text-gray-500 hover:underline">취소</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-2.5 text-xs text-gray-600">{r.billed_at ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-gray-700">₩{r.amount.toLocaleString()}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${RECORD_STATUS_COLOR[r.status]}`}>
                          {RECORD_STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-400">{r.paid_at ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[100px] truncate">{r.memo ?? ''}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => { setEditingRecord(r); setAddingRecord(false) }} className="text-[10px] text-gray-400 hover:text-emerald-600 mr-2">수정</button>
                        <button onClick={() => setConfirmDeleteId(r.id)} className="text-[10px] text-gray-400 hover:text-red-500">삭제</button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function ContractForm({ initial, clientId, onSave }: {
  initial: BillingContract | null | undefined
  clientId: string
  onSave: (data: Omit<BillingContract, 'id' | 'created_at' | 'user_id'>) => Promise<void>
}) {
  const [form, setForm] = useState({
    client_id: clientId,
    service_category: initial?.service_category ?? '기장',
    amount: initial?.amount ?? 0,
    billing_cycle: initial?.billing_cycle ?? 'monthly' as BillingContract['billing_cycle'],
    billing_day: initial?.billing_day ?? null as number | null,
    start_date: initial?.start_date ?? getLocalDate(),
    end_date: initial?.end_date ?? null as string | null,
    memo: initial?.memo ?? '',
  })
  const inputClass = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400'

  return (
    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">월 기장료 (원)</label>
          <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">청구주기</label>
          <select value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value as any }))} className={inputClass}>
            <option value="monthly">매월</option>
            <option value="quarterly">분기별</option>
            <option value="once">일회성</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">출금일 (일)</label>
          <input type="number" min={1} max={31} value={form.billing_day ?? ''} onChange={e => setForm(f => ({ ...f, billing_day: e.target.value ? +e.target.value : null }))} className={inputClass} placeholder="없음" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">계약 시작일</label>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">계약 종료일</label>
          <input type="date" value={form.end_date ?? ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value || null }))} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">서비스 구분</label>
          <input value={form.service_category} onChange={e => setForm(f => ({ ...f, service_category: e.target.value }))} className={inputClass} />
        </div>
      </div>
      <input value={form.memo ?? ''} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="메모" className={inputClass} />
      <div className="flex gap-2 justify-end">
        <button onClick={() => onSave(form)} className="px-4 py-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium">저장</button>
      </div>
    </div>
  )
}

function RecordForm({ initial, defaultAmount, clientId, contractId, onSave, onCancel }: {
  initial: BillingRecord | null
  defaultAmount?: number
  clientId: string
  contractId: string | null
  onSave: (data: Omit<BillingRecord, 'id' | 'created_at' | 'user_id'>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    client_id: clientId,
    contract_id: contractId,
    amount: initial?.amount ?? defaultAmount ?? 0,
    billed_at: (initial?.billed_at ?? getLocalDate()) as string | null,
    status: initial?.status ?? 'billed' as BillingRecord['status'],
    paid_at: initial?.paid_at ?? null as string | null,
    memo: initial?.memo ?? '',
  })
  const inputClass = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400'

  return (
    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-3 mb-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">청구일</label>
          <input type="date" value={form.billed_at ?? ''} onChange={e => setForm(f => ({ ...f, billed_at: e.target.value || null }))} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">금액 (원)</label>
          <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">상태</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))} className={inputClass}>
            <option value="pending">미처리</option>
            <option value="billed">청구</option>
            <option value="paid">납부완료</option>
            <option value="overdue">연체</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">납부일</label>
          <input type="date" value={form.paid_at ?? ''} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value || null }))} className={inputClass} />
        </div>
      </div>
      <input value={form.memo ?? ''} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="메모" className={inputClass} />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
        <button onClick={() => onSave(form)} className="px-4 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium">저장</button>
      </div>
    </div>
  )
}

// ─── 공통 컴포넌트 ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
      <span className={`text-sm flex-1 ${mono ? 'font-mono text-gray-700' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}

