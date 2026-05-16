import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import ErrorBoundary from './components/ui/ErrorBoundary'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import MemoPage from './pages/MemoPage'
import ClientsPage from './pages/ClientsPage'
import ProjectsPage from './pages/ProjectsPage'
import TodosPage from './pages/TodosPage'
import ContactsPage from './pages/ContactsPage'
import BillingPage from './pages/BillingPage'
import DeadlinesPage from './pages/DeadlinesPage'
import WorkspacePage from './pages/WorkspacePage'
import TaxAgencyPage from './pages/TaxAgencyPage'
import TaxClientPage from './pages/TaxClientPage'
import TaxIntakePage from './pages/TaxIntakePage'
import TaxIntakeDetailPage from './pages/TaxIntakeDetailPage'

// FullCalendar는 무거우므로 lazy load
const CalendarPage = lazy(() => import('./pages/CalendarPage'))

// #6: staleTime 5분 — 포커스마다 refetch 방지
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      retry: 1,
    },
  },
})

function AuthGuard({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">로딩 중...</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route
            path="/"
            element={
              <AuthGuard session={session}>
                <Layout />
              </AuthGuard>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="memo" element={<MemoPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="calendar" element={<Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-gray-400">캘린더 로딩 중...</div>}><CalendarPage /></Suspense>} />
            <Route path="todos" element={<TodosPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="deadlines" element={<DeadlinesPage />} />
            <Route path="workspace/:type/:id" element={<WorkspacePage />} />
            <Route path="tax" element={<TaxAgencyPage />} />
            <Route path="tax/intake" element={<TaxIntakePage />} />
            <Route path="tax/intake/:id" element={<TaxIntakeDetailPage />} />
            <Route path="tax/client/:id" element={<TaxClientPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  )
}
