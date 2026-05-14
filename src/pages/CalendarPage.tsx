import { useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useCalendarEvents, useCreateCalendarEvent, useDeleteCalendarEvent } from '../hooks/useCalendarEvents'
import type { CalendarEvent } from '../types'

interface EventFormState {
  title: string
  date: string
  time: string
  location: string
}

type CalendarItem = CalendarEvent & {
  clients: { name: string } | null
  projects?: { name: string } | null
}

const EMPTY_FORM: EventFormState = { title: '', date: '', time: '', location: '' }
const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function CalendarPage() {
  const { data: events = [], isLoading } = useCalendarEvents()
  const createEvent = useCreateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM)
  const [selected, setSelected] = useState<CalendarItem | null>(null)

  const fcEvents = events.map(event => ({
    id: event.id,
    title: event.clients ? `[${event.clients.name}] ${event.title}` : event.title,
    start: event.time ? `${event.date}T${event.time}` : event.date,
    allDay: !event.time,
    extendedProps: { original: event },
  }))

  const handleDateClick = (info: { dateStr: string }) => {
    setForm({ ...EMPTY_FORM, date: info.dateStr })
    setModal(true)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventClick = (info: any) => {
    setSelected(info.event.extendedProps.original as CalendarItem)
  }

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createEvent.mutate(
      {
        user_id: '',
        title: form.title,
        date: form.date,
        time: form.time || null,
        location: form.location || null,
        client_id: null,
        project_id: null,
      },
      { onSuccess: () => { setModal(false); setForm(EMPTY_FORM) } },
    )
  }

  if (isLoading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">캘린더</h2>
        <button
          onClick={() => { setForm(EMPTY_FORM); setModal(true) }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
        >
          + 일정 추가
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 calendar-surface">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
          locale="ko"
          buttonText={{ today: '오늘', month: '월', week: '주' }}
          events={fcEvents}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          height="auto"
          eventColor="#4f46e5"
          eventTextColor="#ffffff"
        />
      </div>

      <style>{`
        .calendar-surface .fc {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #111827;
        }
        .calendar-surface .fc-toolbar-title {
          font-size: 1.15rem;
          font-weight: 800;
          letter-spacing: 0;
        }
        .calendar-surface .fc-button {
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          background: #4f46e5;
          border-color: #4f46e5;
        }
        .calendar-surface .fc-col-header-cell-cushion,
        .calendar-surface .fc-daygrid-day-number {
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          text-decoration: none;
        }
        .calendar-surface .fc-event {
          border-radius: 6px;
          border: 0;
          padding: 1px 3px;
          font-size: 12px;
          font-weight: 600;
        }
      `}</style>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">일정 추가</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <Field label="제목 *">
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} placeholder="미팅 제목" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="날짜 *">
                  <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="시간">
                  <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className={inputClass} />
                </Field>
              </div>
              <Field label="장소">
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputClass} placeholder="회의실 A" />
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">{selected.title}</h3>
            <div className="space-y-1.5 text-sm text-gray-600 mb-5">
              <p>{selected.date}{selected.time ? ` ${selected.time}` : ''}</p>
              {selected.location && <p>{selected.location}</p>}
              {selected.clients && <p>거래처 {selected.clients.name}</p>}
              {selected.projects && <p>프로젝트 {selected.projects.name}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { deleteEvent.mutate(selected.id); setSelected(null) }} className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">삭제</button>
              <button onClick={() => setSelected(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
