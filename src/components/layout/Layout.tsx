import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import GlobalSearchModal from '../search/GlobalSearchModal'
import MemoFab from '../ui/MemoFab'
import Header from './Header'
import Sidebar from './Sidebar'

const PAGE_TITLE: Record<string, string> = {
  '/': '대시보드',
  '/memo': '메모 입력',
  '/clients': '거래처',
  '/projects': '프로젝트',
  '/calendar': '캘린더',
  '/todos': 'Follow-up',
  '/contacts': 'N-CRM',
  '/billing': '수금 관리',
  '/deadlines': '마감 기한',
  '/tax': '세무대리',
  '/settings': '설정',
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const title = PAGE_TITLE[location.pathname] ?? ''

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSearchOpen={() => setSearchOpen(true)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <MemoFab />
      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
