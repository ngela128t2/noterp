import { useState, useEffect, useRef } from "react";

// ─── 상수 ─────────────────────────────────────────────────────
const TAGS = ["계약","미팅","현장","서류","검토","완료","기타"];

function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) { if(!d) return ""; const [y,m,day]=d.split("-"); return `${y}.${m}.${day}`; }

function genMemoCode(memos, date) {
  const dateKey = (date || "").replace(/-/g,"");
  const sameDay = memos.filter(m => m.code?.startsWith(`MEMO-${dateKey}`));
  const next = sameDay.length + 1;
  return `MEMO-${dateKey}-${String(next).padStart(2,"0")}`;
}

// ─── AI 분석 ──────────────────────────────────────────────────
async function analyzeMemo(text, projects) {
  const projectList = projects
    .filter(p => p.status === "진행중" || !p.status)
    .map(p => ({
      id: p.id, 
      code: p.code || "NoCode", 
      name: p.name,
      client: p.client_name || p.name, 
      service: p.service || "",
    }));

  const resp = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `다음 데일리 메모를 분석해서 각 내용을 어떤 프로젝트에 연결할지 판단해주세요.
      [진행중 프로젝트 목록] ${JSON.stringify(projectList)}
      [데일리 메모] ${text}
      각 항목에 태그(계약/미팅/현장/서류/검토/완료/기타)를 하나 정해서 JSON 배열로만 응답해줘.`,
      system: "너는 회계법인 비서야. [ { 'project_id': '', 'project_code': '', 'snippet': '', 'tag': '' } ] 형식의 JSON 배열 외에는 아무 말도 하지 마."
    })
  });

  const data = await resp.json();
  // 🎯 응답 추출 로직 강화
  const rawText = data.text || (data.content && data.content[0]?.text) || "";
  const cleanJson = rawText.replace(/```json|```/g, "").trim();
  return JSON.parse(cleanJson);
}

