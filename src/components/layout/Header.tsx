interface Props {
  onMenuClick: () => void
  title: string
}

export default function Header({ onMenuClick, title }: Props) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 lg:sticky lg:top-0 z-30">
      <button
        onClick={onMenuClick}
        className="hidden lg:inline-flex p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="사이드바 열기"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <span className="text-xl font-bold text-indigo-600">Noterp</span>
      <span className="text-sm text-gray-400">/ {title}</span>
      <span
        className="ml-auto text-gray-400 select-none"
        style={{ fontFamily: "'Dancing Script', cursive", fontSize: '0.85rem', letterSpacing: '0.01em' }}
      >
        Note everything, Not just ERP.
      </span>
    </header>
  )
}
