import { useState } from 'react'
import type { Client } from '../../types'

type Tab = '기본' | '용역' | '계좌' | '기타'
type FormState = Omit<Client, 'id' | 'created_at' | 'user_id' | 'code'>

const TABS: Tab[] = ['기본', '용역', '계좌', '기타']
const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

const SERVICE_DETAILS: Record<string, string[]> = {
  세무대리: ['기장', '조정', '신고대리', '기타'],
  외부감사: ['법정감사', '임의감사', '검토', '기타'],
  컨설팅: ['세무컨설팅', '회계컨설팅', '경영컨설팅', '기타'],
  자문: ['세무자문', '회계자문', '기타'],
  한공회: ['품질관리', '감리', '기타'],
  품질관리: ['사전심리', '모니터링', '감리', '기타'],
  중회협: ['임원회의', 'TF', '기타'],
  강의: ['사내강의', '외부강의', '기타'],
  기타: ['기타'],
}

const SERVICE_CATEGORIES = ['선택', ...Object.keys(SERVICE_DETAILS)]
const TAX_TYPES = ['선택', '일반과세', '간이과세', '면세', '비사업자']
const WITHHOLDING_TYPES = ['선택', '사업소득', '근로소득', '기타소득', '해당없음']

function empty(): FormState {
  return {
    name: '',
    entity_type: '법인',
    client_type: '매출처',
    business_number: null,
    corp_number: null,
    fss_number: null,
    representative: null,
    established_date: null,
    industry: null,
    audit_type: null,
    fiscal_month: null,
    address: null,
    tax_office: null,
    contract_date: new Date().toISOString().split('T')[0],
    contact_name: null,
    contact_phone: null,
    contact_email: null,
    services: null,
    service_category: null,
    service_detail: null,
    tax_type: null,
    withholding_type: null,
    manager: null,
    memo: null,
    bank_name: null,
    account_number: null,
    account_holder: null,
    status: 'active',
    needs_review: false,
    source: null,
    is_pinned: false,
  }
}

interface Props {
  initial?: Partial<Client>
  onSave: (data: FormState) => void
  onClose: () => void
}