// ─── 메인 ─────────────────────────────────────────────────────
export default function NoterpMemo() {
  const [memos, setMemos] = useState([]);
  const [projects, setProjects] = useState([]);
  const [timeline, setTimeline] = useState({});
  const [date, setDate] = useState(today());
  const [content, setContent] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [view, setView] = useState("write"); 
  const [selectedMemo, setSelectedMemo] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    (async () => {
      try {
        const [pm, pp, pt] = await Promise.all([
          window.storage.get("noterp_memo"),
          window.storage.get("noterp_prj"),
          window.storage.get("noterp_tl"),
        ]);
        if(pm?.value) setMemos(JSON.parse(pm.value));
        if(pp?.value) setProjects(JSON.parse(pp.value));
        if(pt?.value) setTimeline(JSON.parse(pt.value));
      } catch(e) { console.error("데이터 로드 실패", e); }
      setLoading(false);
    })();
  }, []);

  const notify = msg => { setToast(msg); setTimeout(()=>setToast(null), 2500); };

  const handleAnalyze = async () => {
    if(!content.trim()) return;
    setAnalyzing(true);
    try {
      const result = await analyzeMemo(content, projects);
      setAnalysis(Array.isArray(result) ? result : []);
      notify(`✓ AI 분석 완료`);
    } catch(e) {
      notify("AI 분석 실패 — API 연결을 확인하세요");
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if(!content.trim()) return;
    const code = genMemoCode(memos, date);
    const memoId = Date.now().toString();
    const validEntries = (analysis || []).filter(e => e.project_id && e.snippet);

    const memo = {
      id: memoId, code, date, content,
      entries: validEntries,
      created_at: new Date().toISOString(),
    };

    const newMemos = [memo, ...memos];
    const newTl = { ...timeline };

    validEntries.forEach((e, idx) => {
      const pid = e.project_id;
      if (!newTl[pid]) newTl[pid] = [];
      newTl[pid].unshift({
        id: `${memoId}-${idx}`,
        date,
        content: e.snippet,
        tag: e.tag || "기타",
        type: "memo",
        memo_id: memoId,
      });
    });

    setMemos(newMemos);
    setTimeline(newTl);
    await window.storage.set("noterp_memo", JSON.stringify(newMemos));
    await window.storage.set("noterp_tl", JSON.stringify(newTl));

    setContent("");
    setAnalysis(null);
    notify("저장 및 타임라인 연결 완료!");
  };

  // UI 렌더링 (보내주신 스타일 적용)
  if(loading) return <div style={{display:'flex', justifyContent:'center', marginTop:'100px'}}>로딩 중...</div>;

  return (
    <div style={s.root}>
      {/* CSS 애니메이션 추가 */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      
      <div style={s.header}>
        <div>
          <div style={s.brand}>NOTERP</div>
          <div style={s.pageTitle}>데일리 메모</div>
        </div>
        <div style={s.viewTabs}>
          <button style={{...s.viewBtn, ...(view==="write" ? s.viewOn : {})}} onClick={()=>setView("write")}>✏️ 작성</button>
          <button style={{...s.viewBtn, ...(view==="history" ? s.viewOn : {})}} onClick={()=>setView("history")}>📚 기록</button>
        </div>
      </div>

      {view === "write" ? (
        <div style={s.writeBody}>
          <div style={s.writePanel}>
            <div style={s.dateRow}>
              <input type="date" style={s.dateInput} value={date} onChange={e=>setDate(e.target.value)}/>
              <span style={s.dateLabel}>오늘의 업무 일지</span>
            </div>
            <textarea 
              style={s.contentInput} 
              value={content} 
              onChange={e=>setContent(e.target.value)}
              placeholder="예: 성지 회의함. 재고실사 완료."
            />
            <div style={s.writeActions}>
              <button style={s.aiBtn} onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? "분석 중..." : "✨ AI 프로젝트 분석"}
              </button>
            </div>

            {analysis && (
              <div style={s.analysisBox}>
                <div style={s.aTitle}>🎯 AI 분석 결과</div>
                {analysis.map((item, idx) => (
                  <div key={idx} style={s.aItem}>
                    <select 
                      style={s.aProject} 
                      value={item.project_id} 
                      onChange={e => {
                        const newA = [...analysis];
                        newA[idx].project_id = e.target.value;
                        setAnalysis(newA);
                      }}
                    >
                      <option value="">프로젝트 선택</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input 
                      style={s.aSnippet} 
                      value={item.snippet} 
                      onChange={e => {
                        const newA = [...analysis];
                        newA[idx].snippet = e.target.value;
                        setAnalysis(newA);
                      }}
                    />
                  </div>
                ))}
                <button style={s.saveBtn} onClick={handleSave}>타임라인 저장</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={s.histBody}>
          {/* 기록 리스트 출력 로직 (생략 - 위 소스 참조) */}
          <div style={{padding:'20px'}}>기록된 메모가 {memos.length}개 있습니다.</div>
        </div>
      )}
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}

// 스타일 시트는 보내주신 스타일(s)을 그대로 사용하시면 됩니다.
const s = {
  root: { fontFamily: "sans-serif", background: "#f5f5f3", minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", padding: "20px 30px", background: "#fff", borderBottom: "1px solid #ddd" },
  brand: { fontSize: "10px", fontWeight: "bold", color: "#2563eb", letterSpacing: "2px" },
  pageTitle: { fontSize: "20px", fontWeight: "bold" },
  viewTabs: { display: "flex", gap: "5px", background: "#f0f0f0", padding: "3px", borderRadius: "8px" },
  viewBtn: { padding: "8px 15px", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" },
  viewOn: { background: "#fff", color: "#2563eb", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" },
  writeBody: { padding: "30px" },
  writePanel: { background: "#fff", padding: "25px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" },
  dateRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" },
  dateInput: { padding: "5px 10px", border: "1px solid #2563eb", borderRadius: "5px" },
  dateLabel: { color: "#888", fontSize: "14px" },
  contentInput: { width: "100%", minHeight: "150px", padding: "15px", border: "1px solid #ddd", borderRadius: "8px", boxSizing: "border-box" },
  writeActions: { marginTop: "15px", textAlign: "right" },
  aiBtn: { background: "linear-gradient(to right, #2563eb, #7c3aed)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" },
  analysisBox: { marginTop: "20px", padding: "20px", background: "#f8faff", borderRadius: "10px", border: "1px solid #e0e7ff" },
  aTitle: { fontWeight: "bold", color: "#2563eb", marginBottom: "10px" },
  aItem: { marginBottom: "10px", background: "#fff", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" },
  aProject: { width: "100%", marginBottom: "5px", padding: "5px" },
  aSnippet: { width: "100%", padding: "5px", border: "1px solid #eee" },
  saveBtn: { width: "100%", marginTop: "10px", padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold" },
  toast: { position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)", background: "#333", color: "#fff", padding: "10px 20px", borderRadius: "20px", fontSize: "13px" }
};
