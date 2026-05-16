import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Plus, X } from 'lucide-react'
import {
  useIntake, useUpdateIntake, useApproveIntake,
  INTAKE_STATUS_LABEL, INTAKE_STATUS_COLOR, INTAKE_DOCS, INTAKE_SOURCES,
  type TaxIntake, type IntakeDocuments,
} from '../hooks/useIntakes'

const ENTITY_TYPES = ['법인', '개인사업자', '개인']
const TAX_TYPES = ['일반과세', '간이과세', '면세']
const SERVICE_DETAILS = ['기장', '조정', '신고대리', '기타']
const STATUSES: TaxIntake['status'][] = ['receiving', 'reviewing', 'approved', 'rejected']

const RISK_PRESETS = [
  '차명 인건비 가능성', '가공경비 의심', '과거 체납 이력 확인 필요',
  '4대보험 미가입', '현금매출 누락 가능성', '특수관계인 거래',
  '해외계좌 미신고', '명의대여 의심',
]

export default function TaxIntakeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: intake } = useIntake(id ?? '')
  const update = useUpdateIntake()
  const approve = useApproveIntake()

  const [form, setForm] = useState<Partial<TaxIntake> | null>(null)
  const [newRisk, setNewRisk] = useState('')
  const [showRiskPresets, setShowRiskPresets] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)

  useEffect(() => {
    if (intake && !form) setForm(intake)
  }, [intake])

  if (!intake || !form) return <div className="p-6 text-gray-400 text-sm">로딩 중...</div>

  const f = form as TaxIntake
  const setF = (patch: Partial<TaxIntake>) => { setForm(prev => ({ ...prev!, ...patch })); setSaved(false) }
  const setDoc = (key: keyof IntakeDocuments, val: boolean) =>
    setF({ documents: { ...f.documents, [key]: val } })

  const receivedCount = INTAKE_DOCS.filter(d => f.documents[d.key]).length
  const allReceived = receivedCount === INTAKE_DOCS.length

  const handleSave = async () => {
    await update.mutateAsync({ id: intake.id, ...form })
    setSaved(true)
  }

  const handleApprove = async () => {
    const clientId = await approve.mutateAsync({ ...intake, ...form } as TaxIntake)
    navigate(`/tax/client/${clientId}`)
  }

  const addRisk = (text: string) => {
    if (!text.trim() || f.risk_points.includes(text.trim())) return
    setF({ risk_points: [...f.risk_points, text.trim()] })
    setNewRisk('')
    setShowRiskPresets(false)
  }
  const removeRisk = (i: number) =>
    setF({ risk_points: f.risk_points.filter((_, idx) => idx !== i) })

  const inputClass = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400'

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
          <button onClick={() => navigate('/tax')} className="hover:text-emerald-600">세무대리</button>
          <span>/</span>
          <button onClick={() => navigate('/tax/intake')} className="hover:text-emerald-600">신규 접수함</button>
          <span>/</span>
          <span className="text-gray-600">{intake.client_name ?? '미입력'}</span>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{f.client_name ?? '거래처명 미입력'}</h1>
            <select
              value={f.status}
              onChange={e => setF({ status: e.target.value as TaxIntake['status'] })}
              className={`text-[10px] px-2 py-1 rounded font-medium border-0 focus:outline-none cursor-pointer ${INTAKE_STATUS_COLOR[f.status]}`}
            >
              {STATUSES.map(s => <option key={s} value={s}>{INTAKE_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-[10px] text-emerald-600">✓ 저장됨</span>}
            <button
              onClick={handleSave}
              disabled={update.isPending}
              className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              {update.isPending ? '저장 중...' : '저장'}
            </button>
            {f.status !== 'approved' && !confirmApprove && (
              <button
                onClick={() => setConfirmApprove(true)}
                className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg"
              >
                거래처 생성 승인
              </button>
            )}
            {confirmApprove && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">거래처를 생성할까요?</span>
                <button
                  onClick={handleApprove}
                  disabled={approve.isPending}
                  className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg font-medium"
                >
                  {approve.isPending ? '생성 중...' : '확인'}
                </button>
                <button onClick={() => setConfirmApprove(false)} className="px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
              </div>
            )}
            {f.status === 'approved' && intake.client_id && (
              <button
                onClick={() => navigate(`/tax/client/${intake.client_id}`)}
                className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium"
              >
                거래처 보기 →
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-3xl space-y-4">

          {/* 자료 체크리스트 */}
          <Section title="자료 수집 현황">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500">{receivedCount} / {INTAKE_DOCS.length} 수집</span>
              {allReceived && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                  <CheckCircle2 size={10} /> 자료 완비
                </span>
              )}
            </div>
            <div className="space-y-2">
              {INTAKE_DOCS.map(d => (
                <label key={d.key} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={!!f.documents[d.key]}
                    onChange={e => setDoc(d.key, e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span className={`text-sm ${f.documents[d.key] ? 'text-gray-700' : 'text-gray-400'}`}>{d.label}</span>
                  {f.documents[d.key] && <CheckCircle2 size={12} className="text-emerald-400" />}
                </label>
              ))}
            </div>
          </Section>

          {/* 기본 정보 */}
          <Section title="기본 정보">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="거래처명 (임시)">
                <input value={f.client_name ?? ''} onChange={e => setF({ client_name: e.target.value })} className={inputClass} />
              </Field>
              <Field label="접수 경로">
                <select value={f.source ?? ''} onChange={e => setF({ source: e.target.value })} className={inputClass}>
                  <option value="">선택</option>
                  {INTAKE_SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="대표자">
                <input value={f.representative ?? ''} onChange={e => setF({ representative: e.target.value })} className={inputClass} />
              </Field>
              <Field label="사업자등록번호">
                <input value={f.business_number ?? ''} onChange={e => setF({ business_number: e.target.value })} placeholder="000-00-00000" className={inputClass} />
              </Field>
              <Field label="연락처">
                <input value={f.phone ?? ''} onChange={e => setF({ phone: e.target.value })} className={inputClass} />
              </Field>
              <Field label="이메일">
                <input value={f.email ?? ''} onChange={e => setF({ email: e.target.value })} className={inputClass} />
              </Field>
              <Field label="주소" className="sm:col-span-2">
                <input value={f.address ?? ''} onChange={e => setF({ address: e.target.value })} className={inputClass} />
              </Field>
            </div>
          </Section>

          {/* 세무 정보 */}
          <Section title="세무 정보">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="거래처 유형">
                <select value={f.entity_type ?? ''} onChange={e => setF({ entity_type: e.target.value })} className={inputClass}>
                  <option value="">선택</option>
                  {ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="부가세 유형">
                <select value={f.tax_type ?? ''} onChange={e => setF({ tax_type: e.target.value })} className={inputClass}>
                  <option value="">선택</option>
                  {TAX_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="서비스 구분">
                <select value={f.service_detail ?? ''} onChange={e => setF({ service_detail: e.target.value })} className={inputClass}>
                  <option value="">선택</option>
                  {SERVICE_DETAILS.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="기장료 (원)">
                <input type="number" value={f.bookkeeping_fee ?? ''} onChange={e => setF({ bookkeeping_fee: e.target.value ? +e.target.value : null })} className={inputClass} />
              </Field>
              <Field label="출금일">
                <input type="number" min={1} max={31} value={f.withdrawal_day ?? ''} onChange={e => setF({ withdrawal_day: e.target.value ? +e.target.value : null })} placeholder="일" className={inputClass} />
              </Field>
              <Field label="계좌 정보">
                <input value={f.bank_info ?? ''} onChange={e => setF({ bank_info: e.target.value })} placeholder="은행 계좌번호" className={inputClass} />
              </Field>
            </div>
          </Section>

          {/* 리스크 포인트 */}
          <Section title="리스크 포인트">
            <div className="space-y-2 mb-3">
              {f.risk_points.length === 0 ? (
                <p className="text-xs text-gray-400">등록된 리스크가 없습니다</p>
              ) : (
                f.risk_points.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <AlertTriangle size={12} className="text-red-400 shrink-0" />
                    <span className="text-sm text-red-700 flex-1">{r}</span>
                    <button onClick={() => removeRisk(i)} className="text-red-300 hover:text-red-500">
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="relative">
              <div className="flex gap-2">
                <input
                  value={newRisk}
                  onChange={e => setNewRisk(e.target.value)}
                  onFocus={() => setShowRiskPresets(true)}
                  onKeyDown={e => e.key === 'Enter' && addRisk(newRisk)}
                  placeholder="리스크 항목 입력..."
                  className={inputClass}
                />
                <button
                  onClick={() => addRisk(newRisk)}
                  className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium whitespace-nowrap"
                >
                  <Plus size={12} />
                </button>
              </div>
              {showRiskPresets && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowRiskPresets(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    {RISK_PRESETS.filter(r => !f.risk_points.includes(r)).map(r => (
                      <button
                        key={r}
                        onMouseDown={() => addRisk(r)}
                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-red-50 hover:text-red-600"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* 메모 / 상담 내용 */}
          <Section title="메모 / 상담 내용">
            <textarea
              value={f.notes ?? ''}
              onChange={e => setF({ notes: e.target.value })}
              rows={5}
              placeholder="다울 코멘트, 상담 메모, 특이사항 등"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
            />
          </Section>

          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {update.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[10px] text-gray-500 mb-1 block">{label}</label>
      {children}
    </div>
  )
}
