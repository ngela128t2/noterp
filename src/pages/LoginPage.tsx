import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const SIGNUP_COOLDOWN_MS = 60_000

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400'

function toKoreanError(message: string): string {
  if (/rate.limit|too many/i.test(message))   return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  if (/already registered|already been/i.test(message)) return '이미 가입된 이메일입니다. 로그인해 주세요.'
  if (/invalid.*credentials|invalid login/i.test(message)) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (/email not confirmed/i.test(message))   return '이메일 인증이 필요합니다. 메일함을 확인해 주세요.'
  if (/password.*characters|weak password|at least/i.test(message)) return '비밀번호는 6자 이상이어야 합니다.'
  if (/user not found/i.test(message))        return '등록되지 않은 이메일입니다.'
  if (/network|fetch|connection/i.test(message)) return '네트워크 연결을 확인해 주세요.'
  return message
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [emailSent, setEmailSent] = useState(false)

  const submittingRef = useRef(false)
  const lastSignupRef = useRef<number>(0)

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(toKoreanError(error.message)); setGoogleLoading(false) }
    // 성공 시 구글 페이지로 리다이렉트 → 돌아오면 AuthCallbackPage 처리
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError(null)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError(toKoreanError(error.message))

      } else {
        if (!fullName.trim()) { setError('이름을 입력해 주세요.'); return }

        const now = Date.now()
        if (now - lastSignupRef.current < SIGNUP_COOLDOWN_MS) {
          const remaining = Math.ceil((SIGNUP_COOLDOWN_MS - (now - lastSignupRef.current)) / 1000)
          setError(`이메일을 이미 발송했습니다. ${remaining}초 후에 다시 시도해 주세요.`)
          return
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              full_name: fullName.trim(),
              company:   company.trim() || null,
              role:      role.trim()    || null,
              phone:     phone.trim()   || null,
            },
          },
        })

        if (error) {
          setError(toKoreanError(error.message))
        } else {
          lastSignupRef.current = Date.now()
          setEmailSent(true)
        }
      }
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  const switchMode = () => {
    if (loading) return
    setMode(m => m === 'login' ? 'signup' : 'login')
    setError(null)
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="absolute top-5 left-6 text-base font-bold text-indigo-600">Noterp</div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm text-center">
          <div className="text-4xl mb-4">📧</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">이메일을 확인해주세요</h2>
          <p className="text-sm text-gray-500 mb-1">
            <span className="font-medium text-gray-700">{email}</span>으로
          </p>
          <p className="text-sm text-gray-500 mb-6">
            인증 링크를 보냈습니다. 메일함에서 링크를 클릭하면 로그인됩니다.
          </p>
          <button
            onClick={() => { setEmailSent(false); setMode('login') }}
            className="text-sm text-blue-600 hover:underline"
          >
            로그인 화면으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 왼쪽 브랜드 패널 — 데스크톱 전용 */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-indigo-600 px-16 py-14">
        <span className="text-2xl font-bold text-white">Noterp</span>
        <div>
          <p className="text-indigo-200 text-base leading-relaxed mb-8">
            우리의 업무는 데이터가 아니라<br />
            기억과 흐름 속에서 움직입니다.
          </p>
          <p className="text-white text-3xl leading-snug mb-2" style={{ fontFamily: "'Dancing Script', cursive" }}>
            Note Everything.
          </p>
          <p className="text-white text-3xl leading-snug mb-10" style={{ fontFamily: "'Dancing Script', cursive" }}>
            This is Not Just ERP.
          </p>
          <p className="text-indigo-200 text-sm leading-relaxed">
            NOTERP는 흩어진 기록과 맥락을 연결해<br />
            사람의 업무 흐름을 기억하는<br />
            <span className="text-white font-semibold">AI Context Operating System</span>을 만듭니다.
          </p>
        </div>
        <p className="text-indigo-400 text-xs">© 2026 Noterp</p>
      </div>

      {/* 오른쪽 폼 */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-10">
        <div className="absolute top-5 left-6 text-base font-bold text-indigo-600 lg:hidden">Noterp</div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'login' ? '로그인' : '회원가입'}
            </h1>
          </div>

          {/* 구글 로그인 */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? '연결 중...' : 'Google로 계속하기'}
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">또는</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* 회원가입 전용: 기본정보 */}
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이름 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    disabled={loading}
                    className={inputCls}
                    placeholder="홍길동"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    회사 / 소속 <span className="text-gray-300 font-normal text-xs">(선택)</span>
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    disabled={loading}
                    className={inputCls}
                    placeholder="회계법인 OO"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      직책 <span className="text-gray-300 font-normal text-xs">(선택)</span>
                    </label>
                    <input
                      type="text"
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      disabled={loading}
                      className={inputCls}
                      placeholder="세무사"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      전화번호 <span className="text-gray-300 font-normal text-xs">(선택)</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      disabled={loading}
                      className={inputCls}
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-1" />
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading}
                className={inputCls}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={loading}
                className={inputCls}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
            <button
              onClick={switchMode}
              disabled={loading}
              className="ml-1 text-blue-600 hover:underline font-medium disabled:opacity-50"
            >
              {mode === 'login' ? '회원가입' : '로그인'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
