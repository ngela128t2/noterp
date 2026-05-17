import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const SIGNUP_COOLDOWN_MS = 60_000

function toKoreanError(message: string): string {
  if (/rate.limit|too many/i.test(message))
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  if (/already registered|already been registered/i.test(message))
    return '이미 가입된 이메일입니다. 로그인해 주세요.'
  if (/invalid.*credentials|invalid login/i.test(message))
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (/email not confirmed/i.test(message))
    return '이메일 인증이 필요합니다. 메일함을 확인해 주세요.'
  if (/password.*characters|weak password|at least/i.test(message))
    return '비밀번호는 6자 이상이어야 합니다.'
  if (/user not found/i.test(message))
    return '등록되지 않은 이메일입니다.'
  if (/network|fetch|connection/i.test(message))
    return '네트워크 연결을 확인해 주세요.'
  return message
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [emailSent, setEmailSent] = useState(false)

  // 이중 제출 방지 — React state보다 빠르게 동작
  const submittingRef = useRef(false)
  // 회원가입 이메일 재전송 쿨다운
  const lastSignupRef = useRef<number>(0)

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()

    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError(null)

    try {
      if (mode === 'login') {
        console.log('[auth] login attempt:', email)
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        console.log('[auth] login result:', error ? `error: ${error.message}` : 'success')
        if (error) setError(toKoreanError(error.message))

      } else {
        const now = Date.now()
        const elapsed = now - lastSignupRef.current
        if (elapsed < SIGNUP_COOLDOWN_MS) {
          const remaining = Math.ceil((SIGNUP_COOLDOWN_MS - elapsed) / 1000)
          setError(`이메일을 이미 발송했습니다. ${remaining}초 후에 다시 시도해 주세요.`)
          return
        }

        console.log('[auth] signup attempt:', email)
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        console.log('[auth] signup result:', error ? `error: ${error.message}` : 'success')

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
          <p
            className="text-white text-3xl leading-snug mb-2"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            Note Everything.
          </p>
          <p
            className="text-white text-3xl leading-snug mb-10"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
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

      {/* 오른쪽 로그인 폼 */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6">
        <div className="absolute top-5 left-6 text-base font-bold text-indigo-600 lg:hidden">Noterp</div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'login' ? '로그인' : '회원가입'}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
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
