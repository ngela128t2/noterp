import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Building2, CheckCircle2, RefreshCw, Users, Wallet } from 'lucide-react'
import { useClients } from '../hooks/useClients'
import { useProjects } from '../hooks/useProjects'
import { useAllTaxTasks, useGenerateTaxTasks } from '../hooks/useTaxTasks'
import { useAllLaborChecks } from '../hooks/useLaborChecks'
import { useBillingContracts } from '../hooks/useBilling'

const DETAIL_OPTIONS = ['전체', '기장', '조정', '신고대리', '기타']

const STATUS_DOT: Record<string, string> = {
  '완료':     'bg-emerald-400',
  '요청함':   'bg-blue-400',
  '일부수신': 'bg-amber-400',
  '지연':     'bg-orange-500',
  '위험':     'bg-red-500',
  '대기':     'bg-gray-300',
  '해당없음': 'bg-gray-200',
}

export default function TaxAgencyPage() {
  const navigate = useNavigate()
  const { data: allClients = [] } = useClients()
  const { data: allProjects = [] } = useProjects()
  const { data: taxTasks = [] } = useAllTaxTasks()
  const { data: laborChecks = [] } = useAllLaborChecks()
  const { data: contracts = [] } = useBillingContracts()
  const generateTasks = useGenerateTaxTasks()
  const [detailFilter, setDetailFilter] = useState('전체')
  const [search, setSearch] = useState('')

  // 세무대리 거래처
  const taxClients = useMemo(() =>
    allClients.filter(c => c.service_category === '세무대리' && c.status !== 'inactive'),
    [allClients]
  )

  // 필터된 거래처
  const filteredClients = useMemo(() =>
    taxClients
      .filter(c => detailFilter === '전체' || c.service_detail === detailFilter)
      .filter(c => !search || c.name.includes(search) || (c.code ?? '').includes(search))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [taxClients, detailFilter, search]
  )

  // 거래처별 진행 중 프로젝트
  const projectsByClient = useMemo(() => {
    const map = new Map<string, typeof allProjects>()
    for (const p of allProjects) {
      if (!p.client_id || p.status === 'completed') continue
      const list = map.get(p.client_id) ?? []
      list.push(p)
      map.set(p.client_id, list)
    }
    return map
  }, [allProjects])

  // 이번 달 업무 상태 맵
  const taskByClient = useMemo(() => {
    const map = new Map<string, typeof taxTasks>()
    for (const t of taxTasks) {
      const list = map.get(t.client_id) ?? []
      list.push(t)
      map.set(t.client_id, list)
    }
    return map
  }, [taxTasks])

  // 노무 체크 맵
  const laborByClient = useMemo(() => {
    const map = new Map<string, (typeof laborChecks)[0]>()
    for (const l of laborChecks) map.set(l.client_id, l)
    return map
  }, [laborChecks])

  // 기장료 계약 맵
  const contractByClient = useMemo(() => {
    const map = new Map<string, (typeof contracts)[0]>()
    for (const c of contracts) if (c.client_id) map.set(c.client_id, c)
    return map
  }, [contracts])

  // KPI 계산
  const kpi = useMemo(() => {
    const total = taxClients.length
    const byDetail = (label: string) => taxClients.filter(c => c.service_detail === label).length
    const 미수신 = taxTasks.filter(t => ['대기', '요청함', '일부수신', '지연'].includes(t.status)).length
    const 위험 = taxTasks.filter(t => t.status === '위험').length
    const 노무체크 = laborChecks.filter(l => l.new_hire || l.resignation || !l.insurance_filed).length
    const 기장료합계 = contracts
      .filter(c => taxClients.some(tc => tc.id === c.client_id))
      .reduce((sum, c) => sum + (c.amount ?? 0), 0)
    return { total, 기장: byDetail('기장'), 조정: byDetail('조정'), 신고대리: byDetail('신고대리'), 미수신, 위험, 노무체크, 기장료합계 }
  }, [taxClients, taxTasks, laborChecks, contracts])

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">세무대리</h1>
            <p className="text-xs text-gray-400 mt-0.5">거래처 운영 · 자료수급 · 기장료 · 노무 · 지원금</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => generateTasks.mutate(undefined)}
              disabled={generateTasks.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={12} className={generateTasks.isPending ? 'animate-spin' : ''} />
              {generateTasks.isPending ? '생성 중...' : '이번 달 업무 자동 생성'}
            </button>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="거래처명 검색"
              className="w-44 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* KPI 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <KpiCard icon={<Building2 size={14} />} label="세무대리 거래처" value={kpi.total} sub={`기장 ${kpi.기장} · 신고 ${kpi.신고대리}`} color="emerald" />
          <KpiCard icon={<AlertCircle size={14} />} label="자료 미수신" value={kpi.미수신} sub={kpi.위험 > 0 ? `위험 ${kpi.위험}건` : '이번 달'} color={kpi.위험 > 0 ? 'red' : 'amber'} />
          <KpiCard icon={<Users size={14} />} label="노무 체크 필요" value={kpi.노무체크} sub="입퇴사·계약서" color="blue" />
          <KpiCard icon={<Wallet size={14} />} label="월 기장료" value={`₩${(kpi.기장료합계 / 10000).toFixed(0)}만`} sub="계약 기준" color="indigo" />
        </div>

        {/* 세부 필터 */}
        <div className="flex gap-1.5 mt-3">
          {DETAIL_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDetailFilter(d)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                detailFilter === d ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {d} {d !== '전체' && taxClients.filter(c => c.service_detail === d).length > 0
                ? `(${taxClients.filter(c => c.service_detail === d).length})`
                : ''}
            </button>
          ))}
        </div>
      </div>

      {/* 거래처 목록 */}
      <div className="flex-1 overflow-auto p-5">
        {filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-400 text-sm">세무대리 거래처가 없습니다</p>
            <button onClick={() => navigate('/clients')} className="mt-2 text-xs text-emerald-600 hover:underline">
              거래처에서 세무대리로 등록하기 →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 max-w-6xl">
            {filteredClients.map(client => {
              const projects = projectsByClient.get(client.id) ?? []
              const tasks = taskByClient.get(client.id) ?? []
              const labor = laborByClient.get(client.id)
              const contract = contractByClient.get(client.id)
              const hasIssue = tasks.some(t => ['지연', '위험'].includes(t.status))
              const needsLabor = labor && (labor.new_hire || labor.resignation || !labor.insurance_filed)

              return (
                <div
                  key={client.id}
                  onClick={() => navigate(`/tax/client/${client.id}`)}
                  className={`bg-white rounded-xl border cursor-pointer hover:shadow-md transition-all group ${
                    hasIssue ? 'border-red-200 hover:border-red-300' : 'border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  {/* 카드 헤더 */}
                  <div className="px-4 pt-4 pb-3 border-b border-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {client.code && (
                            <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {client.code}
                            </span>
                          )}
                          {client.service_detail && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                              {client.service_detail}
                            </span>
                          )}
                          {client.tax_type && (
                            <span className="text-[10px] text-gray-400">{client.tax_type}</span>
                          )}
                          {needsLabor && (
                            <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">노무</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{client.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {client.representative && (
                            <span className="text-xs text-gray-400">{client.representative}</span>
                          )}
                          {contract && (
                            <span className="text-xs text-gray-400">
                              기장료 {contract.amount?.toLocaleString()}원
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0 pt-0.5">→</span>
                    </div>
                  </div>

                  {/* 이번 달 업무 상태 */}
                  <div className="px-4 py-3">
                    {tasks.length === 0 ? (
                      <p className="text-xs text-gray-300">이번 달 업무 없음</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {tasks.map(t => (
                          <span key={t.id} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[t.status] ?? 'bg-gray-300'}`} />
                            {t.task_type} {t.status}
                          </span>
                        ))}
                      </div>
                    )}
                    {projects.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
                        <CheckCircle2 size={10} />
                        <span>진행 중 프로젝트 {projects.length}건</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub: string
  color: 'emerald' | 'amber' | 'red' | 'blue' | 'indigo'
}) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    red:     'bg-red-50 text-red-600',
    blue:    'bg-blue-50 text-blue-600',
    indigo:  'bg-indigo-50 text-indigo-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <div className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded mb-1.5 ${colorMap[color]}`}>
        {icon}{label}
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}
