import { useCallback, useMemo, useRef, useState } from 'react'
import { useContacts, useCreateContact, useDeleteContact, useUpdateContact } from '../hooks/useContacts'
import { useClients } from '../hooks/useClients'
import { useProjects } from '../hooks/useProjects'
import { extractFromBusinessCard } from '../lib/gemini'
import type { Contact } from '../types'

const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

type BatchItem = { fileName: string; status: 'pending' | 'done' | 'error'; info?: import('../lib/gemini').ExtractedContactInfo; clientId?: string }

type ContactWithLinks = Contact & {
  clients: { name: string } | null
  projects: { name: string } | null
}

type FormState = {
  name: string
  company: string
  title: string
  phone: string
  email: string
  client_id: string
  project_id: string
  note: string
  tags: string
}

const EMPTY_FORM: FormState = {
  name: '',
  company: '',
  title: '',
  phone: '',
  email: '',
  client_id: '',
  project_id: '',
  note: '',
  tags: '',
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .replace(/\s+/g, '')
    .replace(/\(주\)|㈜|주식회사/g, '')
    .toLowerCase()
}

export default function ContactsPage() {
  const { data: contacts = [], isLoading } = useContacts()
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()

  const [modal, setModal] = useState<'create' | ContactWithLinks | null>(null)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [ocring, setOcring] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [batchSelected, setBatchSelected] = useState<Set<number>>(new Set())
  const [showBatch, setShowBatch] = useState(false)
  const [batchSaving, setBatchSaving] = useState(false)

  const selectedClientProjects = useMemo(() => {
    if (!form.client_id) return projects
    return projects.filter(project => project.client_id === form.client_id)
  }, [form.client_id, projects])

  const filterProjects = useMemo(() => {
    if (!clientFilter) return projects
    return projects.filter(project => project.client_id === clientFilter)
  }, [clientFilter, projects])

  const filtered = useMemo(() => {
    const query = search.trim()
    // 거래처 필터: client_id FK 또는 회사명 fuzzy 매칭
    const filterClientName = clients.find(c => c.id === clientFilter)?.name ?? ''
    const filterClientNameNorm = normalizeText(filterClientName)

    return contacts.filter(contact => {
      const matchesSearch = !query ||
        contact.name.includes(query) ||
        (contact.company ?? '').includes(query) ||
        (contact.title ?? '').includes(query) ||
        (contact.email ?? '').includes(query) ||
        (contact.phone ?? '').includes(query) ||
        (contact.clients?.name ?? '').includes(query) ||
        (contact.projects?.name ?? '').includes(query)

      const matchesClient = !clientFilter ||
        contact.client_id === clientFilter ||
        (filterClientNameNorm.length > 0 && normalizeText(contact.company ?? '').includes(filterClientNameNorm))

      const matchesProject = !projectFilter || contact.project_id === projectFilter
      return matchesSearch && matchesClient && matchesProject
    })
  }, [clientFilter, clients, contacts, projectFilter, search])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setModal('create')
  }

  const openEdit = (contact: ContactWithLinks) => {
    setForm({
      name: contact.name,
      company: contact.company ?? '',
      title: contact.title ?? '',
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      client_id: contact.client_id ?? '',
      project_id: contact.project_id ?? '',
      note: contact.note ?? '',
      tags: contact.tags.join(', '),
    })
    setModal(contact)
  }

  const updateField = (key: keyof FormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const value = event.target.value
    setForm(current => {
      if (key === 'client_id') {
        const projectStillMatches = projects.some(project => project.id === current.project_id && project.client_id === value)
        return { ...current, client_id: value, project_id: projectStillMatches ? current.project_id : '' }
      }
      return { ...current, [key]: value }
    })
  }

  const handleClientFilter = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setClientFilter(value)
    setProjectFilter(current => {
      if (!value) return current
      const projectStillMatches = projects.some(project => project.id === current && project.client_id === value)
      return projectStillMatches ? current : ''
    })
  }

  const handleProjectFilter = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setProjectFilter(value)
    const project = projects.find(item => item.id === value)
    if (project?.client_id) setClientFilter(project.client_id)
  }

  const clearFilters = () => {
    setSearch('')
    setClientFilter('')
    setProjectFilter('')
  }

  const handleSave = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    setSaveError(null)
    setSaving(true)

    const base = {
      name: form.name,
      company: form.company || null,
      title: form.title || null,
      phone: form.phone || null,
      email: form.email || null,
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      note: form.note || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      needs_review: false as boolean | null,
      source: null as string | null,
    }

    try {
      if (modal === 'create') {
        await createContact.mutateAsync({ user_id: '', ...base })
      } else if (modal && typeof modal === 'object') {
        await updateContact.mutateAsync({ id: modal.id, ...base })
      }
      setModal(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const handleBusinessCardOcr = useCallback(async (file: File) => {
    setOcring(true)
    try {
      const base64 = await fileToBase64(file)
      const info = await extractFromBusinessCard(base64, file.type)
      const companyKey = normalizeText(info.company)
      const matchedClient = companyKey
        ? clients.find(client => {
            const clientKey = normalizeText(client.name)
            return clientKey.includes(companyKey) || companyKey.includes(clientKey)
          })
        : undefined
      const matchedProjects = matchedClient ? projects.filter(project => project.client_id === matchedClient.id) : []

      setForm({
        name: info.name ?? '',
        company: info.company ?? '',
        title: info.title ?? '',
        phone: info.phone ?? '',
        email: info.email ?? '',
        client_id: matchedClient?.id ?? '',
        project_id: matchedProjects.length === 1 ? matchedProjects[0].id : '',
        note: info.note ?? '',
        tags: (info.tags?.length ? info.tags : ['명함']).join(', '),
      })
      setModal('create')
    } catch (error) {
      console.error('명함 OCR 실패:', error)
      alert('명함 정보를 읽지 못했습니다. 이미지를 다시 확인해 주세요.')
    } finally {
      setOcring(false)
    }
  }, [clients, projects])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return

    if (files.length === 1) {
      handleBusinessCardOcr(files[0])
      return
    }

    // 배치 모드
    const initial: BatchItem[] = files.map(f => ({ fileName: f.name, status: 'pending' }))
    setBatchItems(initial)
    setBatchSelected(new Set(initial.map((_, i) => i)))
    setShowBatch(true)
    setOcring(true)

    for (let i = 0; i < files.length; i++) {
      try {
        const base64 = await fileToBase64(files[i])
        const info = await extractFromBusinessCard(base64, files[i].type)
        const companyKey = normalizeText(info.company)
        const matched = companyKey ? clients.find(c => {
          const k = normalizeText(c.name)
          return k.includes(companyKey) || companyKey.includes(k)
        }) : undefined
        setBatchItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done', info, clientId: matched?.id } : item))
      } catch {
        setBatchItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error' } : item))
      }
    }
    setOcring(false)
  }

  const handleBatchSave = async () => {
    setBatchSaving(true)
    const toSave = batchItems.filter((item, idx) => item.status === 'done' && item.info && batchSelected.has(idx))
    for (const item of toSave) {
      try {
        await createContact.mutateAsync({
          user_id: '',
          name: item.info!.name,
          company: item.info!.company ?? null,
          title: item.info!.title ?? null,
          phone: item.info!.phone ?? null,
          email: item.info!.email ?? null,
          client_id: item.clientId ?? null,
          project_id: null,
          note: item.info!.note ?? null,
          tags: item.info!.tags?.length ? item.info!.tags : ['명함'],
          needs_review: true,
          source: 'card',
        })
      } catch (err) {
        console.error('배치 저장 오류:', err)
      }
    }
    setBatchSaving(false)
    setShowBatch(false)
    setBatchItems([])
  }

  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const item = Array.from(event.clipboardData.items).find(i => i.type.startsWith('image/'))
    if (!item) return
    const file = item.getAsFile()
    if (file) handleBusinessCardOcr(file)
  }, [handleBusinessCardOcr])

  const avatarColor = (name: string) => {
    const colors = [
      'bg-indigo-100 text-indigo-700',
      'bg-blue-100 text-blue-700',
      'bg-green-100 text-green-700',
      'bg-purple-100 text-purple-700',
      'bg-pink-100 text-pink-700',
      'bg-orange-100 text-orange-700',
    ]
    return colors[name.charCodeAt(0) % colors.length]
  }

  return (
    <div className="p-6" onPaste={handlePaste}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg lg:text-2xl font-bold text-gray-900">N-CRM</h2>
          <p className="text-xs text-gray-400 mt-1">명함을 찍거나 이미지를 붙여 넣고, 거래처와 프로젝트별로 사람을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={ocring}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {ocring ? '인식 중...' : '명함 사진 찍기'}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={ocring}
            className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 rounded-lg disabled:opacity-50"
          >
            이미지 업로드
          </button>
          <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
            + 연락처 추가
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto] gap-2 items-center">
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="이름, 회사, 직책, 거래처, 프로젝트 검색..."
          className={inputClass}
        />
        <select value={clientFilter} onChange={handleClientFilter} className={inputClass}>
          <option value="">전체 거래처</option>
          {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <select value={projectFilter} onChange={handleProjectFilter} className={inputClass}>
          <option value="">전체 프로젝트</option>
          {filterProjects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}{project.clients?.name ? ` · ${project.clients.name}` : ''}
            </option>
          ))}
        </select>
        {(search || clientFilter || projectFilter) && (
          <button onClick={clearFilters} className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">
            초기화
          </button>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs text-gray-400">
        <span>조회 {filtered.length}명</span>
        {clientFilter && <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">거래처별</span>}
        {projectFilter && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">프로젝트별</span>}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-400 text-sm mb-3">조건에 맞는 연락처가 없습니다.</p>
          <div className="flex justify-center gap-2">
            <button onClick={openCreate} className="text-sm text-indigo-600 hover:underline">직접 추가하기</button>
            <button onClick={() => cameraRef.current?.click()} className="text-sm text-indigo-600 hover:underline">명함 사진 찍기</button>
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:underline">필터 초기화</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(contact => (
            <div key={contact.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(contact.name)}`}>
                    {contact.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{contact.name}</p>
                    {contact.title && <p className="text-xs text-gray-500 truncate">{contact.title}</p>}
                    {contact.company && <p className="text-xs text-gray-400 truncate">{contact.company}</p>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(contact)} className="text-xs text-gray-400 hover:text-gray-700 px-1.5 py-1 rounded">수정</button>
                  <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteContact.mutate(contact.id) }} className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-1 rounded">삭제</button>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                {contact.phone && (
                  <div className="flex items-center gap-2">
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition-colors truncate flex-1">
                      <span>📞</span>{contact.phone}
                    </a>
                    <a href={`sms:${contact.phone}`} className="text-xs text-gray-400 hover:text-emerald-600 transition-colors shrink-0 px-1.5 py-0.5 rounded bg-gray-100 hover:bg-emerald-50" title="문자 보내기">
                      💬
                    </a>
                  </div>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition-colors truncate">
                    <span>✉</span>{contact.email}
                  </a>
                )}
                {contact.clients && <p className="text-xs text-indigo-500 truncate">거래처 {contact.clients.name}</p>}
                {contact.projects && <p className="text-xs text-purple-500 truncate">프로젝트 {contact.projects.name}</p>}
              </div>

              {contact.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {contact.tags.map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showBatch && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">명함 일괄 가져오기 ({batchItems.length}장)</h3>
              <button onClick={() => { setShowBatch(false); setBatchItems([]) }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            {ocring && (
              <div className="px-6 py-2.5 text-sm text-indigo-600 bg-indigo-50 border-b border-indigo-100">
                인식 중... ({batchItems.filter(i => i.status !== 'pending').length}/{batchItems.length})
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {batchItems.map((item, idx) => (
                <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border ${item.status === 'error' ? 'border-red-100 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                  {item.status === 'done'
                    ? <input type="checkbox" checked={batchSelected.has(idx)} onChange={e => {
                        setBatchSelected(prev => { const s = new Set(prev); e.target.checked ? s.add(idx) : s.delete(idx); return s })
                      }} className="mt-0.5 accent-indigo-600" />
                    : <div className={`w-4 h-4 mt-0.5 rounded-full shrink-0 ${item.status === 'error' ? 'bg-red-300' : 'bg-gray-300 animate-pulse'}`} />
                  }
                  <div className="flex-1 min-w-0">
                    {item.status === 'done' && item.info ? (
                      <>
                        <p className="text-sm font-semibold text-gray-900">{item.info.name}</p>
                        <p className="text-xs text-gray-500">{[item.info.title, item.info.company].filter(Boolean).join(' · ')}</p>
                        <p className="text-xs text-gray-400">{[item.info.phone, item.info.email].filter(Boolean).join(' | ')}</p>
                        {item.clientId && <p className="text-xs text-indigo-500 mt-0.5">거래처 자동 매칭됨</p>}
                      </>
                    ) : item.status === 'error' ? (
                      <p className="text-sm text-red-500">인식 실패: {item.fileName}</p>
                    ) : (
                      <p className="text-sm text-gray-400">{item.fileName}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!ocring && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {batchSelected.size}건 선택 / 성공 {batchItems.filter(i => i.status === 'done').length}장
                </span>
                <div className="flex gap-2">
                  <button onClick={() => { setShowBatch(false); setBatchItems([]) }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                  <button
                    onClick={handleBatchSave}
                    disabled={batchSaving || batchSelected.size === 0}
                    className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg"
                  >
                    {batchSaving ? '저장 중...' : `${batchSelected.size}건 저장`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modal !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {modal === 'create' ? '연락처 추가' : '연락처 수정'}
            </h3>
            <form onSubmit={handleSave} className="space-y-3">
              <Field label="이름 *">
                <input required value={form.name} onChange={updateField('name')} className={inputClass} placeholder="홍길동" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="회사">
                  <input value={form.company} onChange={updateField('company')} className={inputClass} placeholder="성지회계법인" />
                </Field>
                <Field label="직책">
                  <input value={form.title} onChange={updateField('title')} className={inputClass} placeholder="대표 / 팀장" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="연락처">
                  <input value={form.phone} onChange={updateField('phone')} className={inputClass} placeholder="010-0000-0000" />
                </Field>
                <Field label="이메일">
                  <input value={form.email} onChange={updateField('email')} className={inputClass} placeholder="hong@example.com" />
                </Field>
              </div>
              <Field label="거래처 연결">
                <select value={form.client_id} onChange={updateField('client_id')} className={inputClass}>
                  <option value="">선택 안 함</option>
                  {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </Field>
              <Field label="프로젝트 연결">
                <select value={form.project_id} onChange={updateField('project_id')} className={inputClass}>
                  <option value="">선택 안 함</option>
                  {selectedClientProjects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}{project.clients?.name ? ` · ${project.clients.name}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="태그 (쉼표로 구분)">
                <input value={form.tags} onChange={updateField('tags')} className={inputClass} placeholder="대표, VIP, 감사담당" />
              </Field>
              <Field label="메모">
                <textarea value={form.note} onChange={updateField('note')} rows={2} className={`${inputClass} resize-none`} placeholder="관계 메모, 소개 경로, 특이사항" />
              </Field>
              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg">
                  {saving ? '저장 중...' : '저장'}
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