export default function ClientFormModal({ initial, onSave, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('기본')
  const [form, setForm] = useState<FormState>(() => ({ ...empty(), ...initial }))

  const set = (key: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(current => ({ ...current, [key]: event.target.value || null }))

  const setRadio = (key: keyof FormState, value: string) =>
    setForm(current => ({ ...current, [key]: value }))

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave(form)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[92vh] flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">
            {initial?.name ? '거래처 수정' : '거래처 추가'}
          </h3>
          <div className="flex gap-0 mt-4">
            {TABS.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                  tab === item
                    ? 'border-indigo-600 text-indigo-600 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === '기본' && (
              <div className="space-y-4">
                <Field label="거래처명 *">
                  <input required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className={inputClass} placeholder="주식회사 ABC" />
                </Field>

                <div className="grid grid-cols-2 gap-6">
                  <Field label="법인구분">
                    <div className="flex gap-4 mt-1">
                      {['법인', '개인'].map(value => (
                        <label key={value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <input type="radio" name="entity_type" checked={form.entity_type === value} onChange={() => setRadio('entity_type', value)} className="accent-indigo-600" />
                          {value}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="거래처 유형">
                    <div className="flex gap-4 mt-1">
                      {['매출처', '매입처', '공통'].map(value => (
                        <label key={value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <input type="radio" name="client_type" checked={form.client_type === value} onChange={() => setRadio('client_type', value)} className="accent-indigo-600" />
                          {value}
                        </label>
                      ))}
                    </div>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="사업자번호">
                    <input value={form.business_number ?? ''} onChange={set('business_number')} className={inputClass} placeholder="000-00-00000" />
                  </Field>
                  <Field label="법인번호">
                    <input value={form.corp_number ?? ''} onChange={set('corp_number')} className={inputClass} placeholder="000000-0000000" />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="금감원 고유번호">
                    <input value={form.fss_number ?? ''} onChange={set('fss_number')} className={inputClass} placeholder="00000000" />
                  </Field>
                  <Field label="대표자">
                    <input value={form.representative ?? ''} onChange={set('representative')} className={inputClass} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="개업일">
                    <input type="date" value={form.established_date ?? ''} onChange={set('established_date')} className={inputClass} />
                  </Field>
                  <Field label="계약일">
                    <input type="date" value={form.contract_date ?? ''} onChange={set('contract_date')} className={inputClass} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="연락처">
                    <input value={form.contact_phone ?? ''} onChange={set('contact_phone')} className={inputClass} placeholder="02-0000-0000" />
                  </Field>
                  <Field label="이메일">
                    <input type="email" value={form.contact_email ?? ''} onChange={set('contact_email')} className={inputClass} placeholder="abc@example.com" />
                  </Field>
                </div>

                <Field label="업종">
                  <input value={form.industry ?? ''} onChange={set('industry')} className={inputClass} placeholder="제조업 / 서비스업" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="주소">
                    <input value={form.address ?? ''} onChange={set('address')} className={inputClass} placeholder="서울시 강남구..." />
                  </Field>
                  <Field label="관할 세무서">
                    <input value={form.tax_office ?? ''} onChange={set('tax_office')} className={inputClass} placeholder="강남세무서" />
                  </Field>
                </div>
              </div>
            )}

            {tab === '용역' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="카테고리">
                    <select
                      value={form.service_category ?? '선택'}
                      onChange={event => {
                        const value = event.target.value === '선택' ? null : event.target.value
                        setForm(current => ({ ...current, service_category: value, service_detail: null, services: value }))
                      }}
                      className={inputClass}
                    >
                      {SERVICE_CATEGORIES.map(category => <option key={category}>{category}</option>)}
                    </select>
                  </Field>
                  <Field label="세부항목">
                    <select
                      value={form.service_detail ?? '선택'}
                      onChange={event => setForm(current => ({ ...current, service_detail: event.target.value === '선택' ? null : event.target.value }))}
                      className={inputClass}
                      disabled={!form.service_category}
                    >
                      <option>선택</option>
                      {(form.service_category ? SERVICE_DETAILS[form.service_category] ?? [] : []).map(detail => (
                        <option key={detail}>{detail}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="과세유형">
                    <select value={form.tax_type ?? '선택'} onChange={event => setForm(current => ({ ...current, tax_type: event.target.value === '선택' ? null : event.target.value }))} className={inputClass}>
                      {TAX_TYPES.map(type => <option key={type}>{type}</option>)}
                    </select>
                  </Field>
                  <Field label="원천세신고유형">
                    <select value={form.withholding_type ?? '선택'} onChange={event => setForm(current => ({ ...current, withholding_type: event.target.value === '선택' ? null : event.target.value }))} className={inputClass}>
                      {WITHHOLDING_TYPES.map(type => <option key={type}>{type}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="담당자">
                  <input value={form.manager ?? ''} onChange={set('manager')} className={inputClass} placeholder="담당자명" />
                </Field>

                <Field label="비고">
                  <textarea value={form.memo ?? ''} onChange={set('memo')} rows={4} className={`${inputClass} resize-none`} placeholder="특이사항, 계약 조건 등" />
                </Field>
              </div>
            )}

            {tab === '계좌' && (
              <div className="space-y-4">
                <Field label="은행명">
                  <input value={form.bank_name ?? ''} onChange={set('bank_name')} className={inputClass} placeholder="국민은행" />
                </Field>
                <Field label="계좌번호">
                  <input value={form.account_number ?? ''} onChange={set('account_number')} className={inputClass} placeholder="000000-00-000000" />
                </Field>
                <Field label="예금주">
                  <input value={form.account_holder ?? ''} onChange={set('account_holder')} className={inputClass} placeholder="주식회사 ABC" />
                </Field>
              </div>
            )}

            {tab === '기타' && (
              <div className="space-y-4">
                <Field label="결산월">
                  <input type="number" min="1" max="12" value={form.fiscal_month ?? ''} onChange={event => setForm(current => ({ ...current, fiscal_month: event.target.value ? Number(event.target.value) : null }))} className={inputClass} placeholder="12" />
                </Field>
                <Field label="감사유형">
                  <select value={form.audit_type ?? ''} onChange={set('audit_type')} className={inputClass}>
                    <option value="">선택</option>
                    <option value="외부감사">외부감사</option>
                    <option value="세무대리">세무대리</option>
                    <option value="컨설팅">컨설팅</option>
                    <option value="품질관리">품질관리</option>
                    <option value="중회협">중회협</option>
                  </select>
                </Field>
                <Field label="상태">
                  <select value={form.status} onChange={set('status')} className={inputClass}>
                    <option value="active">활성</option>
                    <option value="inactive">비활성</option>
                  </select>
                </Field>
                <Field label="담당자명">
                  <input value={form.contact_name ?? ''} onChange={set('contact_name')} className={inputClass} placeholder="담당자명" />
                </Field>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
            <button type="submit" className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg">
              저장
            </button>
          </div>
        </form>
      </div>
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
