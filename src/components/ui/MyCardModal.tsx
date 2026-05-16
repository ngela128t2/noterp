import { useState, useEffect } from 'react'

const STORAGE_KEY = 'noterp_my_card'

interface CardInfo {
  name: string
  title: string
  company: string
  phone: string
  email: string
}

const EMPTY: CardInfo = { name: '', title: '', company: '', phone: '', email: '' }

function buildVCard(c: CardInfo) {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${c.name}`,
    c.company ? `ORG:${c.company}` : '',
    c.title ? `TITLE:${c.title}` : '',
    c.phone ? `TEL;TYPE=CELL:${c.phone}` : '',
    c.email ? `EMAIL:${c.email}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\n')
}

function downloadVCard(c: CardInfo) {
  const blob = new Blob([buildVCard(c)], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${c.name || '내명함'}.vcf`
  a.click()
  URL.revokeObjectURL(url)
}

const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

interface Props {
  onClose: () => void
}

export default function MyCardModal({ onClose }: Props) {
  const [card, setCard] = useState<CardInfo>(EMPTY)
  const [showQR, setShowQR] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setCard(JSON.parse(saved))
      } catch {}
    } else {
      setEditing(true)
    }
  }, [])

  const set = (key: keyof CardInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCard(c => ({ ...c, [key]: e.target.value }))

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(card))
    setEditing(false)
  }

  const hasInfo = !!(card.name || card.phone || card.email)
  const qrData = encodeURIComponent(buildVCard(card))

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">내 명함</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* 카드 미리보기 */}
          {hasInfo && !editing && (
            <div className="bg-indigo-600 rounded-xl p-4 text-white">
              <p className="text-lg font-bold">{card.name}</p>
              {card.title && <p className="text-sm text-indigo-200 mt-0.5">{card.title}</p>}
              {card.company && <p className="text-sm text-indigo-200">{card.company}</p>}
              <div className="mt-3 space-y-0.5">
                {card.phone && <p className="text-sm">📞 {card.phone}</p>}
                {card.email && <p className="text-sm">✉ {card.email}</p>}
              </div>
            </div>
          )}

          {/* 편집 폼 */}
          {editing && (
            <div className="space-y-2.5">
              {[
                { key: 'name',    label: '이름',   placeholder: '홍길동' },
                { key: 'title',   label: '직함',   placeholder: '세무사 / 회계사' },
                { key: 'company', label: '회사',   placeholder: '회계법인 OO' },
                { key: 'phone',   label: '전화',   placeholder: '010-0000-0000' },
                { key: 'email',   label: '이메일', placeholder: 'me@example.com' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    value={card[key as keyof CardInfo]}
                    onChange={set(key as keyof CardInfo)}
                    placeholder={placeholder}
                    className={inputClass}
                  />
                </div>
              ))}
              <button
                onClick={save}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                저장
              </button>
            </div>
          )}

          {/* QR 코드 */}
          {showQR && hasInfo && (
            <div className="flex flex-col items-center gap-2">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`}
                alt="QR 코드"
                className="w-40 h-40 rounded-lg border border-gray-200"
              />
              <p className="text-xs text-gray-400">스캔하면 연락처에 바로 저장됩니다</p>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        {!editing && (
          <div className="px-5 pb-5 flex flex-col gap-2">
            <button
              onClick={() => downloadVCard(card)}
              disabled={!hasInfo}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              📥 vCard 저장 (카톡·문자로 보내기)
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setShowQR(v => !v)}
                disabled={!hasInfo}
                className="flex-1 py-2 border border-gray-200 hover:bg-gray-50 disabled:text-gray-300 text-gray-600 text-sm rounded-lg transition-colors"
              >
                {showQR ? 'QR 닫기' : '📷 QR 코드'}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex-1 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm rounded-lg transition-colors"
              >
                ✏️ 수정
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
