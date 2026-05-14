import { NavLink } from 'react-router-dom'
import { useReviewBadges } from '../../hooks/useReviewBadges'

const items = [
  { to: '/', short: '홈' },
  { to: '/clients', short: '거래처', badgeKey: 'clients' as const },
  { to: '/projects', short: '프로젝트', badgeKey: 'projects' as const },
  { to: '/calendar', short: '일정' },
  { to: '/todos', short: '할 일' },
  { to: '/contacts', short: 'N-CRM', badgeKey: 'contacts' as const },
]

export default function BottomNav() {
  const { data: badges } = useReviewBadges()

  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-6 h-16">
        {items.map(item => {
          const showBadge = item.badgeKey ? (badges?.[item.badgeKey] ?? 0) > 0 : false
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-1 text-[10px] transition-colors ${
                  isActive ? 'text-indigo-600 font-semibold' : 'text-gray-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {showBadge && <span className="absolute top-3 right-4 w-2 h-2 rounded-full bg-red-500" />}
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                  <span className="leading-none whitespace-nowrap">{item.short}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
