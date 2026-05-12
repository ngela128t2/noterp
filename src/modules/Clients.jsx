import { useState, useEffect, useRef } from "react";

// ─── 상수 (품질관리 옵션 유지) ──────────────────────────────────────────────────
const SERVICE_TYPES = ["세무대리", "외부감사", "품질관리", "컨설팅", "자문", "한공회", "강의", "기타"];
const SERVICE_DETAIL = {
  "세무대리": ["기장", "청산신고", "법인세 신고", "종합소득세 신고", "부가가치세 신고", "원천세", "기타"],
  "품질관리": ["사전심리(심리)", "발행후감리", "수시감리", "모니터링", "독립성체크", "QC컨설팅", "기타"],
  "외부감사": ["상장법인", "코스닥법인", "비상장법인", "학교법인", "공공기관", "사회복지법인", "기타"],
  "컨설팅":   ["세무컨설팅", "회계컨설팅", "M&A", "기업가치평가", "기타"],
  "자문":     ["세무자문", "회계자문", "법률자문", "경영자문"],
  "한공회":   ["감리대응", "윤리점검", "품질관리검토", "기타"],
  "강의":     ["중회협", "기업출강", "대학강의", "기타"],
  "기타":     [],
};

const CLIENT_TYPES = [
  { value: "매출처", color: "#2563eb", bg: "#eff6ff" },
  { value: "매입처", color: "#059669", bg: "#ecfdf5" },
  { value: "공통",   color: "#7c3aed", bg: "#f5f3ff" },
];

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const EMPTY = {
  name: "", corp_type: "법인", biz_no: "", id_no: "", fss_no: "",
  rep: "", address: "", contact: "", email: "", industry: "",
  opening_date: "", reg_date: today(), contract_date: today(),
  fiscal_month: "12월", client_type: "매출처", service: "세무대리", service_detail: "",
  bank_name: "", account_no: "", account_holder: "", manager: "", memo: "",
};

const fmt = {
  bizNo: v => v.replace(/\D/g, "").replace(/(\d{3})(\d{2})(\d{5})/, "$1-$2-$3").slice(0, 12),
  idNo: v => v.replace(/\D/g, "").replace(/(\d{6})(\d{7})/, "$1-$2").slice(0, 14),
};

