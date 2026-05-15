import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setEmailSent(true)
    }
    setLoading(false)
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
          <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
            className="ml-1 text-blue-600 hover:underline font-medium"
          >
            {mode === 'login' ? '회원가입' : '로그인'}
          </button>
        </p>
      </div>
      </div>
    </div>
  )
}
