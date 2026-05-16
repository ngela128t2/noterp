import { useMemo, useState } from 'react'
import { useClients } from '../hooks/useClients'
import {
  useBillingContracts, useBillingRecords,
  useCreateBillingContract, useUpdateBillingContract, useDeleteBillingContract,
  useCreateBillingRecord, useUpdateBillingRecord, useDeleteBillingRecord,
} from '../hooks/useBilling'
import type { BillingContract, BillingRecord } from '../types'

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

const CYCLE_LABEL: Record<string, string> = { monthly: '월정액', quarterly: '분기별', once: '단건' }
const STATUS_LABEL: Record<string, string> = { pending: '대기', billed: '청구', paid: '수금', overdue: '연체' }
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  billed: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
}

const won = (n: number) => `₩${Number(n).toLocaleString('ko-KR')}`

type Tab = 'contracts' | 'records'

interface ContractForm {
  client_id: string; service_category: string; amount: string
  billing_cycle: 'monthly' | 'quarterly' | 'once'; billing_day: string
  start_date: string; end_date: string; memo: string
}
interface RecordForm {
  client_id: string; contract_id: string; amount: string
  billed_at: string; paid_at: string
  status: 'pending' | 'billed' | 'paid' | 'overdue'; memo: string
}

const EMPTY_CONTRACT: ContractForm = {
  client_id: '', service_category: '', amount: '', billing_cycle: 'monthly',
  billing_day: '', start_date: '', end_date: '', memo: '',
}
const EMPTY_RECORD: RecordForm = {
  client_id: '', contract_id: '', amount: '', billed_at: '', paid_at: '', status: 'pending', memo: '',
}

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>('contracts')
  const [statusFilter, setStatusFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('')

  const [contractModal, setContractModal] = useState<'create' | BillingContract | null>(null)
  const [recordModal, setRecordModal] = useState<'create' | BillingRecord | null>(null)
  const [contractForm, setContractForm] = useState<ContractForm>(EMPTY_CONTRACT)
  const [recordForm, setRecordForm] = useState<RecordForm>(EMPTY_RECORD)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data: clients = [] } = useClients()
  const { data: contracts = [], isLoading: contractsLoading } = useBillingContracts()
  const { data: records = [], isLoading: recordsLoading } = useBillingRecords({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    month: monthFilter || undefined,
  })

  const createContract = useCreateBillingContract()
  const updateContract = useUpdateBillingContract()
  const deleteContract = useDeleteBillingContract()
  const createRecord = useCreateBillingRecord()
  const updateRecord = useUpdateBillingRecord()
  const deleteRecord = useDeleteBillingRecord()

  const totalBilled = useMemo(() => records.filter(r => ['billed', 'paid'].includes(r.status)).reduce((s, r) => s + Number(r.amount), 0), [records])
  const totalUnpaid = useMemo(() => records.filter(r => ['billed', 'overdue'].includes(r.status)).reduce((s, r) => s + Number(r.amount), 0), [records])

  const openContractCreate = () => { setContractForm(EMPTY_CONTRACT); setSaveError(null); setContractModal('create') }
  const openContractEdit = (c: BillingContract) => {
    setContractForm({
      client_id: c.client_id, service_category: c.service_category, amount: String(c.amount),
      billing_cycle: c.billing_cycle, billing_day: String(c.billing_day ?? ''),
      start_date: c.start_date, end_date: c.end_date ?? '', memo: c.memo ?? '',
    })
    setSaveError(null)
    setContractModal(c)
  }

  const openRecordCreate = () => { setRecordForm(EMPTY_RECORD); setSaveError(null); setRecordModal('create') }
  const openRecordEdit = (r: BillingRecord) => {
    setRecordForm({
      client_id: r.client_id, contract_id: r.contract_id ?? '', amount: String(r.amount),
      billed_at: r.billed_at ?? '', paid_at: r.paid_at ?? '', status: r.status, memo: r.memo ?? '',
    })
    setSaveError(null)
    setRecordModal(r)
  }

  const saveContract = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    setSaving(true); setSaveError(null)
    try {
      const payload = {
        user_id: '', client_id: contractForm.client_id, service_category: contractForm.service_category,
        amount: Number(contractForm.amount), billing_cycle: contractForm.billing_cycle,
        billing_day: contractForm.billing_day ? Number(contractForm.billing_day) : null,
        start_date: contractForm.start_date, end_date: contractForm.end_date || null, memo: contractForm.memo || null,
      }
      if (contractModal === 'create') await createContract.mutateAsync(payload as any)
      else if (contractModal && typeof contractModal === 'object') await updateContract.mutateAsync({ id: contractModal.id, ...payload } as any)
      setContractModal(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const saveRecord = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    setSaving(true); setSaveError(null)
    try {
      const payload = {
        user_id: '', client_id: recordForm.client_id, contract_id: recordForm.contract_id || null,
        amount: Number(recordForm.amount), billed_at: recordForm.billed_at || null,
        paid_at: recordForm.paid_at || null, status: recordForm.status, memo: recordForm.memo || null,
      }
      if (recordModal === 'create') await createRecord.mutateAsync(payload as any)
      else if (recordModal && typeof recordModal === 'object') await updateRecord.mutateAsync({ id: recordModal.id, ...payload } as any)
      setRecordModal(null)
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
          <h2 className="text-lg lg:text-2xl font-bold text-gray-900">수금 관리</h2>
          <p className="text-sm text-gray-400 mt-1">용역 계약 및 청구·수금 내역을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openContractCreate} className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 rounded-lg">
            + 계약 추가
          </button>
          <button onClick={openRecordCreate} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
            + 청구 건 추가
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="전체 계약" value={`${contracts.length}건`} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard label="이번 달 청구" value={won(totalBilled)} color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="미수금" value={won(totalUnpaid)} color="text-red-600" bg="bg-red-50" />
        <StatCard label="수금 완료" value={`${records.filter(r => r.status === 'paid').length}건`} color="text-emerald-600" bg="bg-emerald-50" />
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(['contracts', 'records'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'contracts' ? `청구 계약 (${contracts.length})` : `청구/수금 내역 (${records.length})`}
          </button>
        ))}
      </div>

      {/* 청구 계약 탭 */}
      {tab === 'contracts' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">거래처명</th>
                  <th className="text-left px-4 py-3 font-semibold w-32">용역 구분</th>
                  <th className="text-right px-4 py-3 font-semibold w-32">계약 금액</th>
                  <th className="text-left px-4 py-3 font-semibold w-24">청구 주기</th>
                  <th className="text-left px-4 py-3 font-semibold w-16">청구일</th>
                  <th className="text-left px-4 py-3 font-semibold w-24">시작일</th>
                  <th className="text-left px-4 py-3 font-semibold w-24">종료일</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {contractsLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">불러오는 중...</td></tr>
                ) : contracts.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">등록된 계약이 없습니다.</td></tr>
                ) : contracts.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{(c as any).clients?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.service_category}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-800">{won(c.amount)}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{CYCLE_LABEL[c.billing_cycle]}</span></td>
                    <td className="px-4 py-3 text-gray-500">{c.billing_day ? `${c.billing_day}일` : '-'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{c.start_date}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{c.end_date ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openContractEdit(c)} className="text-xs text-gray-400 hover:text-indigo-600 px-1.5 py-1 rounded">수정</button>
                        <button onClick={() => { if (confirm('삭제할까요?')) deleteContract.mutate(c.id) }} className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-1 rounded">삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 청구/수금 내역 탭 */}
      {tab === 'records' && (
        <>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {['all', 'pending', 'billed', 'paid', 'overdue'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 bg-white'}`}
              >
                {s === 'all' ? '전체' : STATUS_LABEL[s]}
              </button>
            ))}
            <input
              type="month"
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            {monthFilter && <button onClick={() => setMonthFilter('')} className="text-xs text-gray-400 hover:text-gray-600">초기화</button>}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-400 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">거래처명</th>
                    <th className="text-right px-4 py-3 font-semibold w-32">금액</th>
                    <th className="text-left px-4 py-3 font-semibold w-28">청구일</th>
                    <th className="text-left px-4 py-3 font-semibold w-28">수금일</th>
                    <th className="text-left px-4 py-3 font-semibold w-20">상태</th>
                    <th className="text-left px-4 py-3 font-semibold">메모</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {recordsLoading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">불러오는 중...</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">내역이 없습니다.</td></tr>
                  ) : records.map(r => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{(r as any).clients?.name ?? '-'}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-800">{won(r.amount)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.billed_at ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.paid_at ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[160px]">{r.memo ?? '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {r.status === 'billed' && (
                            <button
                              onClick={() => updateRecord.mutate({ id: r.id, status: 'paid', paid_at: new Date().toISOString().split('T')[0] })}
                              className="text-xs text-emerald-600 hover:bg-emerald-50 px-1.5 py-1 rounded"
                            >수금</button>
                          )}
                          <button onClick={() => openRecordEdit(r)} className="text-xs text-gray-400 hover:text-indigo-600 px-1.5 py-1 rounded">수정</button>
                          <button onClick={() => { if (confirm('삭제할까요?')) deleteRecord.mutate(r.id) }} className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-1 rounded">삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 계약 모달 */}
      {contractModal !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{contractModal === 'create' ? '계약 추가' : '계약 수정'}</h3>
            <form onSubmit={saveContract} className="space-y-3">
              <Field label="거래처 *">
                <select required value={contractForm.client_id} onChange={e => setContractForm(f => ({ ...f, client_id: e.target.value }))} className={inp}>
                  <option value="">선택</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="용역 구분 *">
                <input required value={contractForm.service_category} onChange={e => setContractForm(f => ({ ...f, service_category: e.target.value }))} className={inp} placeholder="세무대리 / 외부감사 등" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="금액 (원) *">
                  <input required type="number" value={contractForm.amount} onChange={e => setContractForm(f => ({ ...f, amount: e.target.value }))} className={inp} placeholder="0" />
                </Field>
                <Field label="청구 주기">
                  <select value={contractForm.billing_cycle} onChange={e => setContractForm(f => ({ ...f, billing_cycle: e.target.value as any }))} className={inp}>
                    <option value="monthly">월정액</option>
                    <option value="quarterly">분기별</option>
                    <option value="once">단건</option>
                  </select>
                </Field>
              </div>
              {contractForm.billing_cycle !== 'once' && (
                <Field label="청구일 (매월 N일)">
                  <input type="number" min={1} max={31} value={contractForm.billing_day} onChange={e => setContractForm(f => ({ ...f, billing_day: e.target.value }))} className={inp} placeholder="25" />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="시작일 *">
                  <input required type="date" value={contractForm.start_date} onChange={e => setContractForm(f => ({ ...f, start_date: e.target.value }))} className={inp} />
                </Field>
                <Field label="종료일">
                  <input type="date" value={contractForm.end_date} onChange={e => setContractForm(f => ({ ...f, end_date: e.target.value }))} className={inp} />
                </Field>
              </div>
              <Field label="메모">
                <textarea value={contractForm.memo} onChange={e => setContractForm(f => ({ ...f, memo: e.target.value }))} rows={2} className={`${inp} resize-none`} />
              </Field>
              {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setContractModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg">{saving ? '저장 중...' : '저장'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 청구 건 모달 */}
      {recordModal !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{recordModal === 'create' ? '청구 건 추가' : '청구 건 수정'}</h3>
            <form onSubmit={saveRecord} className="space-y-3">
              <Field label="거래처 *">
                <select required value={recordForm.client_id} onChange={e => setRecordForm(f => ({ ...f, client_id: e.target.value }))} className={inp}>
                  <option value="">선택</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="금액 (원) *">
                <input required type="number" value={recordForm.amount} onChange={e => setRecordForm(f => ({ ...f, amount: e.target.value }))} className={inp} placeholder="0" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="청구일">
                  <input type="date" value={recordForm.billed_at} onChange={e => setRecordForm(f => ({ ...f, billed_at: e.target.value }))} className={inp} />
                </Field>
                <Field label="수금일">
                  <input type="date" value={recordForm.paid_at} onChange={e => setRecordForm(f => ({ ...f, paid_at: e.target.value }))} className={inp} />
                </Field>
              </div>
              <Field label="상태">
                <select value={recordForm.status} onChange={e => setRecordForm(f => ({ ...f, status: e.target.value as any }))} className={inp}>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="메모">
                <textarea value={recordForm.memo} onChange={e => setRecordForm(f => ({ ...f, memo: e.target.value }))} rows={2} className={`${inp} resize-none`} />
              </Field>
              {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setRecordModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg">{saving ? '저장 중...' : '저장'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 ${bg} p-4`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
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
