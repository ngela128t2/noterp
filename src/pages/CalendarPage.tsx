import { useState, useMemo } from 'react'
import { getLocalDate, parseLocalDate } from '../lib/dateUtils'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
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
const inp = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors'

const EVENT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']

function colorForEvent(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length]
}

export default function CalendarPage() {
  const { data: events = [], isLoading } = useCalendarEvents()
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const createEvent = useCreateCalendarEvent()
  const updateEvent = useUpdateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()

  const today = getLocalDate(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailEvent, setDetailEvent] = useState<CalendarItem | null>(null)

  const fcEvents = events.map(e => ({
    id: e.id,
    title: e.title,
    start: e.time ? `${e.date}T${e.time}` : e.date,
    allDay: !e.time,
    extendedProps: { original: e },
    color: colorForEvent(e.id),
  }))

  const dayEvents = useMemo(() =>
    events
      .filter(e => e.date === selectedDate)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [events, selectedDate]
  )

  const handleDateClick = (info: { dateStr: string }) => {
    setSelectedDate(info.dateStr)
    setDetailEvent(null)
  }

  const handleNavLinkDayClick = (date: Date) => {
    const dateStr = getLocalDate(date)
    setForm({ ...EMPTY, date: dateStr })
    setEditingId(null)
    setModal('create')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventClick = (info: any) => {
    const ev = info.event.extendedProps.original as CalendarItem
    setDetailEvent(ev)
  }

  const openCreate = (date?: string) => {
    setForm({ ...EMPTY, date: date ?? selectedDate })
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
    setDetailEvent(null)
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
    const d = parseLocalDate(dateStr)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const isToday = dateStr === today
    return {
      full: `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`,
      month: d.getMonth() + 1,
      day: d.getDate(),
      dow: days[d.getDay()],
      isToday,
      isSat: d.getDay() === 6,
      isSun: d.getDay() === 0,
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const sel = formatDate(selectedDate)

  return (
    <div className="h-full flex flex-col lg:flex-row gap-0 overflow-hidden">

      {/* 캘린더 영역 */}
      <div className="flex-1 min-w-0 p-4 lg:p-6 overflow-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">캘린더</h1>
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm shadow-indigo-200"
          >
            <span className="text-base leading-none">+</span>
            <span>일정 추가</span>
          </button>
        </div>

        <div className="cal-wrap">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: 'prev,next', center: 'title', right: 'today' }}
            locale="ko"
            buttonText={{ today: '오늘' }}
            events={fcEvents}
            navLinks={true}
            navLinkDayClick={handleNavLinkDayClick}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            height="auto"
            dayMaxEvents={3}
            moreLinkText={(n) => `+${n}개`}
          />
        </div>
      </div>

      {/* 사이드 패널 — 선택 날짜 일정 */}
      <div className="lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50/50 flex flex-col">
        {/* 날짜 헤더 */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${sel.isSun ? 'text-red-500' : sel.isSat ? 'text-blue-500' : 'text-gray-900'}`}>
              {sel.day}
            </span>
            <div>
              <div className="text-xs text-gray-400">{sel.month}월 · {sel.dow}요일</div>
              {sel.isToday && <div className="text-[10px] font-semibold text-indigo-600 leading-none mt-0.5">오늘</div>}
            </div>
          </div>
          <button
            onClick={() => openCreate(selectedDate)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-lg leading-none transition-colors"
          >
            +
          </button>
        </div>

        {/* 일정 리스트 */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {dayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3 text-xl">📭</div>
              <p className="text-sm text-gray-400">이 날 일정이 없습니다</p>
              <button
                onClick={() => openCreate(selectedDate)}
                className="mt-3 text-xs text-indigo-500 hover:text-indigo-700 font-medium"
              >
                일정 추가하기 →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {dayEvents.map(e => {
                const color = colorForEvent(e.id)
                return (
                  <button
                    key={e.id}
                    onClick={() => setDetailEvent(e as CalendarItem)}
                    className="w-full text-left bg-white rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-shadow border border-gray-100 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-1 h-full min-h-[2rem] rounded-full mt-0.5 shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{e.title}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                          <span className="text-xs text-gray-400 font-medium">
                            {e.time ? e.time.slice(0, 5) : '종일'}
                          </span>
                          {(e as CalendarItem).clients && (
                            <span className="text-xs text-gray-400 truncate max-w-[100px]">{(e as CalendarItem).clients!.name}</span>
                          )}
                          {e.location && (
                            <span className="text-xs text-gray-400 truncate max-w-[100px]">{e.location}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* FullCalendar 스타일 오버라이드 */}
      <style>{`
        .cal-wrap { --fc-border-color: #f3f4f6; --fc-today-bg-color: #eef2ff; }
        .cal-wrap .fc { font-family: inherit; }
        .cal-wrap .fc-toolbar { margin-bottom: 1.25rem; }
        .cal-wrap .fc-toolbar-title { font-size: 1.1rem; font-weight: 800; color: #111827; }
        .cal-wrap .fc-button-primary {
          background: transparent !important; border: 1px solid #e5e7eb !important;
          color: #374151 !important; border-radius: 10px !important; font-size: 12px !important;
          font-weight: 600 !important; padding: 6px 12px !important; box-shadow: none !important;
        }
        .cal-wrap .fc-button-primary:hover { background: #f9fafb !important; }
        .cal-wrap .fc-button-primary:not(:disabled):active,
        .cal-wrap .fc-button-primary:not(:disabled).fc-button-active {
          background: #eef2ff !important; color: #4f46e5 !important; border-color: #c7d2fe !important;
        }
        .cal-wrap .fc-col-header-cell { padding: 8px 0; border: none; }
        .cal-wrap .fc-col-header-cell-cushion {
          font-size: 11px; font-weight: 700; color: #9ca3af;
          text-decoration: none !important; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .cal-wrap .fc-daygrid-day { border-color: #f3f4f6 !important; }
        .cal-wrap .fc-daygrid-day-number {
          font-size: 12px; font-weight: 600; color: #374151;
          text-decoration: none !important; padding: 6px 8px;
        }
        .cal-wrap .fc-day-sun .fc-daygrid-day-number { color: #ef4444; }
        .cal-wrap .fc-day-sat .fc-daygrid-day-number { color: #3b82f6; }
        .cal-wrap .fc-day-today .fc-daygrid-day-number {
          background: #4f46e5; color: #fff !important; border-radius: 8px; padding: 4px 7px;
        }
        .cal-wrap .fc-daygrid-day:hover { background: #fafafa; cursor: pointer; }
        .cal-wrap .fc-event {
          border: none !important; border-radius: 6px !important;
          padding: 1px 5px !important; font-size: 11px !important; font-weight: 600 !important;
          margin-bottom: 1px !important;
        }
        .cal-wrap .fc-event-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cal-wrap .fc-more-link { font-size: 11px; font-weight: 600; color: #6366f1; }
        .cal-wrap .fc-daygrid-dot-event { padding: 2px 4px; }
        .cal-wrap .fc-scrollgrid { border: none !important; }
        .cal-wrap .fc-scrollgrid-section > td { border: none !important; }
        .cal-wrap table { border-collapse: collapse; }
      `}</style>

      {/* 일정 상세 모달 */}
      {detailEvent && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setDetailEvent(null)}>
          <div
            className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl shadow-2xl p-6 pb-8 sm:pb-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5 sm:hidden" />
            <div className="flex items-start gap-3 mb-4">
              <div className="w-2 h-10 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: colorForEvent(detailEvent.id) }} />
              <div>
                <h3 className="text-lg font-bold text-gray-900 leading-tight">{detailEvent.title}</h3>
                <p className="text-sm text-gray-400 mt-0.5">{formatDate(detailEvent.date).full}</p>
              </div>
            </div>
            <div className="space-y-2 mb-5 pl-5">
              {detailEvent.time && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-gray-400">⏰</span> {detailEvent.time.slice(0, 5)}
                </div>
              )}
              {detailEvent.location && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-gray-400">📍</span> {detailEvent.location}
                </div>
              )}
              {detailEvent.clients && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-gray-400">🏢</span> {detailEvent.clients.name}
                </div>
              )}
              {detailEvent.projects && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-gray-400">📁</span> {detailEvent.projects.name}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={() => { deleteEvent.mutate(detailEvent.id); setDetailEvent(null) }}
                className="px-3 py-2 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
              >삭제</button>
              <div className="flex gap-2">
                <button onClick={() => setDetailEvent(null)}
                  className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                  닫기
                </button>
                <button onClick={() => openEdit(detailEvent)}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors">
                  수정
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 일정 추가/수정 모달 */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setModal(null)}>
          <div
            className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl shadow-2xl p-6 pb-8 sm:pb-6 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5 sm:hidden" />
            <h3 className="text-base font-bold text-gray-900 mb-5">
              {modal === 'edit' ? '일정 수정' : '새 일정'}
            </h3>
            <form onSubmit={handleSave} className="space-y-3.5">
              <Field label="제목">
                <input required value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={inp} placeholder="미팅 제목" autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="날짜">
                  <input type="date" required value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} />
                </Field>
                <Field label="시간">
                  <input type="time" value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className={inp} />
                </Field>
              </div>
              <Field label="장소">
                <input value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className={inp} placeholder="회의실 A" />
              </Field>
              <Field label="거래처">
                <select value={form.client_id}
                  onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className={inp}>
                  <option value="">선택 안 함</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="프로젝트">
                <select value={form.project_id}
                  onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} className={inp}>
                  <option value="">선택 안 함</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)}
                  className="px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                  취소
                </button>
                <button type="submit"
                  className="px-5 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors">
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
      <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}
