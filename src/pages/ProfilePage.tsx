import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useProfile, useUpdatePassword, useDeleteAccount } from '../hooks/useProfile'

function buildVCard(name: string, role: string, company: string, phone: string, email: string) {
  return [
    'BEGIN:VCARD', 'VERSION:3.0',
    `FN:${name}`,
    company ? `ORG:${company}` : '',
    role    ? `TITLE:${role}` : '',
    phone   ? `TEL;TYPE=CELL:${phone}` : '',
    email   ? `EMAIL:${email}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\n')
}

function downloadVCard(name: string, role: string, company: string, phone: string, email: string) {
  const blob = new Blob([buildVCard(name, role, company, phone, email)], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${name || '내명함'}.vcf`; a.click()
  URL.revokeObjectURL(url)
}

function toKoreanError(message: string): string {
  if (/rate.limit|too many/i.test(message))      return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  if (/invalid.*credentials|invalid login/i.test(message)) return '현재 비밀번호가 올바르지 않습니다.'
  if (/same.*password|already used/i.test(message)) return '현재 비밀번호와 다른 비밀번호를 입력해 주세요.'
  if (/network|fetch/i.test(message))            return '네트워크 연결을 확인해 주세요.'
  return message
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      {children}
    </div>
  )
}

// ── 내 명함 ────────────────────────────────────────────────────────────────────
function BusinessCard() {
  const { data: profile } = useProfile()
  const [showQR, setShowQR] = useState(false)

  const name    = profile?.full_name ?? ''
  const role    = profile?.role      ?? ''
  const company = profile?.company   ?? ''
  const phone   = profile?.phone     ?? ''
  const email   = profile?.email     ?? ''
  const hasInfo = !!(name || phone || email)

  const qrData = encodeURIComponent(buildVCard(name, role, company, phone, email))

  return (
    <SectionCard title="내 명함">
      {hasInfo ? (
        <div className="bg-indigo-600 rounded-xl p-4 text-white">
          <p className="text-lg font-bold">{name || '이름 없음'}</p>
          {role    && <p className="text-sm text-indigo-200 mt-0.5">{role}</p>}
          {company && <p className="text-sm text-indigo-200">{company}</p>}
          <div className="mt-3 space-y-0.5">
            {phone && <p className="text-sm">📞 {phone}</p>}
            {email && <p className="text-sm">✉ {email}</p>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400">이름, 전화번호, 이메일을 입력하면 명함이 표시됩니다.</p>
      )}

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

      <div className="flex gap-2">
        <button
          onClick={() => downloadVCard(name, role, company, phone, email)}
          disabled={!hasInfo}
          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          📥 vCard 저장
        </button>
        <button
          onClick={() => setShowQR(v => !v)}
          disabled={!hasInfo}
          className="flex-1 py-2 border border-gray-200 hover:bg-gray-50 disabled:text-gray-300 text-gray-600 text-sm rounded-lg transition-colors"
        >
          {showQR ? 'QR 닫기' : '📷 QR 코드'}
        </button>
      </div>
      <p className="text-xs text-gray-300">이름·직책·전화번호는 위 '내 정보'에서 확인하세요.</p>
    </SectionCard>
  )
}

// ── 프로필 읽기 전용 표시 ───────────────────────────────────────────────────────
function ProfileDisplay() {
  const { data: profile, isLoading } = useProfile()

  if (isLoading) return (
    <SectionCard title="내 정보">
      <p className="text-sm text-gray-400">불러오는 중...</p>
    </SectionCard>
  )

  const rows = [
    { label: '이름',     value: profile?.full_name },
    { label: '회사/소속', value: profile?.company   },
    { label: '직책',     value: profile?.role       },
    { label: '전화번호', value: profile?.phone      },
    { label: '이메일',   value: profile?.email      },
  ]

  return (
    <SectionCard title="내 정보">
      {/* 아바타 + 로그인 방식 */}
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-gray-100" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-semibold">
            {(profile?.full_name ?? profile?.email ?? '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{profile?.full_name ?? profile?.email?.split('@')[0]}</p>
          {profile?.provider && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              {profile.provider === 'google' ? '🅖 Google 계정으로 로그인' : `${profile.provider} 계정으로 로그인`}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center gap-4">
            <span className="text-xs text-gray-400 w-20 shrink-0">{label}</span>
            <span className="text-sm text-gray-800">
              {value || <span className="text-gray-300">미입력</span>}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-300 pt-1">
        정보 수정은 아래 <span className="text-gray-400">내 명함</span>에서 가능합니다.
      </p>
    </SectionCard>
  )
}

// ── 비밀번호 변경 ──────────────────────────────────────────────────────────────
function PasswordSection() {
  const updatePassword = useUpdatePassword()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleChange = async () => {
    setError(null)
    if (form.next.length < 6) { setError('새 비밀번호는 6자 이상이어야 합니다.'); return }
    if (form.next !== form.confirm) { setError('새 비밀번호가 일치하지 않습니다.'); return }
    try {
      await updatePassword.mutateAsync({ currentPassword: form.current, newPassword: form.next })
      setSuccess(true)
      setForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(toKoreanError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.'))
    }
  }

  return (
    <SectionCard title="비밀번호 변경">
      <div className="space-y-3">
        <div>
          <label className={labelCls}>현재 비밀번호</label>
          <input value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
            type="password" className={inputCls} placeholder="••••••••" />
        </div>
        <div>
          <label className={labelCls}>새 비밀번호</label>
          <input value={form.next} onChange={e => setForm(f => ({ ...f, next: e.target.value }))}
            type="password" className={inputCls} placeholder="6자 이상" />
        </div>
        <div>
          <label className={labelCls}>새 비밀번호 확인</label>
          <input value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            type="password" className={inputCls} placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handleChange()} />
        </div>

        {error   && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        {success && <p className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">비밀번호가 변경되었습니다.</p>}

        <div className="flex justify-end pt-1">
          <button
            onClick={handleChange}
            disabled={!form.current || !form.next || !form.confirm || updatePassword.isPending}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {updatePassword.isPending ? '변경 중...' : '변경'}
          </button>
        </div>
      </div>
    </SectionCard>
  )
}

// ── 위험 영역 ──────────────────────────────────────────────────────────────────
// 다단계 확인으로 실수 방지:
//   Step 1: 영향 안내 화면 (취소가 기본)
//   Step 2: "탈퇴합니다" 문구 정확히 입력
//   Step 3: 비밀번호 재확인 + 3초 대기 후 버튼 활성화
const CONFIRM_PHRASE = '탈퇴합니다'
const HOLD_SECONDS = 3

function DangerZone() {
  const deleteAccount = useDeleteAccount()
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [typedPhrase, setTypedPhrase] = useState('')
  const [password, setPassword] = useState('')
  const [holdRemain, setHoldRemain] = useState(HOLD_SECONDS)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStep(0)
    setTypedPhrase('')
    setPassword('')
    setHoldRemain(HOLD_SECONDS)
    setError(null)
  }

  // Step 3 진입 시 3초 카운트다운
  useEffect(() => {
    if (step !== 3) return
    setHoldRemain(HOLD_SECONDS)
    const id = setInterval(() => {
      setHoldRemain(prev => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [step])

  const handleDelete = async () => {
    if (holdRemain > 0) return
    setError(null)
    try {
      await deleteAccount.mutateAsync(password)
      await supabase.auth.signOut()
    } catch (err) {
      setError(toKoreanError(err instanceof Error ? err.message : '탈퇴 처리에 실패했습니다.'))
    }
  }

  const phraseOk = typedPhrase.trim() === CONFIRM_PHRASE

  return (
    <>
      <SectionCard title="계정 관리">
        <div className="flex flex-col gap-3">
          <button onClick={() => supabase.auth.signOut()}
            className="w-full px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-left">
            로그아웃
          </button>
          <button onClick={() => setStep(1)}
            className="w-full px-4 py-2.5 border border-gray-200 text-gray-400 text-xs rounded-lg hover:bg-gray-50 hover:text-red-500 hover:border-red-200 transition-colors text-left">
            회원탈퇴
          </button>
        </div>
      </SectionCard>

      {/* Step 1: 안내 */}
      {step === 1 && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-base font-bold text-gray-900">정말 탈퇴하시겠습니까?</h3>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4 text-xs text-red-600 space-y-1">
              <p className="font-semibold">아래 데이터가 모두 영구 삭제됩니다:</p>
              <ul className="space-y-0.5 ml-3 list-disc">
                <li>모든 메모와 AI 분석 결과</li>
                <li>거래처 / 프로젝트 / 일정 / 할 일</li>
                <li>연락처 / 활동 로그 / 습관 기록</li>
                <li>세무대리 접수 / 수금 / 마감 데이터</li>
              </ul>
              <p className="pt-1 font-semibold">⚠️ 복구할 수 없습니다.</p>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-semibold text-gray-700">데이터를 보관하려면</span> 먼저 워크스페이스에서 백업하시거나, 잠시만 사용을 중단하시면 됩니다 (탈퇴하지 않아도 됩니다).
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={reset}
                className="flex-1 px-4 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
                취소 (권장)
              </button>
              <button onClick={() => setStep(2)}
                className="px-4 py-2.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                계속 진행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: 확인 문구 입력 */}
      {step === 2 && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">탈퇴 의사 확인</h3>
            <p className="text-sm text-gray-500 mb-4">
              아래 문구를 정확히 입력해주세요.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 mb-3 text-center">
              <code className="text-sm font-mono text-red-600 font-bold tracking-wider select-none">{CONFIRM_PHRASE}</code>
            </div>
            <input
              value={typedPhrase}
              onChange={e => setTypedPhrase(e.target.value)}
              type="text"
              autoFocus
              autoComplete="off"
              className={`${inputCls} mb-4 ${phraseOk ? 'border-red-300' : ''}`}
              placeholder={`"${CONFIRM_PHRASE}" 입력`}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={reset}
                className="flex-1 px-4 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
                취소
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!phraseOk}
                className="px-4 py-2.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: 비밀번호 + 카운트다운 */}
      {step === 3 && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">마지막 확인</h3>
            <p className="text-sm text-gray-500 mb-4">비밀번호를 입력하고 {HOLD_SECONDS}초 후 탈퇴할 수 있습니다.</p>
            <label className={labelCls}>비밀번호</label>
            <input value={password} onChange={e => setPassword(e.target.value)}
              type="password" autoFocus className={`${inputCls} mb-3`} placeholder="현재 비밀번호" />
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={reset}
                className="flex-1 px-4 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
                취소 (권장)
              </button>
              <button
                onClick={handleDelete}
                disabled={!password || deleteAccount.isPending || holdRemain > 0}
                className="px-4 py-2.5 text-xs bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {deleteAccount.isPending
                  ? '처리 중...'
                  : holdRemain > 0
                    ? `${holdRemain}초 후 탈퇴 가능`
                    : '영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-4">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-gray-900">내 정보 / 계정설정</h1>
      </div>
      <ProfileDisplay />
      <BusinessCard />
      <PasswordSection />
      <DangerZone />
    </div>
  )
}
