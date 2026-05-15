import { supabase } from '../../lib/supabase'

interface Props {
  title: string
}

export default function Header({ title }: Props) {
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

      {/* 모바일: 로그아웃 버튼 */}
      <button
        onClick={() => supabase.auth.signOut()}
        className="ml-auto lg:hidden text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg"
      >
        로그아웃
      </button>
    </header>
  )
}
