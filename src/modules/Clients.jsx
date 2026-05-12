import { useState, useEffect, useRef } from "react";

// ─── 상수 (품질관리 옵션 강화 & 계약일 반영) ───────────────────────────────────────────
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

const BANKS = ["국민", "신한", "하나", "우리", "농협", "기업", "SC제일", "씨티", "카카오뱅크",
  "토스뱅크", "새마을금고", "수협", "부산", "경남", "대구", "광주", "전북", "제주", "산업", "수출입", "기타"];

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const EMPTY = {
  name: "", corp_type: "법인", biz_no: "", id_no: "", fss_no: "",
  rep: "", address: "", contact: "", email: "", industry: "",
  opening_date: "", 
  reg_date: today(),       // 시스템 등록일
  contract_date: today(),  // 🎯 계약일 (기본값 오늘)
  fiscal_month: "12월", 
  client_type: "매출처", service: "세무대리", service_detail: "", service_desc: "",
  bank_name: "", account_no: "", account_holder: "",
  manager: "", memo: "",
};

// ─── 포맷 및 유틸 ────────────────────────────────────────────────
const fmt = {
  bizNo: v => {
    const n = v.replace(/\D/g, "").slice(0, 10);
    if (n.length <= 3) return n;
    if (n.length <= 5) return n.slice(0, 3) + "-" + n.slice(3);
    return n.slice(0, 3) + "-" + n.slice(3, 5) + "-" + n.slice(5);
  },
  idNo: v => {
    const n = v.replace(/\D/g, "").slice(0, 13);
    if (n.length <= 6) return n;
    return n.slice(0, 6) + "-" + n.slice(6);
  },
};

// ─── AI 추출 (업종 정보 강화) ──────────────────────────────────────────
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
      prompt: `사업자등록증 이미지에서 다음 정보를 추출하여 정확한 JSON 형식으로만 응답해줘.
{
  "name": "상호 또는 법인명",
  "corp_type": "법인 또는 개인",
  "biz_no": "사업자등록번호(000-00-00000)",
  "id_no": "법인등록번호(없으면 빈값)",
  "rep": "대표자 성명",
  "address": "사업장 소재지",
  "industry": "업태 및 종목을 포함한 정보",
  "opening_date": "개업연월일(YYYY-MM-DD)"
}
JSON 외에 어떤 텍스트도 포함하지 마.`,
      image: { base64, mimeType: file.type }
    })
  });

  const data = await resp.json();
  const text = data.text || data.content?.[0]?.text || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────
export default function NoterpClients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [toast, setToast] = useState(null);
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

  const persist = async d => {
    try { await window.storage.set("noterp_cl", JSON.stringify(d)); } catch {}
  };

  const notify = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY, reg_date: today(), contract_date: today() });
    setTab("기본");
    setShowForm(true);
  };

  const handleSave = async () => {
    let next;
    if (editId) {
      next = clients.map(c => c.id === editId ? { ...form, id: editId } : c);
    } else {
      const newClient = { ...form, id: Date.now() };
      next = [...clients, newClient];
    }
    setClients(next);
    await persist(next);
    setShowForm(false);
    notify("저장되었습니다.");
  };

  const handleFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setExtracting(true);

    try {
      const ex = await extractFromFile(file);
      setForm(prev => ({
        ...prev,
        name: ex.name || prev.name,
        corp_type: ex.corp_type === "개인" ? "개인" : "법인",
        biz_no: fmt.bizNo(ex.biz_no || ""),
        id_no: fmt.idNo(ex.id_no || ""),
        rep: ex.rep || prev.rep,
        address: ex.address || prev.address,
        industry: ex.industry || prev.industry,
        opening_date: ex.opening_date || prev.opening_date,
      }));
      notify("✓ AI 인식 완료");
    } catch (err) {
      notify("인식 실패 - 직접 입력해주세요");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* 토스트 알림 */}
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">거래처 관리</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => fileRef.current.click()}
            className="bg-blue-50 text-blue-600 px-4 py-2 rounded font-medium border border-blue-200"
          >
            {extracting ? "인식 중..." : "사업자등록증(AI)"}
          </button>
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded font-medium">
            새 거래처 추가
          </button>
        </div>
      </div>

      <input 
        type="file" ref={fileRef} onChange={handleFile} hidden accept="image/*,application/pdf" 
      />

      {/* 폼 모달 (간략화된 버전) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex border-b mb-4">
              {["기본", "용역", "계좌", "기타"].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 ${tab === t ? "border-b-2 border-blue-600 text-blue-600 font-bold" : "text-gray-500"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "기본" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-bold">거래처명 *</label>
                  <input className="w-full border p-2 rounded" value={form.name} onChange={e => setF("name", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-500 text-xs">시스템 등록일</label>
                  <input type="date" className="w-full border p-2 rounded bg-gray-50" value={form.reg_date} readOnly />
                </div>
                <div>
                  <label className="text-sm font-bold text-blue-600 text-xs">계약일 🎯</label>
                  <input type="date" className="w-full border p-2 rounded border-blue-200" value={form.contract_date} onChange={e => setF("contract_date", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-bold">사업자번호</label>
                  <input className="w-full border p-2 rounded" value={form.biz_no} onChange={e => setF("biz_no", fmt.bizNo(e.target.value))} />
                </div>
                <div>
                  <label className="text-sm font-bold">법인번호</label>
                  <input className="w-full border p-2 rounded" value={form.id_no} onChange={e => setF("id_no", fmt.idNo(e.target.value))} />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-bold">업종(업태/종목)</label>
                  <input className="w-full border p-2 rounded" value={form.industry} onChange={e => setF("industry", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-bold">주소</label>
                  <input className="w-full border p-2 rounded" value={form.address} onChange={e => setF("address", e.target.value)} />
                </div>
              </div>
            )}

            {tab === "용역" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold">서비스 구분</label>
                  <select className="w-full border p-2 rounded" value={form.service} onChange={e => { setF("service", e.target.value); setF("service_detail", ""); }}>
                    {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold">세부 항목 (품질관리 포함)</label>
                  <select className="w-full border p-2 rounded" value={form.service_detail} onChange={e => setF("service_detail", e.target.value)}>
                    <option value="">선택하세요</option>
                    {SERVICE_DETAIL[form.service]?.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded">취소</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded">저장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 리스트 영역 (간략) */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 border-b">거래처명</th>
              <th className="p-3 border-b">구분</th>
              <th className="p-3 border-b">계약일</th>
              <th className="p-3 border-b">서비스</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(c)}>
                <td className="p-3 border-b font-medium">{c.name}</td>
                <td className="p-3 border-b text-sm">{c.client_type}</td>
                <td className="p-3 border-b text-sm">{c.contract_date}</td>
                <td className="p-3 border-b text-sm">{c.service} - {c.service_detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
