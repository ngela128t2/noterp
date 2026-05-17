import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useProfile, useUpdatePassword, useDeleteAccount } from '../hooks/useProfile'

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
        정보 수정은 사이드바 <span className="text-gray-400">내 명함</span>에서 가능합니다.
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
function DangerZone() {
  const deleteAccount = useDeleteAccount()
  const [showModal, setShowModal] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setError(null)
    try {
      await deleteAccount.mutateAsync(password)
      await supabase.auth.signOut()
    } catch (err) {
      setError(toKoreanError(err instanceof Error ? err.message : '탈퇴 처리에 실패했습니다.'))
    }
  }

  return (
    <>
      <SectionCard title="계정 관리">
        <div className="flex flex-col gap-3">
          <button onClick={() => supabase.auth.signOut()}
            className="w-full px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-left">
            로그아웃
          </button>
          <button onClick={() => setShowModal(true)}
            className="w-full px-4 py-2.5 border border-red-200 text-red-500 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors text-left">
            회원탈퇴
          </button>
        </div>
      </SectionCard>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">정말 탈퇴하시겠습니까?</h3>
            <p className="text-sm text-gray-500 mb-4">
              모든 데이터가 <span className="text-red-500 font-semibold">영구 삭제</span>되며 복구할 수 없습니다.
            </p>
            <label className={labelCls}>비밀번호 재확인</label>
            <input value={password} onChange={e => setPassword(e.target.value)}
              type="password" className={`${inputCls} mb-3`} placeholder="현재 비밀번호 입력" />
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowModal(false); setPassword(''); setError(null) }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
              <button onClick={handleDelete} disabled={!password || deleteAccount.isPending}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors">
                {deleteAccount.isPending ? '처리 중...' : '탈퇴 확인'}
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
      <PasswordSection />
      <DangerZone />
    </div>
  )
}
