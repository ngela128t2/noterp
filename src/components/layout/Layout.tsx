import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import MemoFab from '../ui/MemoFab'
import BottomNav from './BottomNav'
import Header from './Header'
import Sidebar from './Sidebar'

const PAGE_TITLE: Record<string, string> = {
  '/': '대시보드',
  '/memo': '메모 입력',
  '/clients': '거래처',
  '/projects': '프로젝트',
  '/calendar': '캘린더',
  '/todos': '할 일',
  '/contacts': 'N-CRM',
  '/settings': '설정',
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = PAGE_TITLE[location.pathname] ?? ''

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(prev => !prev)} title={title} />
        <main className="flex-1 overflow-auto pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>
      <MemoFab />
      <BottomNav />
    </div>
  )
}
