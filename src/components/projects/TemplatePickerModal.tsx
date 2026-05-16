import { useState } from 'react'
import type { Client } from '../../types'
import { getLocalDate } from '../../lib/dateUtils'
import {
  BUILTIN_TEMPLATES,
  buildProjectName,
  generateMilestones,
  type ProjectTemplate,
} from '../../lib/projectTemplates'

interface AppliedTemplate {
  name: string
  type: string
  type_detail: string
  start_date: string
  end_date: string
  client_id: string | null
  milestones: { title: string; due_date: string }[]
}

interface Props {
  clients: Client[]
  onApply: (data: AppliedTemplate) => void
  onBlank: () => void
  onClose: () => void
}

const COLOR_RING: Record<string, string> = {
  'bg-blue-500': 'ring-blue-400',
  'bg-purple-500': 'ring-purple-400',
  'bg-indigo-500': 'ring-indigo-400',
  'bg-emerald-500': 'ring-emerald-400',
  'bg-amber-500': 'ring-amber-400',
  'bg-red-500': 'ring-red-400',
}

const today = getLocalDate()

export default function TemplatePickerModal({ clients, onApply, onBlank, onClose }: Props) {
  const [selected, setSelected] = useState<ProjectTemplate | null>(null)
  const [startDate, setStartDate] = useState(today)
  const [clientId, setClientId] = useState('')

  const previewMilestones = selected ? generateMilestones(selected, startDate) : []

  const clientName = clients.find(c => c.id === clientId)?.name ?? ''

  function handleApply() {
    if (!selected) return
    const milestones = generateMilestones(selected, startDate)
    const endDate = milestones[milestones.length - 1]?.due_date ?? ''
    onApply({
      name: buildProjectName(clientName || selected.name, selected.name, startDate),
      type: selected.type,
      type_detail: selected.type_detail,
      start_date: startDate,
      end_date: endDate,
      client_id: clientId || null,
      milestones,
    })
  }

  function formatDay(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">프로젝트 템플릿 선택</h3>
            <p className="text-xs text-gray-400 mt-0.5">업무 유형을 고르면 단계와 일정이 자동으로 생성됩니다</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 시작일 + 거래처 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">거래처 (선택)</label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">선택 안 함</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* 템플릿 그리드 */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">업무 유형 선택</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BUILTIN_TEMPLATES.map(tpl => {
                const isSelected = selected?.id === tpl.id
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setSelected(isSelected ? null : tpl)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? `border-indigo-400 bg-indigo-50 ring-2 ${COLOR_RING[tpl.color] ?? 'ring-indigo-300'} ring-offset-1`
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tpl.color}`} />
                      <span className="text-sm font-semibold text-gray-800">{tpl.name}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{tpl.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-gray-400">{tpl.stages.length}단계</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] text-gray-400">{tpl.duration_days}일</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 선택된 템플릿 미리보기 */}
          {selected && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2.5 h-2.5 rounded-full ${selected.color}`} />
                <p className="text-sm font-semibold text-gray-700">{selected.name} 단계 미리보기</p>
                {clientName && (
                  <span className="text-xs text-indigo-600 font-medium ml-auto">
                    {buildProjectName(clientName, selected.name, startDate)}
                  </span>
                )}
              </div>
              <ol className="relative border-l-2 border-indigo-100 ml-1.5 space-y-1.5">
                {previewMilestones.map((m, i) => (
                  <li key={i} className="pl-4 relative">
                    <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-indigo-300" />
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-indigo-500 shrink-0 w-20">{formatDay(m.due_date)}</span>
                      <span className="text-xs text-gray-700">{m.title}</span>
                    </div>
                  </li>
                ))}
              </ol>
              {selected.tasks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-[11px] font-medium text-gray-400 mb-1.5">자동 생성 할 일 ({selected.tasks.length}건)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tasks.map((t, i) => (
                      <span
                        key={i}
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                          t.priority === 'high'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}
                      >
                        {t.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 액션 */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            onClick={onBlank}
            className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            빈 프로젝트로 시작
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              취소
            </button>
            <button
              onClick={handleApply}
              disabled={!selected}
              className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium rounded-lg flex items-center gap-1.5 transition-colors"
            >
              템플릿 적용
              <span className="text-indigo-300">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
