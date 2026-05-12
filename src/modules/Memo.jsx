import { useState, useEffect, useRef } from "react";

// ─── 상수 & 유틸 ─────────────────────────────────────────────────────
const TAGS = ["계약","미팅","현장","서류","검토","완료","기타"];

function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) { if(!d) return ""; const [y,m,day]=d.split("-"); return `${y}.${m}.${day}`; }

function genMemoCode(memos, date) {
  const dateKey = (date || "").replace(/-/g,"");
  const sameDay = memos.filter(m => m.code?.startsWith(`MEMO-${dateKey}`));
  const next = sameDay.length + 1;
  return `MEMO-${dateKey}-${String(next).padStart(2,"0")}`;
}

export default function memo() {
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

  // ─── 1. AI 분석 (새 프로젝트 감지 지시 추가) ───
  const handleAnalyze = async () => {
    if(!content.trim()) return;
    setAnalyzing(true);
    try {
      const projectList = projects.filter(p => p.status === "진행중" || !p.status)
                                  .map(p => ({ id: p.id, name: p.name, client: p.client_name }));

      const systemPrompt = `[진행중 프로젝트 목록] ${JSON.stringify(projectList)}
사용자의 메모를 분석해 프로젝트를 매칭해. 
만약 기존 목록에 없는 새로운 업무나 거래처라면 "is_new": true로 설정하고, "client_name"(새 거래처명)과 "service"(예: 세무대리, 외부감사, 품질관리 등)를 유추해서 적어줘.
반드시 아래 JSON 배열 형식으로만 대답해:
[{ "project_id": "기존id(없으면 빈칸)", "is_new": true/false, "client_name": "새 거래처명", "service": "새 서비스명", "snippet": "메모 내용", "tag": "태그" }]`;

      const resp = await fetch("/api/claud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, system: systemPrompt })
      });
      
      const data = await resp.json();
      if(data.error) throw new Error(data.error);

      // AI가 주는 마크다운 등 불순물 제거 후 파싱
      const cleanJson = data.text.replace(/```json|```/g, "").trim();
      setAnalysis(JSON.parse(cleanJson));
      notify(`✓ AI 분석 완료 (신규/기존 판별 성공)`);
    } catch(e) {
      notify("AI 분석 실패 — 내용을 다시 확인해주세요.");
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── 2. 저장 (새 프로젝트 자동 생성 로직 포함) ───
  const handleSave = async () => {
    if(!content.trim() || !analysis) return;
    
    let updatedProjects = [...projects];
    let newProjectsAdded = 0;
    const memoId = Date.now().toString();
    const code = genMemoCode(memos, date);

    // AI가 분석한 항목들을 돌면서 신규(is_new)면 프로젝트를 먼저 생성합니다.
    const validEntries = analysis.map((item) => {
      if (item.is_new) {
        const newPrjId = `PRJ-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const newPrj = {
          id: newPrjId,
          code: `NEW-${today().replace(/-/g,"").slice(2)}`,
          name: item.service || "신규 프로젝트",
          client_name: item.client_name || "미지정 거래처",
          service: item.service || "기타",
          status: "진행중",
          reg_date: today()
        };
        updatedProjects.push(newPrj);
        newProjectsAdded++;
        
        // 새로 만든 프로젝트 ID를 메모 항목에 덮어씌움
        return { ...item, project_id: newPrjId };
      }
      return item;
    }).filter(e => e.project_id && e.snippet); // 유효한 항목만 남김

    // 메모 객체 생성
    const memo = { id: memoId, code, date, content, entries: validEntries, created_at: new Date().toISOString() };
    const newMemos = [memo, ...memos];
    const newTl = { ...timeline };

    // 타임라인 분배
    validEntries.forEach((e, idx) => {
      const pid = e.project_id;
      if (!newTl[pid]) newTl[pid] = [];
      newTl[pid].unshift({ id: `${memoId}-${idx}`, date, content: e.snippet, tag: e.tag || "기타", type: "memo", memo_id: memoId });
    });

    // DB(스토리지) 동시 업데이트
    setMemos(newMemos);
    setTimeline(newTl);
    await window.storage.set("noterp_memo", JSON.stringify(newMemos));
    await window.storage.set("noterp_tl", JSON.stringify(newTl));
    
    if (newProjectsAdded > 0) {
      setProjects(updatedProjects);
      await window.storage.set("noterp_prj", JSON.stringify(updatedProjects));
    }

    setContent("");
    setAnalysis(null);
    notify(newProjectsAdded > 0 ? `저장 완료! (새 프로젝트 ${newProjectsAdded}개 생성됨)` : "저장 및 타임라인 연결 완료!");
  };

  if(loading) return <div style={{display:'flex', justifyContent:'center', marginTop:'100px'}}>로딩 중...</div>;

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div><div style={s.brand}>NOTERP</div><div style={s.pageTitle}>데일리 메모</div></div>
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
              placeholder="예: 오늘 처음 만난 XYZ상사 세무컨설팅 시작하기로 함. 기존 성지 회의도 완료."
            />
            <div style={s.writeActions}>
              <button style={s.aiBtn} onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? "AI 생각 중..." : "✨ AI 프로젝트 분석"}
              </button>
            </div>

            {analysis && (
              <div style={s.analysisBox}>
                <div style={s.aTitle}>🎯 AI 분석 결과</div>
                {analysis.map((item, idx) => (
                  <div key={idx} style={s.aItem}>
                    {/* 🎯 신규 프로젝트 감지 시 뱃지 표시 */}
                    {item.is_new ? (
                      <div style={{...s.aProject, backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 'bold'}}>
                        ✨ 신규 자동 생성: [{item.client_name}] {item.service}
                      </div>
                    ) : (
                      <select 
                        style={s.aProject} 
                        value={item.project_id} 
                        onChange={e => {
                          const newA = [...analysis];
                          newA[idx].project_id = e.target.value;
                          setAnalysis(newA);
                        }}
                      >
                        <option value="">기존 프로젝트 선택</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.client_name} - {p.name}</option>)}
                      </select>
                    )}
                    
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
                <button style={s.saveBtn} onClick={handleSave}>타임라인 및 프로젝트 저장</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={s.histBody}>
          <div style={{padding:'20px'}}>기록된 메모가 {memos.length}개 있습니다.</div>
        </div>
      )}
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}

// 스타일 (이전과 동일)
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
  aProject: { width: "100%", marginBottom: "5px", padding: "10px", border: "1px solid #ddd", borderRadius: "5px" },
  aSnippet: { width: "100%", padding: "10px", border: "1px solid #eee", borderRadius: "5px" },
  saveBtn: { width: "100%", marginTop: "10px", padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  toast: { position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)", background: "#333", color: "#fff", padding: "10px 20px", borderRadius: "20px", fontSize: "13px" }
};
