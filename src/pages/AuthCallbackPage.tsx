import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let settled = false

    const succeed = () => {
      if (settled) return
      settled = true
      console.log('[auth/callback] session confirmed, redirecting to /')
      navigate('/', { replace: true })
    }

    const fail = (reason?: string) => {
      if (settled) return
      settled = true
      console.error('[auth/callback] failed:', reason)
      setError('이메일 인증에 실패했습니다. 링크가 만료됐거나 이미 사용된 링크입니다.')
    }

    // 1) auth 상태 변화 구독 — PKCE/implicit 모두 세션 확정 시 여기서 잡힘
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[auth/callback] onAuthStateChange:', event)
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
        succeed()
      }
    })

    // 2) PKCE flow: URL에 ?code= 가 있으면 코드 교환 필요
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      console.log('[auth/callback] PKCE code found, exchanging...')
      supabase.auth.exchangeCodeForSession(code).then(({ error: err }) => {
        if (err) fail(err.message)
        // 성공 시 onAuthStateChange가 SIGNED_IN을 발생시켜 succeed() 호출
      })
    } else {
      // 3) implicit flow: Supabase 클라이언트가 hash를 자동 처리했는지 확인
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) succeed()
        // 없으면 onAuthStateChange 이벤트를 계속 기다림
      })
    }

    // 10초 타임아웃
    const timeout = setTimeout(() => fail('timeout'), 10_000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-base font-bold text-gray-900 mb-2">인증 실패</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <a href="/login" className="text-sm text-indigo-600 hover:underline">로그인 화면으로</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-400 animate-pulse">인증 처리 중...</p>
    </div>
  )
}
