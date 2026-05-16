import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { analyzeIntakeDocuments, type ExtractedIntakeInfo } from '../lib/gemini'
import { useCreateIntake, useUpdateIntake, INTAKE_SOURCES } from '../hooks/useIntakes'

const DOC_SLOTS = [
  { key: 'application',       label: '세무대리 신청서',  accept: 'image/*,.pdf' },
  { key: 'business_license',  label: '사업자등록증',    accept: 'image/*,.pdf' },
  { key: 'id_card',           label: '대표자 신분증',   accept: 'image/*,.pdf' },
  { key: 'bank_account',      label: '통장 사본',       accept: 'image/*,.pdf' },
  { key: 'consultation_memo', label: '상담 메모',       accept: 'image/*,.pdf,.txt' },
]

type UploadedFile = {
  key: string
  label: string
  file: File
  base64: string
  mimeType: string
  preview?: string
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string; preview?: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      const mimeType = file.type || 'application/octet-stream'
      const preview = file.type.startsWith('image/') ? result : undefined
      resolve({ base64, mimeType, preview })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function TaxIntakeNewPage() {
  const navigate = useNavigate()
  const createIntake = useCreateIntake()
  const updateIntake = useUpdateIntake()

  const [uploads, setUploads] = useState<Record<string, UploadedFile>>({})
  const [source, setSource] = useState('다울')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState<ExtractedIntakeInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (slotKey: string, slotLabel: string, file: File) => {
    try {
      const { base64, mimeType, preview } = await fileToBase64(file)
      setUploads(prev => ({
        ...prev,
        [slotKey]: { key: slotKey, label: slotLabel, file, base64, mimeType, preview },
      }))
      setAnalyzed(null)
    } catch {
      setError('파일 읽기 실패')
    }
  }, [])

  const removeFile = (key: string) => {
    setUploads(prev => { const next = { ...prev }; delete next[key]; return next })
    setAnalyzed(null)
  }

  const handleDrop = useCallback((slotKey: string, slotLabel: string, e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(null)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(slotKey, slotLabel, file)
  }, [handleFileSelect])

  const uploadCount = Object.keys(uploads).length

  const handleAnalyze = async () => {
    if (uploadCount === 0) return
    setAnalyzing(true)
    setError(null)
    try {
      const files = Object.values(uploads).map(u => ({
        label: u.label, base64: u.base64, mimeType: u.mimeType,
      }))
      const result = await analyzeIntakeDocuments(files)
      setAnalyzed(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 분석 실패. Gemini API 키를 확인하세요.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const documents: Record<string, boolean> = {}
      for (const key of Object.keys(uploads)) documents[key] = true

      const intake = await createIntake.mutateAsync({
        client_name: analyzed?.client_name ?? null,
        source,
      })

      if (analyzed) {
        await updateIntake.mutateAsync({
          id: intake.id,
          ...analyzed,
          bookkeeping_fee: analyzed.bookkeeping_fee ?? undefined,
          withdrawal_day: analyzed.withdrawal_day ?? undefined,
          documents,
          status: 'reviewing',
        })
      } else {
        await updateIntake.mutateAsync({ id: intake.id, documents })
      }

      navigate(`/tax/intake/${intake.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
          <button onClick={() => navigate('/tax')} className="hover:text-emerald-600">세무대리</button>
          <span>/</span>
          <button onClick={() => navigate('/tax/intake')} className="hover:text-emerald-600">신규 접수함</button>
          <span>/</span>
          <span className="text-gray-600">새 접수</span>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">신규 접수</h1>
            <p className="text-xs text-gray-400 mt-0.5">자료를 업로드하면 AI가 분석하여 정보를 자동으로 입력합니다</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              {INTAKE_SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button
              onClick={handleSave}
              disabled={saving || uploadCount === 0}
              className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? '저장 중...' : '저장 후 상세 보기 →'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 max-w-4xl">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* 자료 업로드 슬롯 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-gray-700">자료 업로드</p>
              <p className="text-xs text-gray-400 mt-0.5">이미지(JPG, PNG) 또는 PDF. 드래그하거나 클릭해서 업로드</p>
            </div>
            {uploadCount > 0 && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {analyzing
                  ? <><Loader2 size={14} className="animate-spin" /> 분석 중...</>
                  : <><FileText size={14} /> AI 분석 시작</>}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DOC_SLOTS.map(slot => {
              const uploaded = uploads[slot.key]
              return (
                <div
                  key={slot.key}
                  onDragOver={e => { e.preventDefault(); setDragOver(slot.key) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => handleDrop(slot.key, slot.label, e)}
                  className={`relative rounded-xl border-2 border-dashed transition-colors ${
                    dragOver === slot.key
                      ? 'border-emerald-400 bg-emerald-50'
                      : uploaded
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {uploaded ? (
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                          <span className="text-[10px] font-medium text-emerald-700 truncate">{slot.label}</span>
                        </div>
                        <button onClick={() => removeFile(slot.key)} className="text-gray-300 hover:text-red-400 shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {uploaded.preview ? (
                        <img src={uploaded.preview} alt={slot.label} className="w-full h-28 object-contain rounded-lg bg-white border border-gray-100" />
                      ) : (
                        <div className="flex items-center justify-center h-28 bg-white rounded-lg border border-gray-100">
                          <FileText size={24} className="text-gray-300" />
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1.5 truncate">{uploaded.file.name}</p>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 p-5 cursor-pointer min-h-[140px]">
                      <Upload size={20} className="text-gray-300" />
                      <span className="text-xs font-medium text-gray-500">{slot.label}</span>
                      <span className="text-[10px] text-gray-300">클릭 또는 드래그</span>
                      <input
                        type="file"
                        accept={slot.accept}
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) handleFileSelect(slot.key, slot.label, file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* AI 분석 결과 */}
        {analyzed && (
          <div className="bg-white rounded-xl border border-emerald-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <p className="text-sm font-semibold text-gray-700">AI 분석 완료 — 저장 시 자동 입력됩니다</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
              {[
                { label: '거래처명', value: analyzed.client_name },
                { label: '사업자번호', value: analyzed.business_number },
                { label: '대표자', value: analyzed.representative },
                { label: '연락처', value: analyzed.phone },
                { label: '이메일', value: analyzed.email },
                { label: '거래처유형', value: analyzed.entity_type },
                { label: '부가세유형', value: analyzed.tax_type },
                { label: '서비스구분', value: analyzed.service_detail },
                { label: '기장료', value: analyzed.bookkeeping_fee ? `${analyzed.bookkeeping_fee.toLocaleString()}원` : null },
                { label: '출금일', value: analyzed.withdrawal_day ? `매월 ${analyzed.withdrawal_day}일` : null },
                { label: '계좌', value: analyzed.bank_info },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className="text-sm text-gray-700 font-medium truncate">{value}</p>
                </div>
              ) : null)}
            </div>

            {analyzed.notes && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 mb-1">상담 메모</p>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{analyzed.notes}</p>
              </div>
            )}

            {analyzed.risk_points.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1 mb-2">
                  <AlertTriangle size={12} className="text-red-400" />
                  <p className="text-[10px] font-semibold text-red-500">리스크 감지</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {analyzed.risk_points.map((r, i) => (
                    <span key={i} className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{r}</span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? '저장 중...' : '접수 저장 후 상세 보기 →'}
            </button>
          </div>
        )}

        {uploadCount === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">위에서 자료를 업로드하면 AI가 자동으로 분석합니다</p>
            <p className="text-xs text-gray-300 mt-1">파일 없이도 저장 후 직접 입력 가능합니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
