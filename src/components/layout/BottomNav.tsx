import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useReviewBadges } from '../../hooks/useReviewBadges'

const mainItems = [
  { to: '/',         short: '홈' },
  { to: '/memo',     short: '메모' },
  { to: '/clients',  short: '거래처', badgeKey: 'clients'  as const },
  { to: '/projects', short: '프로젝트', badgeKey: 'projects' as const },
  { to: '/tax',      short: '세무대리' },
]

const moreItems = [
  { to: '/contacts',  label: 'N-CRM',    emoji: '👥' },
  { to: '/calendar',  label: '캘린더',    emoji: '📅' },
  { to: '/todos',     label: 'Follow-up', emoji: '✓' },
  { to: '/deadlines', label: '마감 기한',  emoji: '⏰' },
  { to: '/habits',    label: '습관 루틴',  emoji: '🔁' },
  { to: '/profile',   label: '내 정보',   emoji: '👤' },
]

export default function BottomNav() {
  const { data: badges } = useReviewBadges()
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      {showMore && (
        <>
          <div className="lg:hidden fixed inset-0 z-40" onClick={() => setShowMore(false)} />
          <div className="lg:hidden fixed inset-x-0 bottom-16 z-50 bg-white border-t border-gray-200 shadow-lg pb-2 rounded-t-2xl">
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-8 h-1 rounded-full bg-gray-200" />
            </div>
            {moreItems.map(item => (
              <button
                key={item.to}
                onClick={() => { navigate(item.to); setShowMore(false) }}
                className="w-full flex items-center gap-3 px-6 py-3.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="text-base">{item.emoji}</span>
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-6 h-16">
          {mainItems.map(item => {
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
                    {showBadge && <span className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-red-500" />}
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                    <span className="leading-none whitespace-nowrap">{item.short}</span>
                  </>
                )}
              </NavLink>
            )
          })}
          <button
            onClick={() => setShowMore(v => !v)}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] transition-colors ${showMore ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <span className="flex gap-0.5">
              {[0,1,2].map(i => <span key={i} className={`h-1 w-1 rounded-full ${showMore ? 'bg-indigo-600' : 'bg-gray-300'}`} />)}
            </span>
            <span className="leading-none">더보기</span>
          </button>
        </div>
      </nav>
    </>
  )
}
