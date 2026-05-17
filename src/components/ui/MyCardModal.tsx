import { useEffect, useState } from 'react'
import { useProfile, useUpdateProfile } from '../../hooks/useProfile'

function buildVCard(name: string, title: string, company: string, phone: string, email: string) {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    company ? `ORG:${company}` : '',
    title   ? `TITLE:${title}` : '',
    phone   ? `TEL;TYPE=CELL:${phone}` : '',
    email   ? `EMAIL:${email}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\n')
}

function downloadVCard(name: string, title: string, company: string, phone: string, email: string) {
  const blob = new Blob([buildVCard(name, title, company, phone, email)], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name || '내명함'}.vcf`
  a.click()
  URL.revokeObjectURL(url)
}

const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

interface Props { onClose: () => void }

export default function MyCardModal({ onClose }: Props) {
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()

  const [editing, setEditing] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [form, setForm] = useState({ name: '', role: '', company: '', phone: '' })
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    const filled = { name: profile.full_name ?? '', role: profile.role ?? '', company: profile.company ?? '', phone: profile.phone ?? '' }
    setForm(filled)
    // 이름이 없으면 편집 모드로 시작
    if (!profile.full_name) setEditing(true)
  }, [profile])

  const hasInfo = !!(form.name || form.phone || profile?.email)

  const handleSave = async () => {
    setSaveError(null)
    try {
      await updateProfile.mutateAsync({
        full_name: form.name || null,
        role:      form.role    || null,
        company:   form.company || null,
        phone:     form.phone   || null,
      })
      setEditing(false)
    } catch {
      setSaveError('저장에 실패했습니다. 다시 시도해 주세요.')
    }
  }

  const qrData = encodeURIComponent(
    buildVCard(form.name, form.role, form.company, form.phone, profile?.email ?? '')
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">내 명함</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {isLoading && <p className="text-sm text-gray-400 text-center py-4">불러오는 중...</p>}

          {/* 카드 미리보기 */}
          {!isLoading && hasInfo && !editing && (
            <div className="bg-indigo-600 rounded-xl p-4 text-white">
              <p className="text-lg font-bold">{form.name || '이름 없음'}</p>
              {form.role    && <p className="text-sm text-indigo-200 mt-0.5">{form.role}</p>}
              {form.company && <p className="text-sm text-indigo-200">{form.company}</p>}
              <div className="mt-3 space-y-0.5">
                {form.phone        && <p className="text-sm">📞 {form.phone}</p>}
                {profile?.email    && <p className="text-sm">✉ {profile.email}</p>}
              </div>
            </div>
          )}

          {/* 편집 폼 */}
          {!isLoading && editing && (
            <div className="space-y-2.5">
              {[
                { key: 'name',    label: '이름',     placeholder: '홍길동' },
                { key: 'role',    label: '직함/직책', placeholder: '세무사 / 회계사' },
                { key: 'company', label: '회사',     placeholder: '회계법인 OO' },
                { key: 'phone',   label: '전화',     placeholder: '010-0000-0000' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={inputClass}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">이메일</label>
                <input value={profile?.email ?? ''} readOnly className={`${inputClass} bg-gray-50 text-gray-400 cursor-default`} />
                <p className="text-[10px] text-gray-300 mt-0.5">이메일은 계정 설정에서 변경 가능합니다</p>
              </div>
              {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}
              <button
                onClick={handleSave}
                disabled={updateProfile.isPending}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {updateProfile.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          )}

          {/* QR 코드 */}
          {showQR && hasInfo && (
            <div className="flex flex-col items-center gap-2">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`}
                alt="QR 코드"
                className="w-40 h-40 rounded-lg border border-gray-200"
              />
              <p className="text-xs text-gray-400">스캔하면 연락처에 바로 저장됩니다</p>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        {!isLoading && !editing && (
          <div className="px-5 pb-5 flex flex-col gap-2">
            <button
              onClick={() => downloadVCard(form.name, form.role, form.company, form.phone, profile?.email ?? '')}
              disabled={!hasInfo}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              📥 vCard 저장 (카톡·문자로 보내기)
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setShowQR(v => !v)}
                disabled={!hasInfo}
                className="flex-1 py-2 border border-gray-200 hover:bg-gray-50 disabled:text-gray-300 text-gray-600 text-sm rounded-lg transition-colors"
              >
                {showQR ? 'QR 닫기' : '📷 QR 코드'}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex-1 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm rounded-lg transition-colors"
              >
                ✏️ 수정
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
