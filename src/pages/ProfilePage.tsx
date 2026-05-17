import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useProfile, useUpdateProfile, useUpdateEmail, useUpdatePassword, useDeleteAccount } from '../hooks/useProfile'

function toKoreanError(message: string): string {
  if (/rate.limit|too many/i.test(message)) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  if (/invalid.*credentials|invalid login/i.test(message)) return '현재 비밀번호가 올바르지 않습니다.'
  if (/same.*password|already used/i.test(message)) return '현재 비밀번호와 다른 비밀번호를 입력해 주세요.'
  if (/already.*registered|already been/i.test(message)) return '이미 사용 중인 이메일입니다.'
  if (/network|fetch/i.test(message)) return '네트워크 연결을 확인해 주세요.'
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  )
}

// ── 프로필 폼 ──────────────────────────────────────────────────────────────────
function ProfileForm() {
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()

  const [form, setForm] = useState({ full_name: '', company: '', role: '', phone: '' })
  const originalRef = useRef({ full_name: '', company: '', role: '', phone: '' })
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    const initial = {
      full_name: profile.full_name ?? '',
      company: profile.company ?? '',
      role: profile.role ?? '',
      phone: profile.phone ?? '',
    }
    setForm(initial)
    originalRef.current = initial
  }, [profile])

  const dirty = JSON.stringify(form) !== JSON.stringify(originalRef.current)

  const handleSave = async () => {
    setError(null)
    setSuccess(false)
    try {
      await updateProfile.mutateAsync({
        full_name: form.full_name || null,
        company: form.company || null,
        role: form.role || null,
        phone: form.phone || null,
      })
      originalRef.current = { ...form }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(toKoreanError(err instanceof Error ? err.message : '저장에 실패했습니다.'))
    }
  }

  if (isLoading) return <p className="text-sm text-gray-400">불러오는 중...</p>

  return (
    <SectionCard title="프로필 정보">
      <Field label="이름">
        <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
          className={inputCls} placeholder="홍길동" />
      </Field>
      <Field label="회사 / 소속">
        <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
          className={inputCls} placeholder="(주)노터프" />
      </Field>
      <Field label="직책 / 역할">
        <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
          className={inputCls} placeholder="세무사, 팀장 등" />
      </Field>
      <Field label="휴대폰번호">
        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          className={inputCls} placeholder="010-0000-0000" type="tel" />
      </Field>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {success && <p className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">회원정보가 저장되었습니다.</p>}

      <div className="flex justify-end pt-1">
        <button
          onClick={handleSave}
          disabled={!dirty || updateProfile.isPending}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {updateProfile.isPending ? '저장 중...' : '저장'}
        </button>
      </div>
    </SectionCard>
  )
}

// ── 이메일 표시 + 변경 ─────────────────────────────────────────────────────────
function EmailSection() {
  const { data: profile } = useProfile()
  const updateEmail = useUpdateEmail()
  const [editing, setEditing] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    if (!newEmail.trim() || newEmail === profile?.email) return
    setError(null)
    try {
      await updateEmail.mutateAsync(newEmail.trim())
      setSent(true)
    } catch (err) {
      setError(toKoreanError(err instanceof Error ? err.message : '이메일 변경에 실패했습니다.'))
    }
  }

  return (
    <SectionCard title="계정 이메일">
      <Field label="현재 이메일">
        <input value={profile?.email ?? ''} readOnly className={`${inputCls} cursor-default`} />
      </Field>

      {!editing && !sent && (
        <button onClick={() => setEditing(true)} className="text-sm text-indigo-600 hover:underline">
          이메일 변경
        </button>
      )}

      {editing && !sent && (
        <div className="space-y-2">
          <Field label="새 이메일">
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
              className={inputCls} placeholder="new@example.com" type="email" />
          </Field>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setEditing(false); setError(null) }}
              className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">
              취소
            </button>
            <button onClick={handleSend} disabled={!newEmail.trim() || updateEmail.isPending}
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors">
              {updateEmail.isPending ? '처리 중...' : '인증 메일 발송'}
            </button>
          </div>
        </div>
      )}

      {sent && (
        <p className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
          {newEmail}으로 인증 링크를 보냈습니다. 메일함에서 확인해 주세요.
        </p>
      )}
    </SectionCard>
  )
}

// ── 비밀번호 변경 ──────────────────────────────────────────────────────────────
function PasswordSection() {
  const updatePassword = useUpdatePassword()
  const [open, setOpen] = useState(false)
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
      setTimeout(() => { setSuccess(false); setOpen(false) }, 2000)
    } catch (err) {
      setError(toKoreanError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.'))
    }
  }

  return (
    <SectionCard title="비밀번호 변경">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-sm text-indigo-600 hover:underline">
          비밀번호 변경하기
        </button>
      ) : (
        <div className="space-y-3">
          <Field label="현재 비밀번호">
            <input value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
              type="password" className={inputCls} placeholder="••••••••" />
          </Field>
          <Field label="새 비밀번호">
            <input value={form.next} onChange={e => setForm(f => ({ ...f, next: e.target.value }))}
              type="password" className={inputCls} placeholder="6자 이상" />
          </Field>
          <Field label="새 비밀번호 확인">
            <input value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              type="password" className={inputCls} placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleChange()} />
          </Field>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">비밀번호가 변경되었습니다.</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => { setOpen(false); setError(null); setForm({ current: '', next: '', confirm: '' }) }}
              className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">
              취소
            </button>
            <button onClick={handleChange} disabled={!form.current || !form.next || !form.confirm || updatePassword.isPending}
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors">
              {updatePassword.isPending ? '변경 중...' : '변경'}
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ── 위험 영역 (로그아웃 + 탈퇴) ───────────────────────────────────────────────
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
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            로그아웃
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="w-full px-4 py-2.5 border border-red-200 text-red-500 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors text-left"
          >
            회원탈퇴
          </button>
        </div>
      </SectionCard>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">정말 탈퇴하시겠습니까?</h3>
            <p className="text-sm text-gray-500 mb-4">
              모든 데이터(거래처, 프로젝트, 메모 등)가 <span className="text-red-500 font-semibold">영구적으로 삭제</span>되며 복구할 수 없습니다.
            </p>

            <label className={labelCls}>비밀번호 재확인</label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              className={`${inputCls} mb-3`}
              placeholder="현재 비밀번호 입력"
            />

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowModal(false); setPassword(''); setError(null) }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={!password || deleteAccount.isPending}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                {deleteAccount.isPending ? '처리 중...' : '탈퇴 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-4">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-gray-900">내 정보 / 계정설정</h1>
        <p className="text-xs text-gray-400 mt-0.5">프로필, 이메일, 비밀번호를 관리합니다.</p>
      </div>
      <ProfileForm />
      <EmailSection />
      <PasswordSection />
      <DangerZone />
    </div>
  )
}
