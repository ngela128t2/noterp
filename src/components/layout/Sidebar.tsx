import { NavLink } from 'react-router-dom'
import { useReviewBadges } from '../../hooks/useReviewBadges'
import { supabase } from '../../lib/supabase'

const navItems = [
  { to: '/', icon: '·', label: 'Workspace' },
  { to: '/memo', icon: '·', label: '메모 입력' },
  { to: '/clients', icon: '·', label: '거래처', badgeKey: 'clients' as const },
  { to: '/projects', icon: '·', label: '프로젝트', badgeKey: 'projects' as const },
  { to: '/calendar', icon: '·', label: '캘린더' },
  { to: '/todos', icon: '·', label: 'Follow-up' },
  { to: '/billing', icon: '·', label: '수금 관리' },
  { to: '/deadlines', icon: '·', label: '마감 기한' },
  { to: '/contacts', icon: '·', label: 'N-CRM', badgeKey: 'contacts' as const },
]

interface Props {
  open: boolean
  onClose: () => void
  onSearchOpen: () => void
}

export default function Sidebar({ open, onClose, onSearchOpen }: Props) {
  const handleLogout = () => supabase.auth.signOut()
  const { data: badges } = useReviewBadges()

  return (
    <aside className={`
      shrink-0 bg-white border-r border-gray-200 min-h-screen flex flex-col
      transition-all duration-200 overflow-hidden
      ${open ? 'w-52' : 'w-0 lg:w-52'}
    `}>
      <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between w-52">
        <span className="text-xl font-bold text-indigo-600">Noterp</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 w-52">
        <button
          onClick={onSearchOpen}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 border border-gray-200 mb-2"
        >
          <span className="text-xs text-gray-400">🔍</span>
          <span className="flex-1 text-left text-gray-500">검색</span>
          <kbd className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">⌘K</kbd>
        </button>
        {navItems.map(({ to, icon, label, badgeKey }) => {
          const showBadge = badgeKey ? (badges?.[badgeKey] ?? 0) > 0 : false
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              <span className="flex-1">{label}</span>
              {showBadge && <span className="w-2 h-2 rounded-full bg-red-500" title="메모 생성 항목 검토 필요" />}
            </NavLink>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100 space-y-0.5 w-52">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        >
          <span className="text-base">·</span>
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  )
}
