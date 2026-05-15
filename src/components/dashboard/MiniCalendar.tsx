import { useMemo, useState } from 'react'

interface Props {
  events: { date: string; title: string }[]
  selectedDate?: string
  onDateClick?: (date: string) => void
}

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function MiniCalendar({ events, selectedDate, onDateClick }: Props) {
  const today = new Date()
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  })

  const eventDateCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const event of events) {
      const date = new Date(event.date)
      if (date.getFullYear() === cursor.year && date.getMonth() === cursor.month) {
        counts.set(date.getDate(), (counts.get(date.getDate()) ?? 0) + 1)
      }
    }
    return counts
  }, [cursor.month, cursor.year, events])

  const firstDay = new Date(cursor.year, cursor.month, 1).getDay()
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const isToday = (day: number) =>
    day === today.getDate() &&
    cursor.month === today.getMonth() &&
    cursor.year === today.getFullYear()

  const moveMonth = (direction: -1 | 1) => {
    setCursor(current => {
      const nextMonth = current.month + direction
      if (nextMonth < 0) return { year: current.year - 1, month: 11 }
      if (nextMonth > 11) return { year: current.year + 1, month: 0 }
      return { year: current.year, month: nextMonth }
    })
  }

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => moveMonth(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600"
          aria-label="이전 달"
        >
          ‹
        </button>
        <span className="text-base font-bold text-gray-900">
          {cursor.year}년 {cursor.month + 1}월
        </span>
        <button
          onClick={() => moveMonth(1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {WEEK_DAYS.map((day, index) => (
          <div
            key={day}
            className={`text-center text-xs font-semibold py-1 ${
              index === 0 ? 'text-red-400' : index === 6 ? 'text-blue-500' : 'text-gray-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <div key={index} className="h-10" />

          const colIdx = index % 7
          const count = eventDateCounts.get(day) ?? 0
          const dateStr = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          const isSelected = dateStr === selectedDate && !isToday(day)

          return (
            <button
              key={index}
              onClick={() => onDateClick?.(dateStr)}
              className={`relative h-10 rounded-xl text-xs transition-colors ${
                isToday(day)
                  ? 'bg-indigo-600 text-white font-bold'
                  : isSelected
                    ? 'bg-indigo-100 text-indigo-700 font-semibold ring-2 ring-indigo-400'
                    : 'bg-gray-50 hover:bg-indigo-50 text-gray-800'
              } ${colIdx === 0 && !isToday(day) && !isSelected ? 'text-red-400' : ''} ${
                colIdx === 6 && !isToday(day) && !isSelected ? 'text-blue-500' : ''
              }`}
            >
              <span className="absolute top-2 left-2">{day}</span>
              {count > 0 && (
                <span className="absolute left-2 bottom-2 flex gap-0.5">
                  {Array.from({ length: Math.min(count, 3) }).map((_, dotIndex) => (
                    <span
                      key={dotIndex}
                      className={`w-1.5 h-1.5 rounded-full ${
                        isToday(day) ? 'bg-white' : dotIndex === 0 ? 'bg-indigo-500' : dotIndex === 1 ? 'bg-purple-500' : 'bg-amber-500'
                      }`}
                    />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-indigo-500" />일정</span>
        <span className="inline-flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-purple-500" />메모</span>
        <span className="inline-flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-amber-500" />기타</span>
      </div>
    </div>
  )
}
