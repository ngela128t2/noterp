import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, UserCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Props {
  title: string
  onMenuClick?: () => void
}

export default function Header({ title, onMenuClick }: Props) {
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const name = (user?.user_metadata?.full_name as string)
        || user?.email?.split('@')[0]
        || null
      setDisplayName(name)
    })
  }, [])

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 lg:sticky lg:top-0 z-30">
      {onMenuClick && (
        <button onClick={onMenuClick} className="lg:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700">
          <Menu size={20} />
        </button>
      )}

      <span className="text-xl font-bold text-indigo-600 lg:text-gray-300">Noterp</span>
      <span className="text-sm text-gray-400">/ {title}</span>

      {/* 데스크톱: tagline */}
      <span
        className="ml-auto hidden lg:block text-gray-400 select-none"
        style={{ fontFamily: "'Dancing Script', cursive", fontSize: '1.15rem', letterSpacing: '0.01em' }}
      >
        Note everything, Not just ERP.
      </span>

      {/* 오른쪽: 이름 + 프로필 아이콘 */}
      <Link
        to="/profile"
        className="lg:ml-2 ml-auto flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 transition-colors group"
      >
        {displayName && (
          <span className="text-sm text-gray-600 group-hover:text-indigo-600 hidden sm:block">
            {displayName}
          </span>
        )}
        <UserCircle size={22} className="shrink-0" />
      </Link>
    </header>
  )
}
