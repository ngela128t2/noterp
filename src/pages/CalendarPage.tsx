import { useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useCalendarEvents, useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent } from '../hooks/useCalendarEvents'
import { useClients } from '../hooks/useClients'
import { useProjects } from '../hooks/useProjects'
import type { CalendarEvent } from '../types'

type CalendarItem = CalendarEvent & {
  clients: { name: string } | null
  projects?: { name: string } | null
}

interface FormState {
  title: string
  date: string
  time: string
  location: string
  client_id: string
  project_id: string
}

const EMPTY: FormState = { title: '', date: '', time: '', location: '', client_id: '', project_id: '' }
const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function CalendarPage() {
  const { data: events = [], isLoading } = useCalendarEvents()
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const createEvent = useCreateCalendarEvent()
  const updateEvent = useUpdateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()

  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarItem | null>(null)

  const fcEvents = events.map(e => ({
    id: e.id,
    title: e.clients ? `[${e.clients.name}] ${e.title}` : e.title,
    start: e.time ? `${e.date}T${e.time}` : e.date,
    allDay: !e.time,
    extendedProps: { original: e },
  }))

  const dayEvents = selectedDate
    ? events.filter(e => e.date === selectedDate).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    : []

  const handleDateClick = (info: { dateStr: string }) => {
    setSelectedDate(info.dateStr)
    setSelectedEvent(null)
  }

  const handleNavLinkDayClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    setForm({ ...EMPTY, date: dateStr })
    setEditingId(null)
    setModal('create')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventClick = (info: any) => {
    const ev = info.event.extendedProps.original as CalendarItem
    setSelectedEvent(ev)
    setSelectedDate(null)
  }

  const openCreate = (date?: string) => {
    setForm({ ...EMPTY, date: date ?? '' })
    setEditingId(null)
    setModal('create')
  }

  const openEdit = (ev: CalendarItem) => {
    setForm({
      title: ev.title,
      date: ev.date,
      time: ev.time ?? '',
      location: ev.location ?? '',
      client_id: ev.client_id ?? '',
      project_id: ev.project_id ?? '',
    })
    setEditingId(ev.id)
    setSelectedEvent(null)
    setModal('edit')
  }

  const handleSave = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const payload = {
      title: form.title,
      date: form.date,
      time: form.time || null,
      location: form.location || null,
      client_id: form.client_id || null,
      project_id: form.project_id || null,
    }
    if (modal === 'edit' && editingId) {
      updateEvent.mutate(
        { id: editingId, ...payload },
        { onSuccess: () => { setModal(null); setEditingId(null) } },
      )
    } else {
      createEvent.mutate(
        { user_id: '', ...payload },
        { onSuccess: () => { setModal(null); setForm(EMPTY) } },
      )
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
  }

  if (isLoading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">캘린더</h2>
        <button
          onClick={() => openCreate()}
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
          navLinks={true}
          navLinkDayClick={handleNavLinkDayClick}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          height="auto"
          eventColor="#4f46e5"
          eventTextColor="#ffffff"
        />
      </div>

      <style>{`
        .calendar-surface .fc { font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; color: #111827; }
        .calendar-surface .fc-toolbar-title { font-size: 1.15rem; font-weight: 800; }
        .calendar-surface .fc-button { border-radius: 8px; font-size: 12px; font-weight: 600; background: #4f46e5; border-color: #4f46e5; }
        .calendar-surface .fc-col-header-cell-cushion,
        .calendar-surface .fc-daygrid-day-number { font-size: 12px; font-weight: 600; color: #374151; text-decoration: none; }
        .calendar-surface .fc-daygrid-day-number:hover { color: #4f46e5; text-decoration: underline; cursor: pointer; }
        .calendar-surface .fc-event { border-radius: 6px; border: 0; padding: 1px 3px; font-size: 12px; font-weight: 600; }
      `}</style>

      {/* 날짜 클릭 → 해당 날 일정 패널 */}
      {selectedDate && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">{formatDate(selectedDate)} 일정</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openCreate(selectedDate)}
                className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
              >
                + 이 날 일정 추가
              </button>
              <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>
          </div>

          {dayEvents.length === 0 ? (
            <p className="text-sm text-gray-400">이 날 등록된 일정이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {dayEvents.map(e => (
                <li
                  key={e.id}
                  className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer group"
                  onClick={() => { setSelectedEvent(e as CalendarItem); setSelectedDate(null) }}
                >
                  <span className="text-xs text-indigo-500 font-medium w-12 shrink-0 pt-0.5">
                    {e.time ? e.time.slice(0, 5) : '종일'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{e.title}</p>
                    <div className="flex gap-2 text-xs text-gray-400 mt-0.5">
                      {(e as CalendarItem).clients && <span>🏢 {(e as CalendarItem).clients!.name}</span>}
                      {e.location && <span>📍 {e.location}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-300 group-hover:text-indigo-400 shrink-0 pt-0.5">수정 →</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 일정 상세 + 수정/삭제 */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">{selectedEvent.title}</h3>
            <div className="space-y-1.5 text-sm text-gray-600 mb-5">
              <p>📅 {formatDate(selectedEvent.date)}{selectedEvent.time ? ` ${selectedEvent.time.slice(0, 5)}` : ''}</p>
              {selectedEvent.location && <p>📍 {selectedEvent.location}</p>}
              {selectedEvent.clients && <p>🏢 {selectedEvent.clients.name}</p>}
              {selectedEvent.projects && <p>📁 {selectedEvent.projects.name}</p>}
            </div>
            <div className="flex justify-between">
              <button
                onClick={() => { deleteEvent.mutate(selectedEvent.id); setSelectedEvent(null) }}
                className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg"
              >삭제</button>
              <div className="flex gap-2">
                <button onClick={() => setSelectedEvent(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">닫기</button>
                <button
                  onClick={() => openEdit(selectedEvent)}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
                >수정</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 일정 추가/수정 모달 */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {modal === 'edit' ? '일정 수정' : '일정 추가'}
            </h3>
            <form onSubmit={handleSave} className="space-y-3">
              <Field label="제목 *">
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} placeholder="미팅 제목" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="날짜 *">
                  <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} />
                </Field>
                <Field label="시간">
                  <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className={inp} />
                </Field>
              </div>
              <Field label="장소">
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inp} placeholder="회의실 A" />
              </Field>
              <Field label="거래처">
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className={inp}>
                  <option value="">선택 안 함</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="프로젝트">
                <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} className={inp}>
                  <option value="">선택 안 함</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg">
                  {modal === 'edit' ? '저장' : '추가'}
                </button>
              </div>
            </form>
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
