import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients, useCreateClient, useUpdateClient, useDeleteClient, useTogglePinClient } from '../hooks/useClients'
import { extractFromBusinessLicense } from '../lib/gemini'
import ClientFormModal from '../components/clients/ClientFormModal'
import type { Client } from '../types'

const SERVICE_FILTERS = ['전체', '세무대리', '외부감사', '자문', '컨설팅', '한공회', '강의', '기타']

type ModalState = 'create' | Client | null

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ClientsPage() {
  const { data: clients = [], isLoading } = useClients()
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const deleteClient = useDeleteClient()
  const togglePin = useTogglePinClient()
  const navigate = useNavigate()

  const [modal, setModal] = useState<ModalState>(null)
  const [ocrInitial, setOcrInitial] = useState<Partial<Client> | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('전체')
  const [ocring, setOcring] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = clients.filter(client => {
    const keyword = search.trim().toLowerCase()
    const matchSearch = !keyword || [
      client.name,
      client.business_number,
      client.representative,
      client.contact_name,
    ].filter(Boolean).some(value => String(value).toLowerCase().includes(keyword))

    const isTaxRep =
      (client.service_category ?? '').includes('세무대리') ||
      (client.services ?? '').includes('세무대리')

    const matchFilter =
      filter === '전체'
        ? !isTaxRep
        : (client.service_category ?? '').includes(filter) ||
          (client.services ?? '').includes(filter) ||
          client.audit_type === filter

    return matchSearch && matchFilter
  }).sort((a, b) => Number(b.is_pinned ?? false) - Number(a.is_pinned ?? false))

  const handleSave = (data: Omit<Client, 'id' | 'created_at' | 'user_id' | 'code'>) => {
    if (modal === 'create') {
      createClient.mutate(data as Omit<Client, 'id' | 'created_at'>, {
        onSuccess: () => {
          setModal(null)
          setOcrInitial(undefined)
        },
      })
    } else if (modal && typeof modal === 'object') {
      updateClient.mutate({ id: modal.id, ...data }, {
        onSuccess: () => setModal(null),
      })
    }
  }

  const handleOcr = useCallback(async (file: File) => {
    setOcring(true)
    try {
      const base64 = await fileToBase64(file)
      const info = await extractFromBusinessLicense(base64, file.type)
      setOcrInitial(info as Partial<Client>)
    } catch (err) {
      console.error('OCR 실패:', err)
      setOcrInitial(undefined)
    } finally {
      setOcring(false)
      setModal('create')
    }
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) handleOcr(file)
    event.target.value = ''
  }

  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const item = Array.from(event.clipboardData.items).find(i => i.type.startsWith('image/'))
    if (item) {
      const file = item.getAsFile()
      if (file) handleOcr(file)
    }
  }, [handleOcr])

  return (
    <div className="flex h-full" onPaste={handlePaste}>
      <div className="flex-1 min-w-0 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-5 gap-3">
          <h2 className="text-2xl font-bold text-gray-900">거래처 관리</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 hidden sm:block">사업자등록증 업로드 또는 이미지 붙여넣기</span>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={ocring}
              className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
            >
              {ocring ? '인식 중...' : '사업자등록증 OCR'}
            </button>
            <button
              onClick={() => { setOcrInitial(undefined); setModal('create') }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm"
            >
              + 직접 추가
            </button>
            <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="거래처명 / 사업자번호 / 대표자 검색"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-sm"
          />
          <div className="flex items-center gap-1 flex-wrap">
            {SERVICE_FILTERS.map(item => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors whitespace-nowrap ${
                  filter === item
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 bg-white'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="table-fixed text-sm min-w-[1080px] w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-400">
                  <th className="px-2 py-3 w-8" />
                  <th className="text-left px-4 py-3 font-semibold w-20">코드</th>
                  <th className="text-left px-4 py-3 font-semibold w-[180px]">거래처명</th>
                  <th className="text-left px-4 py-3 font-semibold w-[130px]">사업자번호</th>
                  <th className="text-left px-4 py-3 font-semibold w-20">대표자</th>
                  <th className="text-left px-4 py-3 font-semibold w-24">개업일</th>
                  <th className="text-left px-4 py-3 font-semibold w-28">업종</th>
                  <th className="text-left px-4 py-3 font-semibold w-36">제공 용역</th>
                  <th className="text-left px-4 py-3 font-semibold w-24">계약일</th>
                  <th className="text-left px-4 py-3 font-semibold w-24">등록일</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-400 text-sm">불러오는 중...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <p className="text-gray-400 text-sm mb-2">등록된 거래처가 없습니다.</p>
                      <button onClick={() => { setOcrInitial(undefined); setModal('create') }} className="text-sm text-indigo-600 hover:underline">
                        첫 거래처 추가하기
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map(client => {
                    const showCode = client.code && !client.needs_review && client.source !== 'memo'
                    return (
                      <tr
                        key={client.id}
                        onClick={() => navigate(`/workspace/client/${client.id}`)}
                        className={`group border-b border-gray-50 cursor-pointer transition-colors ${client.is_pinned ? 'border-l-2 border-l-amber-400' : ''} hover:bg-indigo-50/40`}
                      >
                        <td className="px-2 py-3 text-center">
                          <button
                            onClick={e => { e.stopPropagation(); togglePin.mutate({ id: client.id, is_pinned: !client.is_pinned }) }}
                            className={`text-lg leading-none transition-colors ${client.is_pinned ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}`}
                            title={client.is_pinned ? '즐겨찾기 해제' : '즐겨찾기'}
                          >
                            ★
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-indigo-600 text-xs font-medium">{showCode ? client.code : '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="font-semibold text-gray-900 truncate max-w-[220px]" title={client.name}>{client.name}</div>
                            {client.needs_review && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="검토 필요" />}
                          </div>
                          {client.entity_type && (
                            <span className={`text-xs ${client.entity_type === '법인' ? 'text-blue-500' : 'text-orange-500'}`}>{client.entity_type}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 tabular-nums text-xs">{client.business_number ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs truncate">{client.representative ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{client.established_date ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs truncate">{client.industry ?? '-'}</td>
                        <td className="px-4 py-3">
                          {(client.service_category || client.services) ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium whitespace-nowrap">
                              {client.service_category ?? client.services}
                              {client.service_detail ? ` · ${client.service_detail}` : ''}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{client.contract_date ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{client.created_at.slice(0, 10)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => { e.stopPropagation(); setOcrInitial(undefined); setModal(client) }}
                              className="text-xs text-gray-400 hover:text-indigo-600 px-1.5 py-1 rounded hover:bg-indigo-50"
                            >수정</button>
                            <button
                              onClick={e => { e.stopPropagation(); if (confirm('삭제할까요?')) deleteClient.mutate(client.id) }}
                              className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-1 rounded hover:bg-red-50"
                            >삭제</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {filtered.length > 0 && <p className="text-xs text-gray-400 mt-3">총 {filtered.length}개 거래처</p>}
      </div>

      {modal !== null && (
        <ClientFormModal
          initial={modal === 'create' ? ocrInitial : modal}
          onSave={handleSave}
          onClose={() => { setModal(null); setOcrInitial(undefined) }}
        />
      )}
    </div>
  )
}
