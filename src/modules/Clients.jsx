import { useState, useEffect, useRef } from "react";

// ─── 상수 (품질관리 강화) ──────────────────────────────────────────────────
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

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const EMPTY = {
  name: "", corp_type: "법인", biz_no: "", id_no: "", fss_no: "",
  rep: "", address: "", industry: "", opening_date: "",
  reg_date: today(), contract_date: today(),
  service: "세무대리", service_detail: "", memo: ""
};

export default function NoterpClients() {
  const [form, setForm] = useState(EMPTY);
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef();

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // AI 추출 로직 (Vercel API 연동)
  const handleFile = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    setExtracting(true);
    try {
      const base64 = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.readAsDataURL(file);
      });
      const resp = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `사업자등록증에서 정보 추출해 JSON만 반환. { "name":"", "biz_no":"", "rep":"", "address":"", "industry":"", "opening_date":"" }`,
          image: { base64, mimeType: file.type }
        })
      });
      const data = await resp.json();
      const ex = JSON.parse((data.text || data.content[0].text).replace(/```json|```/g, "").trim());
      setForm(f => ({ ...f, ...ex }));
    } catch { alert("인식 실패"); } finally { setExtracting(false); }
  };

  return (
    <div style={{ backgroundColor: "#f5f5f5", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{
        maxWidth: "800px", margin: "0 auto", backgroundColor: "white",
        padding: "30px", borderRadius: "8px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
      }}>
        <h2 style={{ borderBottom: "2px solid #333", paddingBottom: "10px", marginBottom: "20px", color: "#333" }}>
          거래처 등록 / 수정
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontWeight: "bold", marginBottom: "5px", fontSize: "14px", color: "#555" }}>시스템 등록일 (수정불가)</label>
            <input type="text" value={form.reg_date} readOnly style={{ padding: "10px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#eee" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontWeight: "bold", marginBottom: "5px", fontSize: "14px", color: "#4A90E2" }}>계약일 (수정가능) 🎯</label>
            <input type="date" value={form.contract_date} onChange={e => setF("contract_date", e.target.value)}
              style={{ padding: "10px", border: "1px solid #4A90E2", borderRadius: "4px" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontWeight: "bold", marginBottom: "5px", fontSize: "14px", color: "#555" }}>상호(법인명)</label>
            <input type="text" value={form.name} onChange={e => setF("name", e.target.value)} style={{ padding: "10px", border: "1px solid #ddd", borderRadius: "4px" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontWeight: "bold", marginBottom: "5px", fontSize: "14px", color: "#555" }}>사업자번호</label>
            <input type="text" value={form.biz_no} onChange={e => setF("biz_no", e.target.value)} style={{ padding: "10px", border: "1px solid #ddd", borderRadius: "4px" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontWeight: "bold", marginBottom: "5px", fontSize: "14px", color: "#555" }}>서비스 구분 (품질관리 포함)</label>
            <select value={form.service} onChange={e => { setF("service", e.target.value); setF("service_detail", ""); }}
              style={{ padding: "10px", border: "1px solid #ddd", borderRadius: "4px" }}>
              {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontWeight: "bold", marginBottom: "5px", fontSize: "14px", color: "#555" }}>상세 항목</label>
            <select value={form.service_detail} onChange={e => setF("service_detail", e.target.value)}
              style={{ padding: "10px", border: "1px solid #ddd", borderRadius: "4px" }}>
              <option value="">선택하세요</option>
              {SERVICE_DETAIL[form.service]?.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gridColumn: "span 2" }}>
            <label style={{ fontWeight: "bold", marginBottom: "5px", fontSize: "14px", color: "#555" }}>업종(업태/종목)</label>
            <input type="text" value={form.industry} onChange={e => setF("industry", e.target.value)} style={{ padding: "10px", border: "1px solid #ddd", borderRadius: "4px" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gridColumn: "span 2" }}>
            <label style={{ fontWeight: "bold", marginBottom: "5px", fontSize: "14px", color: "#555" }}>사업장 주소</label>
            <input type="text" value={form.address} onChange={e => setF("address", e.target.value)} style={{ padding: "10px", border: "1px solid #ddd", borderRadius: "4px" }} />
          </div>
        </div>

        <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
          <button onClick={() => fileRef.current.click()} style={{
            backgroundColor: "#4A90E2", color: "white", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold"
          }}>
            {extracting ? "인식 중..." : "사업자등록증 업로드 (OCR)"}
          </button>
          <input type="file" ref={fileRef} onChange={handleFile} hidden accept="image/*,application/pdf" />
          <button style={{ backgroundColor: "#2ECC71", color: "white", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
            정보 저장
          </button>
        </div>
      </div>
    </div>
  );
}
