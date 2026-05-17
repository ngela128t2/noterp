import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  PenLine,
  Building2,
  FolderKanban,
  CalendarDays,
  RefreshCw,
  Clock,
  Users,
  Search,
  LogOut,
  Calculator,
  Repeat,
  Shield,
} from 'lucide-react'
import { useReviewBadges } from '../../hooks/useReviewBadges'
import { useIsAdmin } from '../../hooks/useProfile'
import { supabase } from '../../lib/supabase'

// 핵심 — 항상 상단 노출
const primaryNav = [
  { to: '/memo',     Icon: PenLine,      label: '메모' },
  { to: '/clients',  Icon: Building2,    label: '거래처',   badgeKey: 'clients'  as const },
  { to: '/projects', Icon: FolderKanban, label: '프로젝트', badgeKey: 'projects' as const },
]

// 보조 — 작게 표시
const secondaryNav = [
  { to: '/calendar',  Icon: CalendarDays, label: '캘린더' },
  { to: '/contacts',  Icon: Users,        label: 'N-CRM',  badgeKey: 'contacts' as const },
  { to: '/todos',     Icon: RefreshCw,    label: 'Follow-up' },
  { to: '/deadlines', Icon: Clock,        label: '마감' },
  { to: '/habits',    Icon: Repeat,       label: '습관' },
]

interface Props {
  open: boolean
  onClose: () => void
  onSearchOpen: () => void
}

export default function Sidebar({ open, onClose, onSearchOpen }: Props) {
  const { data: badges } = useReviewBadges()
  const isAdmin = useIsAdmin()

  function NavItem({ to, Icon, label, badgeKey, secondary = false }: {
    to: string; Icon: React.ElementType; label: string
    badgeKey?: 'clients' | 'projects' | 'contacts'; secondary?: boolean
  }) {
    const showBadge = badgeKey ? (badges?.[badgeKey] ?? 0) > 0 : false
    return (
      <NavLink
        to={to}
        onClick={onClose}
        className={({ isActive }) =>
          `flex items-center gap-2.5 px-3 rounded-lg transition-colors ${
            secondary ? 'py-1.5 text-xs' : 'py-2 text-sm'
          } ${
            isActive
              ? 'bg-indigo-50 text-indigo-700 font-medium'
              : secondary
                ? 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <Icon size={secondary ? 13 : 15} className={`shrink-0 ${isActive ? 'text-indigo-600' : secondary ? 'text-gray-300' : 'text-gray-400'}`} />
            <span className="flex-1">{label}</span>
            {showBadge && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
          </>
        )}
      </NavLink>
    )
  }

  return (
    <>
      {open && <div className="lg:hidden fixed inset-0 bg-black/20 z-40" onClick={onClose} />}

      <aside className={`
        bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-200
        ${open
          ? 'fixed inset-y-0 left-0 z-50 w-52 h-screen lg:sticky lg:top-0 lg:inset-auto lg:z-auto lg:shrink-0'
          : 'w-0 lg:w-52 lg:sticky lg:top-0 lg:shrink-0 lg:h-screen'
        }
      `}>
        {/* 로고 */}
        <div className="px-5 py-5 border-b border-gray-100 w-52 shrink-0">
          <Link to="/" className="text-2xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors">Noterp</Link>
        </div>

        <nav className="flex-1 px-3 py-4 w-52 overflow-y-auto flex flex-col gap-0.5">
          {/* Workspace */}
          <NavLink
            to="/" end onClick={onClose}
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors mb-1 ${
                isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
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
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 border border-gray-200 mb-1"
          >
            <Search size={14} className="text-gray-400 shrink-0" />
            <span className="flex-1 text-left">검색</span>
            <kbd className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">⌘K</kbd>
          </button>

          {/* Primary */}
          {primaryNav.map(item => <NavItem key={item.to} {...item} />)}

          {/* Divider */}
          <div className="my-2 border-t border-gray-100" />

          {/* Secondary */}
          {secondaryNav.map(item => <NavItem key={item.to} {...item} secondary />)}

          {/* Admin — admin 권한 시에만 노출 */}
          {isAdmin && (
            <>
              <div className="my-2 border-t border-gray-100" />
              <NavLink
                to="/admin"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-500 hover:bg-indigo-50/50 hover:text-indigo-600'
                  }`
                }
              >
                <Shield size={13} className="shrink-0 text-indigo-400" />
                <span className="flex-1">관리자</span>
                <span className="text-[9px] px-1 py-0.5 bg-indigo-100 text-indigo-600 rounded">ADMIN</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* 하단 */}
        <div className="px-3 py-4 border-t border-gray-100 w-52 shrink-0 space-y-0.5">
          <NavLink
            to="/tax" onClick={onClose}
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
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
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
          >
            <LogOut size={15} className="text-gray-400 shrink-0" />
            <span>로그아웃</span>
          </button>
        </div>
      </aside>
    </>
  )
}
