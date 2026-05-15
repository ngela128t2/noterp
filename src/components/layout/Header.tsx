interface Props {
  title: string
}

export default function Header({ title }: Props) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 lg:sticky lg:top-0 z-30">
      <span className="text-xl font-bold text-gray-300">Noterp</span>
      <span className="text-sm text-gray-400">/ {title}</span>
      <span
        className="ml-auto text-gray-400 select-none"
        style={{ fontFamily: "'Dancing Script', cursive", fontSize: '1.15rem', letterSpacing: '0.01em' }}
      >
        Note everything, Not just ERP.
      </span>
    </header>
  )
}
