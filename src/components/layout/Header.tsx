import { Menu, UserCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Props {
  title: string
  onMenuClick?: () => void
}

export default function Header({ title, onMenuClick }: Props) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 lg:sticky lg:top-0 z-30">
      {/* 모바일 햄버거 */}
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

      {/* 모바일: 프로필 아이콘 */}
      <Link to="/profile" className="ml-auto lg:hidden p-1 text-gray-400 hover:text-indigo-600 transition-colors">
        <UserCircle size={22} />
      </Link>
    </header>
  )
}