// ─── AI 추출 함수 ──────────────────────────────────────────────────
async function extractFromFile(file) {
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const resp = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `사업자등록증에서 정보를 추출해 JSON만 반환해줘. { "name":"", "corp_type":"", "biz_no":"", "id_no":"", "rep":"", "address":"", "industry":"", "opening_date":"" }`,
      image: { base64, mimeType: file.type }
    })
  });
  const data = await resp.json();
  const text = data.text || data.content?.[0]?.text || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function NoterpClients() {
  const [clients, setClients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [tab, setTab] = useState("기본");
  const fileRef = useRef();

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("noterp_cl");
        if (r) setClients(JSON.parse(r.value));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const persist = async d => { try { await window.storage.set("noterp_cl", JSON.stringify(d)); } catch {} };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const next = editId ? clients.map(c => c.id === editId ? { ...form, id: editId } : c) : [...clients, { ...form, id: Date.now() }];
    setClients(next); await persist(next); setShowForm(false);
  };

  const handleFile = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    setExtracting(true);
    try {
      const ex = await extractFromFile(file);
      setForm(f => ({ ...f, ...ex, biz_no: fmt.bizNo(ex.biz_no || ""), id_no: fmt.idNo(ex.id_no || "") }));
      setShowForm(true);
    } catch { alert("인식 실패"); } finally { setExtracting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <header className="bg-white p-4 sticky top-0 z-10 border-b flex justify-between items-center">
        <h1 className="text-xl font-black text-blue-900 tracking-tighter">NOTERP <span className="font-normal text-gray-500">거래처</span></h1>
        <div className="flex gap-2">
          <button onClick={() => fileRef.current.click()} className="text-sm bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-bold border border-blue-100">
            {extracting ? "인식중..." : "사업자(AI)"}
          </button>
          <button onClick={() => { setEditId(null); setForm(EMPTY); setShowForm(true); }} className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg font-bold">
            추가
          </button>
        </div>
      </header>

      <input type="file" ref={fileRef} onChange={handleFile} hidden accept="image/*,application/pdf" />

      {/* 리스트 (카드 스타일로 복구) */}
      <main className="p-4 space-y-3">
        {clients.map(c => (
          <div key={c.id} onClick={() => { setEditId(c.id); setForm(c); setShowForm(true); }} 
            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 active:bg-gray-50 transition-all">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg text-gray-800">{c.name}</h3>
              <span className="text-[10px] px-2 py-1 rounded-md font-bold" 
                style={{ background: CLIENT_TYPES.find(t=>t.value===c.client_type)?.bg, color: CLIENT_TYPES.find(t=>t.value===c.client_type)?.color }}>
                {c.client_type}
              </span>
            </div>
            <div className="flex flex-wrap gap-y-1 text-sm text-gray-500">
              <div className="w-1/2"><span className="text-gray-400 mr-2 text-xs">계약일</span>{c.contract_date}</div>
              <div className="w-1/2 text-right"><span className="text-blue-600 font-medium">{c.service}</span></div>
              <div className="w-full text-xs text-gray-400 mt-1">{c.biz_no} | {c.rep}</div>
            </div>
          </div>
        ))}
      </main>

      {/* 등록/수정 모달 (화면 꽉 차게) */}
      {showForm && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
          <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
            <button onClick={() => setShowForm(false)} className="text-gray-400">닫기</button>
            <h2 className="font-bold">거래처 정보</h2>
            <button onClick={handleSave} className="text-blue-600 font-bold">저장</button>
          </div>
          
          <div className="flex border-b bg-gray-50">
            {["기본", "용역", "계좌"].map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-sm font-bold ${tab===t ? "text-blue-600 border-b-2 border-blue-600 bg-white" : "text-gray-400"}`}>{t}</button>
            ))}
          </div>

          <div className="p-5 space-y-4">
            {tab === "기본" && (
              <>
                <div><label className="text-xs font-bold text-gray-400">거래처명</label><input className="w-full border-b py-2 focus:border-blue-500 outline-none" value={form.name} onChange={e=>setF("name", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="text-xs font-bold text-gray-400">시스템 등록일</label><input type="date" className="w-full border-b py-2 text-gray-400" value={form.reg_date} readOnly /></div>
                   <div><label className="text-xs font-bold text-blue-600">계약일 🎯</label><input type="date" className="w-full border-b py-2 font-bold" value={form.contract_date} onChange={e=>setF("contract_date", e.target.value)} /></div>
                </div>
                <div><label className="text-xs font-bold text-gray-400">사업자번호</label><input className="w-full border-b py-2" value={form.biz_no} onChange={e=>setF("biz_no", fmt.bizNo(e.target.value))} /></div>
                <div><label className="text-xs font-bold text-gray-400">업종(업태/종목)</label><input className="w-full border-b py-2" value={form.industry} onChange={e=>setF("industry", e.target.value)} /></div>
              </>
            )}
            {tab === "용역" && (
              <>
                <div><label className="text-xs font-bold text-gray-400">서비스 구분</label>
                  <select className="w-full border-b py-2 bg-transparent" value={form.service} onChange={e=>{setF("service", e.target.value); setF("service_detail", "");}}>
                    {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="text-xs font-bold text-gray-400">상세 항목 (품질관리 포함)</label>
                  <select className="w-full border-b py-2 bg-transparent font-bold text-blue-600" value={form.service_detail} onChange={e=>setF("service_detail", e.target.value)}>
                    <option value="">선택하세요</option>
                    {SERVICE_DETAIL[form.service]?.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 하단 탭 바 (이미지와 유사하게) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-2 text-[10px] text-gray-400">
        <div className="flex flex-col items-center"><span className="text-lg">🏠</span>홈</div>
        <div className="flex flex-col items-center text-blue-600 font-bold"><span className="text-lg">📋</span>거래처</div>
        <div className="flex flex-col items-center"><span className="text-lg">📁</span>프로젝트</div>
        <div className="flex flex-col items-center"><span className="text-lg">✏️</span>메모</div>
        <div className="flex flex-col items-center"><span className="text-lg">💰</span>장부</div>
      </nav>
    </div>
  );
}
