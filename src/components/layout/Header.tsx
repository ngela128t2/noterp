import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  title: string
}

export default function Header({ title }: Props) {
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null)
    })
  }, [])

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 lg:sticky lg:top-0 z-30">
      <span className="text-xl font-bold text-indigo-600 lg:text-gray-300">Noterp</span>
      <span className="text-sm text-gray-400">/ {title}</span>

      {/* 데스크톱: tagline */}
      <span
        className="ml-auto hidden lg:block text-gray-400 select-none"
        style={{ fontFamily: "'Dancing Script', cursive", fontSize: '1.15rem', letterSpacing: '0.01em' }}
      >
        Note everything, Not just ERP.
      </span>

      {/* 모바일: 사용자 ID + 로그아웃 버튼 */}
      <div className="ml-auto lg:hidden flex items-center gap-2">
        {userEmail && (
          <span className="text-[10px] text-gray-400 max-w-[120px] truncate">{userEmail}</span>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg whitespace-nowrap"
        >
          로그아웃
        </button>
      </div>
    </header>
  )
}
