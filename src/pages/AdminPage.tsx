import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useIsAdmin, useProfile } from '../hooks/useProfile'
import {
  useTokenUsageRows,
  useTokenUsageByUser,
  useTokenUsageByFeature,
  type DateRange,
} from '../hooks/useTokenUsage'

const RANGE_LABEL: Record<DateRange, string> = {
  today: '오늘',
  last7: '최근 7일',
  thisMonth: '이번 달',
  all: '전체',
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(3)}`
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const FEATURE_LABEL: Record<string, string> = {
  parse_memo: '메모 파싱',
  today_briefing: '일일 브리핑',
  workspace_summary: 'AI 요약',
  business_card_ocr: '명함 OCR',
  business_license_ocr: '사업자등록증 OCR',
  client_match: '거래처 매칭',
  tax_intake_analyze: '세무 접수 분석',
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AdminPage() {
  const { data: profile, isLoading: profileLoading } = useProfile()
  const isAdmin = useIsAdmin()
  const [range, setRange] = useState<DateRange>('thisMonth')
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined)
  const [selectedFeature, setSelectedFeature] = useState<string | undefined>(undefined)

  const usersQ = useTokenUsageByUser(range)
  const featuresQ = useTokenUsageByFeature(range)
  const rowsQ = useTokenUsageRows({
    range,
    userId: selectedUser,
    feature: selectedFeature,
    limit: 200,
  })

  const totals = useMemo(() => {
    const users = usersQ.data ?? []
    return {
      userCount: users.length,
      totalCost: users.reduce((s, u) => s + Number(u.total_cost ?? 0), 0),
      totalTokens: users.reduce((s, u) => s + Number(u.total_tokens ?? 0), 0),
      totalCalls: users.reduce((s, u) => s + Number(u.call_count ?? 0), 0),
    }
  }, [usersQ.data])

  if (profileLoading) return <div className="p-6 text-sm text-gray-400">불러오는 중...</div>
  if (!profile) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-indigo-500 mb-1 font-medium">관리자</p>
          <h1 className="text-xl font-bold text-gray-900">AI 사용량 대시보드</h1>
        </div>
        <div className="flex gap-1.5 bg-white rounded-xl border border-gray-200 p-1">
          {(Object.keys(RANGE_LABEL) as DateRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                range === r ? 'bg-indigo-600 text-white font-medium' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="사용자" value={String(totals.userCount)} sub="활성 사용자 수" />
        <StatCard label="총 호출" value={formatNumber(totals.totalCalls)} sub="API 요청 수" />
        <StatCard label="총 토큰" value={formatNumber(totals.totalTokens)} sub="input + output" />
        <StatCard label="예상 비용" value={formatCost(totals.totalCost)} sub="USD" />
      </div>

      {/* 사용자별 */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-gray-800">사용자별 사용량</h2>
          {selectedUser && (
            <button onClick={() => setSelectedUser(undefined)}
              className="text-xs text-gray-400 hover:text-indigo-600">
              필터 해제
            </button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {usersQ.isLoading ? (
            <p className="p-4 text-sm text-gray-400">불러오는 중...</p>
          ) : (usersQ.data ?? []).length === 0 ? (
            <p className="p-4 text-sm text-gray-400">사용 기록이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">사용자</th>
                  <th className="text-right px-3 py-2 font-medium">호출</th>
                  <th className="text-right px-3 py-2 font-medium">Input</th>
                  <th className="text-right px-3 py-2 font-medium">Output</th>
                  <th className="text-right px-3 py-2 font-medium">총 토큰</th>
                  <th className="text-right px-3 py-2 font-medium">비용</th>
                  <th className="text-right px-3 py-2 font-medium">최근</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(usersQ.data ?? []).map(u => (
                  <tr
                    key={u.user_id}
                    onClick={() => setSelectedUser(selectedUser === u.user_id ? undefined : u.user_id)}
                    className={`cursor-pointer hover:bg-gray-50 ${selectedUser === u.user_id ? 'bg-indigo-50' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <div className="text-gray-800 font-medium">{u.full_name || u.email?.split('@')[0] || '(미지정)'}</div>
                      <div className="text-[11px] text-gray-400">{u.email}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{formatNumber(u.call_count)}</td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">{formatNumber(u.total_input_tokens)}</td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">{formatNumber(u.total_output_tokens)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatNumber(u.total_tokens)}</td>
                    <td className="px-3 py-2 text-right text-indigo-600 font-medium">{formatCost(Number(u.total_cost))}</td>
                    <td className="px-3 py-2 text-right text-[11px] text-gray-400">
                      {u.last_call_at ? formatDateTime(u.last_call_at) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 기능별 */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-gray-800">기능별 / 모델별 사용량</h2>
          {selectedFeature && (
            <button onClick={() => setSelectedFeature(undefined)}
              className="text-xs text-gray-400 hover:text-indigo-600">
              필터 해제
            </button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {featuresQ.isLoading ? (
            <p className="p-4 text-sm text-gray-400">불러오는 중...</p>
          ) : (featuresQ.data ?? []).length === 0 ? (
            <p className="p-4 text-sm text-gray-400">사용 기록이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">기능</th>
                  <th className="text-left px-3 py-2 font-medium">Provider · Model</th>
                  <th className="text-right px-3 py-2 font-medium">호출</th>
                  <th className="text-right px-3 py-2 font-medium">총 토큰</th>
                  <th className="text-right px-3 py-2 font-medium">비용</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(featuresQ.data ?? []).map(f => (
                  <tr
                    key={`${f.feature}-${f.model}`}
                    onClick={() => setSelectedFeature(selectedFeature === f.feature ? undefined : f.feature)}
                    className={`cursor-pointer hover:bg-gray-50 ${selectedFeature === f.feature ? 'bg-indigo-50' : ''}`}
                  >
                    <td className="px-3 py-2 text-gray-800 font-medium">{FEATURE_LABEL[f.feature] ?? f.feature}</td>
                    <td className="px-3 py-2 text-[11px] text-gray-500">
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded mr-1">{f.provider}</span>
                      {f.model}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{formatNumber(f.call_count)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatNumber(f.total_tokens)}</td>
                    <td className="px-3 py-2 text-right text-indigo-600 font-medium">{formatCost(Number(f.total_cost))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 상세 로그 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-2.5">
          상세 로그
          {(selectedUser || selectedFeature) && (
            <span className="text-xs text-gray-400 font-normal ml-2">
              (필터: {selectedUser ? '사용자' : ''}{selectedUser && selectedFeature ? ' + ' : ''}{selectedFeature ? '기능' : ''})
            </span>
          )}
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {rowsQ.isLoading ? (
            <p className="p-4 text-sm text-gray-400">불러오는 중...</p>
          ) : (rowsQ.data ?? []).length === 0 ? (
            <p className="p-4 text-sm text-gray-400">로그가 없습니다.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">시간</th>
                  <th className="text-left px-3 py-2 font-medium">사용자</th>
                  <th className="text-left px-3 py-2 font-medium">기능</th>
                  <th className="text-left px-3 py-2 font-medium">모델</th>
                  <th className="text-right px-3 py-2 font-medium">In</th>
                  <th className="text-right px-3 py-2 font-medium">Out</th>
                  <th className="text-right px-3 py-2 font-medium">비용</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(rowsQ.data ?? []).map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-400">{formatDateTime(r.created_at)}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.email?.split('@')[0] ?? '-'}</td>
                    <td className="px-3 py-1.5 text-gray-700">{FEATURE_LABEL[r.feature] ?? r.feature}</td>
                    <td className="px-3 py-1.5 text-gray-400 truncate max-w-[180px]" title={r.model}>{r.model}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{formatNumber(r.input_tokens)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{formatNumber(r.output_tokens)}</td>
                    <td className="px-3 py-1.5 text-right text-indigo-600">{formatCost(Number(r.estimated_cost))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
