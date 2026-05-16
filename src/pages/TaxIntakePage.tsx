import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileText, Plus } from 'lucide-react'
import {
  useIntakes, useCreateIntake,
  INTAKE_STATUS_LABEL, INTAKE_STATUS_COLOR, INTAKE_DOCS, INTAKE_SOURCES,
  type TaxIntake,
} from '../hooks/useIntakes'

const STATUS_FILTERS: Array<TaxIntake['status'] | 'all'> = ['all', 'receiving', 'reviewing', 'approved', 'rejected']
const STATUS_FILTER_LABEL: Record<string, string> = { all: '전체', receiving: '접수중', reviewing: '검토중', approved: '승인완료', rejected: '거절' }

export default function TaxIntakePage() {
  const navigate = useNavigate()
  const { data: intakes = [] } = useIntakes()
  const create = useCreateIntake()
  const [statusFilter, setStatusFilter] = useState<TaxIntake['status'] | 'all'>('all')
  const [creating, setCreating] = useState(false)  // 직접 입력용 fallback
  const [newName, setNewName] = useState('')
  const [newSource, setNewSource] = useState('다울')

  const filtered = intakes.filter(i => statusFilter === 'all' || i.status === statusFilter)

  const handleCreate = async () => {
    if (!newName.trim()) return
    const intake = await create.mutateAsync({ client_name: newName.trim(), source: newSource })
    setCreating(false)
    setNewName('')
    navigate(`/tax/intake/${intake.id}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <button onClick={() => navigate('/tax')} className="hover:text-emerald-600">세무대리</button>
              <span>/</span>
              <span className="text-gray-600">신규 접수함</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">신규 접수함</h1>
            <p className="text-xs text-gray-400 mt-0.5">신규 세무대리 거래처 온보딩 · 자료 수집 · AI 정보 추출 · 거래처 생성</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/tax/intake/new')}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={15} />
              신규 접수 (파일 업로드)
            </button>
            <button
              onClick={() => setCreating(true)}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2"
              title="파일 없이 직접 입력"
            >
              직접 입력
            </button>
          </div>
        </div>

        {/* 상태 필터 */}
        <div className="flex gap-1.5 mt-3">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {STATUS_FILTER_LABEL[s]}
              {s !== 'all' && intakes.filter(i => i.status === s).length > 0 && (
                ` (${intakes.filter(i => i.status === s).length})`
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {/* 신규 접수 생성 폼 */}
        {creating && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-4 max-w-lg">
            <p className="text-xs font-semibold text-emerald-700 mb-3">신규 접수 생성</p>
            <div className="flex gap-2 mb-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="거래처명 (임시)"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <select
                value={newSource}
                onChange={e => setNewSource(e.target.value)}
                className="px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                {INTAKE_SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || create.isPending}
                className="px-4 py-1.5 text-xs bg-emerald-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                생성
              </button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText size={32} className="text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">접수된 건이 없습니다</p>
            <button onClick={() => setCreating(true)} className="mt-2 text-xs text-emerald-600 hover:underline">
              + 신규 접수 생성하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 max-w-6xl">
            {filtered.map(intake => <IntakeCard key={intake.id} intake={intake} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function IntakeCard({ intake }: { intake: TaxIntake }) {
  const navigate = useNavigate()
  const receivedCount = INTAKE_DOCS.filter(d => intake.documents[d.key]).length
  const missingCount = INTAKE_DOCS.length - receivedCount

  return (
    <div
      onClick={() => navigate(`/tax/intake/${intake.id}`)}
      className="bg-white rounded-xl border border-gray-200 hover:border-emerald-300 hover:shadow-md cursor-pointer transition-all group"
    >
      <div className="px-4 pt-4 pb-3 border-b border-gray-50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${INTAKE_STATUS_COLOR[intake.status]}`}>
                {INTAKE_STATUS_LABEL[intake.status]}
              </span>
              {intake.source && (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{intake.source}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{intake.client_name ?? '거래처명 미입력'}</p>
            {intake.representative && (
              <p className="text-xs text-gray-400 mt-0.5">{intake.representative}</p>
            )}
          </div>
          <span className="text-xs text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0 pt-0.5">→</span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {/* 자료 현황 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gray-400 font-medium">자료 수집</span>
            <span className="text-[10px] text-gray-400">{receivedCount}/{INTAKE_DOCS.length}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {INTAKE_DOCS.map(d => (
              <span
                key={d.key}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  intake.documents[d.key]
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-gray-50 text-gray-300'
                }`}
              >
                {intake.documents[d.key] ? '✓' : '○'} {d.label}
              </span>
            ))}
          </div>
        </div>

        {/* 추출 정보 미리보기 */}
        {(intake.business_number || intake.service_detail || intake.bookkeeping_fee) && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {intake.business_number && <span className="text-[10px] text-gray-500 font-mono">{intake.business_number}</span>}
            {intake.service_detail && <span className="text-[10px] text-gray-500">{intake.service_detail}</span>}
            {intake.bookkeeping_fee && <span className="text-[10px] text-gray-500">기장료 {intake.bookkeeping_fee.toLocaleString()}원</span>}
          </div>
        )}

        {/* 리스크 포인트 */}
        {intake.risk_points.length > 0 && (
          <div className="flex items-start gap-1">
            <AlertTriangle size={10} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {intake.risk_points.map((r, i) => (
                <span key={i} className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{r}</span>
              ))}
            </div>
          </div>
        )}

        {/* 다음 액션 */}
        {intake.status === 'reviewing' && missingCount === 0 && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-600">
            <CheckCircle2 size={10} />
            <span>자료 완비 — 거래처 생성 승인 가능</span>
          </div>
        )}

        <p className="text-[10px] text-gray-300">{new Date(intake.created_at).toLocaleDateString('ko-KR')}</p>
      </div>
    </div>
  )
}
