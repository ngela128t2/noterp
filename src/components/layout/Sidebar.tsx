import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  PenLine,
  Building2,
  FolderKanban,
  CalendarDays,
  RefreshCw,
  Repeat,
  Clock,
  Users,
  Search,
  CreditCard,
  LogOut,
  Calculator,
} from 'lucide-react'
import { useReviewBadges } from '../../hooks/useReviewBadges'
import { supabase } from '../../lib/supabase'
import MyCardModal from '../ui/MyCardModal'

const navItems = [
  { to: '/memo',      Icon: PenLine,      label: '메모 입력' },
  { to: '/clients',   Icon: Building2,    label: '거래처',   badgeKey: 'clients'  as const },
  { to: '/projects',  Icon: FolderKanban, label: '프로젝트', badgeKey: 'projects' as const },
  { to: '/calendar',  Icon: CalendarDays, label: '캘린더' },
  { to: '/habits',    Icon: Repeat,       label: '습관 루틴' },
  { to: '/todos',     Icon: RefreshCw,    label: 'Follow-up' },
  { to: '/deadlines', Icon: Clock,        label: '마감 기한' },
  { to: '/contacts',  Icon: Users,        label: 'N-CRM',    badgeKey: 'contacts' as const },
]

interface Props {
  open: boolean
  onClose: () => void
  onSearchOpen: () => void
}

export default function Sidebar({ open, onClose, onSearchOpen }: Props) {
  const handleLogout = () => supabase.auth.signOut()
  const { data: badges } = useReviewBadges()
  const [cardOpen, setCardOpen] = useState(false)

  return (
    <>
      {/* 모바일 백드롭 */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
        />
      )}

      <aside className={`
        bg-white border-r border-gray-200 flex flex-col overflow-hidden
        transition-all duration-200
        ${open
          ? 'fixed inset-y-0 left-0 z-50 w-52 h-screen lg:sticky lg:top-0 lg:inset-auto lg:z-auto lg:shrink-0'
          : 'w-0 lg:w-52 lg:sticky lg:top-0 lg:shrink-0 lg:h-screen'
        }
      `}>
        {/* 로고 */}
        <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between w-52 shrink-0">
          <Link to="/" className="text-2xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors">Noterp</Link>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 w-52 overflow-y-auto">
          {/* Workspace 버튼 */}
          <NavLink
            to="/"
            end
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors mb-2 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <LayoutDashboard size={14} className={isActive ? 'text-white' : 'text-indigo-500'} />
                <span>Workspace</span>
              </>
            )}
          </NavLink>

          {/* 검색 */}
          <button
            onClick={onSearchOpen}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 border border-gray-200 mb-2"
          >
            <Search size={14} className="text-gray-400 shrink-0" />
            <span className="flex-1 text-left text-gray-500">검색</span>
            <kbd className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">⌘K</kbd>
          </button>

          {/* 일반 탭 */}
          {navItems.map(({ to, Icon, label, badgeKey }) => {
            const showBadge = badgeKey ? (badges?.[badgeKey] ?? 0) > 0 : false
            return (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={15} className={`shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className="flex-1">{label}</span>
                    {showBadge && <span className="w-2 h-2 rounded-full bg-red-500" title="검토 필요" />}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* 하단 고정 */}
        <div className="px-3 py-4 border-t border-gray-100 w-52 shrink-0 space-y-0.5">
          <NavLink
            to="/tax"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Calculator size={14} className={isActive ? 'text-white' : 'text-emerald-600'} />
                <span>세무대리</span>
              </>
            )}
          </NavLink>
          <div className="my-1.5 border-t border-gray-100" />
          <button
            onClick={() => setCardOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
          >
            <CreditCard size={15} className="text-gray-400 shrink-0" />
            <span>내 명함</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
          >
            <LogOut size={15} className="text-gray-400 shrink-0" />
            <span>로그아웃</span>
          </button>
        </div>

        {cardOpen && <MyCardModal onClose={() => setCardOpen(false)} />}
      </aside>
    </>
  )
}
