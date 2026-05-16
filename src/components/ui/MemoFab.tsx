import { useLocation, useNavigate } from 'react-router-dom'

export default function MemoFab() {
  const navigate = useNavigate()
  const location = useLocation()

  if (location.pathname === '/memo') return null

  return (
    <button
      onClick={() => navigate('/memo')}
      title="메모 입력"
      aria-label="메모 입력"
      className="fixed bottom-20 right-5 lg:bottom-6 lg:right-6 z-40 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z"
        />
      </svg>
    </button>
  )
}
