import { useState, useEffect, useRef } from "react";

// ─── 상수 ─────────────────────────────────────────────────────
const TAGS = ["계약","미팅","현장","서류","검토","완료","기타"];

function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) { if(!d) return ""; const [y,m,day]=d.split("-"); return `${y}.${m}.${day}`; }

function genMemoCode(memos, date) {
  const dateKey = date.replace(/-/g,"");
  const sameDay = memos.filter(m => m.code?.startsWith(`MEMO-${dateKey}`));
  const next = sameDay.length + 1;
  return `MEMO-${dateKey}-${String(next).padStart(2,"0")}`;
}

// ─── AI 분석 ──────────────────────────────────────────────────
async function analyzeMemo(text, projects) {
  const projectList = projects
    .filter(p => p.status === "진행중" || !p.status)
    .map(p => ({
      id: p.id, code: p.code, name: p.name,
      client: p.client_name, service: p.service,
    }));

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `다음 데일리 메모를 분석해서 각 내용을 어떤 프로젝트에 연결할지 판단해주세요.

[데일리 메모]
${text}

[진행중 프로젝트 목록]
${JSON.stringify(projectList, null, 2)}

[지시사항]
1. 메모를 의미 단위로 나누어 각 부분이 어떤 프로젝트에 해당하는지 판단
2. 거래처명, 서비스 키워드(감사·기장·세무·강의 등), 맥락으로 매칭
3. 매칭되는 프로젝트가 없으면 project_id를 빈 문자열로
4. 각 항목에 적절한 태그 부여 (계약/미팅/현장/서류/검토/완료/기타 중 1개)

JSON 배열만 반환:
[
  {
    "project_id": "프로젝트 id",
    "project_code": "프로젝트 코드 (참고용)",
    "snippet": "해당 부분 메모 내용",
    "tag": "태그"
  }
]
JSON 외 텍스트 없이.`
      }]
    })
  });

  const data = await resp.json();
  const txt = data.content?.[0]?.text || "";
  return JSON.parse(txt.replace(/```json|```/g,"").trim());
}

// ─── 메인 ─────────────────────────────────────────────────────
export default function NoterpMemo() {
  const [memos,    setMemos]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [timeline, setTimeline] = useState({});
  const [date,     setDate]     = useState(today());
  const [content,  setContent]  = useState("");
  const [analyzing,setAnalyzing]= useState(false);
  const [analysis, setAnalysis] = useState(null); // [{project_id, snippet, tag}]
  const [editIdx,  setEditIdx]  = useState(null);
  const [selectedMemo, setSelectedMemo] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);
  const [view,     setView]     = useState("write"); // write | history

  useEffect(()=>{
    (async()=>{
      try {
        const [pm, pp, pt] = await Promise.allSettled([
          window.storage.get("noterp_memo"),
          window.storage.get("noterp_prj"),
          window.storage.get("noterp_tl"),
        ]);
        if(pm.status==="fulfilled"&&pm.value) setMemos(JSON.parse(pm.value.value));
        if(pp.status==="fulfilled"&&pp.value) setProjects(JSON.parse(pp.value.value));
        if(pt.status==="fulfilled"&&pt.value) setTimeline(JSON.parse(pt.value.value));
      } catch{}
      setLoading(false);
    })();
  },[]);

  const persistMemo = async d => { try{ await window.storage.set("noterp_memo",JSON.stringify(d)); }catch{} };
  const persistTl   = async d => { try{ await window.storage.set("noterp_tl",  JSON.stringify(d)); }catch{} };
  const notify = msg => { setToast(msg); setTimeout(()=>setToast(null),2500); };

  // ── AI 분석 ──
  const handleAnalyze = async () => {
    if(!content.trim()) return;
    if(projects.length===0) {
      notify("먼저 프로젝트를 등록해주세요");
      return;
    }
    setAnalyzing(true);
    try {
      const result = await analyzeMemo(content, projects);
      setAnalysis(Array.isArray(result) ? result : []);
      notify(`✓ ${result.length}개 항목 인식`);
    } catch(e) {
      notify("AI 분석 실패 — 다시 시도해주세요");
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── 분석 결과 수정 ──
  const updateAnalysis = (idx, key, val) => {
    setAnalysis(a => a.map((x,i)=>i===idx?{...x,[key]:val}:x));
  };
  const removeAnalysis = idx => setAnalysis(a => a.filter((_,i)=>i!==idx));
  const addAnalysis = () => setAnalysis(a => [...a,{project_id:"",snippet:"",tag:""}]);

  // ── 저장: 메모 + 타임라인 자동 분배 ──
  const handleSave = async () => {
    if(!content.trim()) return;
    const code = genMemoCode(memos, date);
    const memoId = Date.now().toString();

    const validEntries = (analysis||[]).filter(e=>e.project_id&&e.snippet?.trim());

    const memo = {
      id: memoId, code, date, content,
      entries: validEntries.map(e=>({
        project_id: e.project_id,
        snippet:    e.snippet,
        tag:        e.tag||"",
      })),
      created_at: new Date().toISOString(),
    };

    const newMemos = [memo, ...memos];

    // 타임라인 자동 분배
    const newTl = {...timeline};
    validEntries.forEach((e, idx) => {
      const pid = e.project_id;
      const existing = newTl[pid] || [];
      const tlEntry = {
        id: `${memoId}-${idx}`,
        date: date,
        content: e.snippet,
        tag: e.tag||"",
        type: "memo",
        memo_id: memoId,
        memo_code: code,
        created_at: new Date().toISOString(),
      };
      newTl[pid] = [tlEntry, ...existing].sort((a,b)=>b.date.localeCompare(a.date));
    });

    setMemos(newMemos);
    setTimeline(newTl);
    await persistMemo(newMemos);
    await persistTl(newTl);

    setContent("");
    setAnalysis(null);
    notify(`메모 저장 완료 (${validEntries.length}개 프로젝트 연결)`);
  };

  const handleDeleteMemo = async (memoId) => {
    if(!confirm("메모를 삭제하시겠습니까?\n연결된 타임라인 항목도 함께 삭제됩니다.")) return;
    const newMemos = memos.filter(m=>m.id!==memoId);
    const newTl = {};
    Object.keys(timeline).forEach(pid=>{
      newTl[pid] = (timeline[pid]||[]).filter(e=>e.memo_id!==memoId);
    });
    setMemos(newMemos);
    setTimeline(newTl);
    await persistMemo(newMemos);
    await persistTl(newTl);
    setSelectedMemo(null);
    notify("삭제 완료");
  };

  if(loading) return <div style={s.center}><Spin/></div>;

  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        textarea:focus,input:focus,select:focus{border-color:#2563eb!important;outline:none}
        .memo-row:hover{background:#f8faff!important}
      `}</style>

      {/* 헤더 */}
      <div style={s.header}>
        <div>
          <div style={s.brand}>NOTERP</div>
          <div style={s.pageTitle}>데일리 메모</div>
        </div>
        <div style={s.viewTabs}>
          <button style={{...s.viewBtn,...(view==="write"?s.viewOn:{})}} onClick={()=>setView("write")}>
            ✏️ 작성
          </button>
          <button style={{...s.viewBtn,...(view==="history"?s.viewOn:{})}} onClick={()=>setView("history")}>
            📚 기록 ({memos.length})
          </button>
        </div>
      </div>

      {/* 작성 화면 */}
      {view==="write"&&(
        <div style={s.writeBody}>
          <div style={s.writePanel}>
            <div style={s.dateRow}>
              <input type="date" style={s.dateInput} value={date} onChange={e=>setDate(e.target.value)}/>
              <span style={s.dateLabel}>오늘 무슨 일이 있었나요?</span>
            </div>

            <textarea style={s.contentInput}
              placeholder={`예시)
성문화학 재고실사 완료. 김대리한테 추가자료 요청함.
삼성전자 세무조정 검토 시작.
가톨릭대 강의 자료 준비 (법인세법 5장).`}
              value={content}
              onChange={e=>{ setContent(e.target.value); setAnalysis(null); }}/>

            <div style={s.writeActions}>
              <div style={s.charCount}>{content.length}자</div>
              <button style={s.aiBtn}
                disabled={!content.trim()||analyzing}
                onClick={handleAnalyze}>
                {analyzing ? <><Spin size={13}/> 분석 중...</> : "✨ AI로 프로젝트 분석"}
              </button>
            </div>

            {/* AI 분석 결과 */}
            {analysis&&(
              <div style={s.analysisBox}>
                <div style={s.aHeader}>
                  <div style={s.aTitle}>🎯 프로젝트 자동 분류 결과</div>
                  <div style={s.aSub}>잘못 분류된 항목은 직접 수정하세요</div>
                </div>

                {analysis.length===0 ? (
                  <div style={s.aEmpty}>매칭되는 프로젝트가 없어요. 직접 추가해보세요.</div>
                ) : (
                  <div style={s.aList}>
                    {analysis.map((item, idx)=>(
                      <div key={idx} style={s.aItem}>
                        <div style={s.aRow}>
                          <select style={s.aProject}
                            value={item.project_id}
                            onChange={e=>updateAnalysis(idx,"project_id",e.target.value)}>
                            <option value="">— 프로젝트 미연결 —</option>
                            {projects.filter(p=>p.status==="진행중"||!p.status).map(p=>(
                              <option key={p.id} value={p.id}>
                                {p.code} · {p.client_name} {p.name}
                              </option>
                            ))}
                          </select>
                          <select style={s.aTag} value={item.tag||""}
                            onChange={e=>updateAnalysis(idx,"tag",e.target.value)}>
                            <option value="">태그</option>
                            {TAGS.map(t=><option key={t}>{t}</option>)}
                          </select>
                          <button style={s.aRemove} onClick={()=>removeAnalysis(idx)}>×</button>
                        </div>
                        <textarea style={s.aSnippet}
                          value={item.snippet}
                          onChange={e=>updateAnalysis(idx,"snippet",e.target.value)}/>
                      </div>
                    ))}
                  </div>
                )}

                <button style={s.addItemBtn} onClick={addAnalysis}>+ 항목 직접 추가</button>

                <div style={s.saveRow}>
                  <button style={s.saveBtn} onClick={handleSave}>
                    저장 → 프로젝트 타임라인 연결
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 사용 안내 */}
          {!analysis&&(
            <div style={s.guide}>
              <div style={s.guideTitle}>💡 사용법</div>
              <div style={s.guideStep}>1. 오늘 한 일을 자유롭게 작성</div>
              <div style={s.guideStep}>2. <b>AI로 프로젝트 분석</b> 버튼 클릭</div>
              <div style={s.guideStep}>3. AI가 거래처·서비스를 인식해서 프로젝트별로 자동 분류</div>
              <div style={s.guideStep}>4. 확인 후 저장하면 각 프로젝트 타임라인에 자동 기록</div>
            </div>
          )}
        </div>
      )}

      {/* 기록 화면 */}
      {view==="history"&&(
        <div style={s.histBody}>
          <div style={s.histList}>
            {memos.length===0 ? (
              <div style={s.empty}>아직 작성한 메모가 없어요</div>
            ) : memos.map(m=>(
              <div key={m.id} className="memo-row"
                style={{...s.memoCard,...(selectedMemo?.id===m.id?s.memoCardOn:{})}}
                onClick={()=>setSelectedMemo(selectedMemo?.id===m.id?null:m)}>
                <div style={s.memoTop}>
                  <span style={s.memoCode}>{m.code}</span>
                  <span style={s.memoDate}>{fmtDate(m.date)}</span>
                </div>
                <div style={s.memoPreview}>{m.content.slice(0,80)}{m.content.length>80?"...":""}</div>
                <div style={s.memoStats}>
                  <span>📌 {m.entries?.length||0}개 프로젝트 연결</span>
                  <span>{m.content.length}자</span>
                </div>
              </div>
            ))}
          </div>

          {selectedMemo&&(
            <div style={s.memoDetail}>
              <div style={s.mdHeader}>
                <div>
                  <div style={s.memoCode}>{selectedMemo.code}</div>
                  <div style={s.mdDate}>{fmtDate(selectedMemo.date)}</div>
                </div>
                <button style={s.delBtn} onClick={()=>handleDeleteMemo(selectedMemo.id)}>삭제</button>
              </div>

              <div style={s.mdSection}>원본 메모</div>
              <div style={s.mdContent}>{selectedMemo.content}</div>

              {selectedMemo.entries?.length>0&&<>
                <div style={s.mdSection}>연결된 프로젝트</div>
                {selectedMemo.entries.map((e,i)=>{
                  const prj = projects.find(p=>p.id===e.project_id);
                  return (
                    <div key={i} style={s.mdEntry}>
                      <div style={s.mdEntryHead}>
                        {prj ? (
                          <span style={s.mdPrj}>{prj.code} · {prj.client_name} {prj.name}</span>
                        ):(
                          <span style={s.mdPrjGone}>삭제된 프로젝트</span>
                        )}
                        {e.tag&&<span style={s.mdTag}>{e.tag}</span>}
                      </div>
                      <div style={s.mdSnippet}>{e.snippet}</div>
                    </div>
                  );
                })}
              </>}
            </div>
          )}
        </div>
      )}

      {toast&&<div style={s.toast}>{toast}</div>}
    </div>
  );
}

// ─── 서브 ─────────────────────────────────────────────────────
function Spin({size=20}){
  return <span style={{display:"inline-block",width:size,height:size,borderRadius:"50%",
    border:`${size>14?"3":"2"}px solid #e5e5e5`,borderTopColor:"#2563eb",
    animation:"spin 0.8s linear infinite",verticalAlign:"middle"}}/>;
}

// ─── 스타일 ───────────────────────────────────────────────────
const s = {
  root:       {fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",background:"#f5f5f3",minHeight:"100vh",color:"#1a1a1a"},
  center:     {display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"},
  header:     {display:"flex",alignItems:"flex-end",justifyContent:"space-between",padding:"24px 32px 18px",background:"#fff",borderBottom:"1px solid #e5e5e5"},
  brand:      {fontSize:10,fontWeight:700,letterSpacing:4,color:"#2563eb",marginBottom:4},
  pageTitle:  {fontSize:21,fontWeight:700},
  viewTabs:   {display:"flex",gap:4,background:"#f5f5f5",padding:3,borderRadius:8},
  viewBtn:    {background:"none",border:"none",borderRadius:6,padding:"7px 14px",fontSize:13,fontWeight:500,cursor:"pointer",color:"#666"},
  viewOn:     {background:"#fff",color:"#2563eb",fontWeight:700,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"},

  writeBody:  {display:"flex",gap:20,padding:"24px 32px",alignItems:"flex-start"},
  writePanel: {flex:1,background:"#fff",borderRadius:12,padding:"24px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  dateRow:    {display:"flex",alignItems:"center",gap:14,marginBottom:14,paddingBottom:14,borderBottom:"1px solid #f0f0f0"},
  dateInput:  {border:"1.5px solid #2563eb",borderRadius:8,padding:"7px 12px",fontSize:14,fontWeight:600,color:"#2563eb",background:"#eff6ff"},
  dateLabel:  {fontSize:14,color:"#888"},
  contentInput:{width:"100%",minHeight:200,border:"1px solid #e5e5e5",borderRadius:10,padding:"14px 16px",fontSize:14,lineHeight:1.7,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"},
  writeActions:{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:12},
  charCount:  {fontSize:12,color:"#aaa"},
  aiBtn:      {background:"linear-gradient(135deg,#2563eb,#7c3aed)",color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8},

  analysisBox:{marginTop:20,padding:"20px",background:"#fafbff",borderRadius:12,border:"1px solid #e0e7ff",animation:"fadeIn 0.3s"},
  aHeader:    {marginBottom:14},
  aTitle:     {fontSize:14,fontWeight:700,color:"#2563eb",marginBottom:3},
  aSub:       {fontSize:12,color:"#888"},
  aEmpty:     {textAlign:"center",color:"#888",fontSize:13,padding:"30px 0"},
  aList:      {display:"flex",flexDirection:"column",gap:10},
  aItem:      {background:"#fff",borderRadius:8,padding:"12px",border:"1px solid #e5e5e5"},
  aRow:       {display:"flex",gap:6,marginBottom:8},
  aProject:   {flex:1,border:"1px solid #ddd",borderRadius:6,padding:"6px 10px",fontSize:12,background:"#fff"},
  aTag:       {border:"1px solid #ddd",borderRadius:6,padding:"6px 10px",fontSize:12,background:"#fff",width:80},
  aRemove:    {background:"none",border:"1px solid #fcd0d0",color:"#ef4444",borderRadius:6,width:28,fontSize:14,cursor:"pointer"},
  aSnippet:   {width:"100%",border:"1px solid #e5e5e5",borderRadius:6,padding:"8px 10px",fontSize:13,fontFamily:"inherit",resize:"vertical",minHeight:50,boxSizing:"border-box"},
  addItemBtn: {marginTop:10,background:"#fff",border:"1px dashed #c7d2fe",color:"#2563eb",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"},
  saveRow:    {marginTop:14,paddingTop:14,borderTop:"1px solid #e0e7ff",display:"flex",justifyContent:"flex-end"},
  saveBtn:    {background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"10px 22px",fontSize:14,fontWeight:700,cursor:"pointer"},

  guide:      {width:280,background:"#fff",borderRadius:12,padding:"22px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  guideTitle: {fontSize:14,fontWeight:700,marginBottom:14,color:"#2563eb"},
  guideStep:  {fontSize:13,color:"#555",lineHeight:1.7,marginBottom:6},

  histBody:   {display:"flex",gap:0,minHeight:"calc(100vh - 150px)"},
  histList:   {width:340,borderRight:"1px solid #e5e5e5",padding:"16px 14px",display:"flex",flexDirection:"column",gap:8,overflowY:"auto",background:"#fff"},
  empty:      {textAlign:"center",color:"#bbb",fontSize:13,padding:"40px 0"},
  memoCard:   {padding:"14px",borderRadius:10,border:"1.5px solid transparent",background:"#f9f9f9",cursor:"pointer",transition:"all 0.1s"},
  memoCardOn: {border:"1.5px solid #2563eb",background:"#fff",boxShadow:"0 0 0 3px rgba(37,99,235,0.08)"},
  memoTop:    {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6},
  memoCode:   {fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#2563eb"},
  memoDate:   {fontSize:11,color:"#888"},
  memoPreview:{fontSize:13,color:"#444",lineHeight:1.5,marginBottom:8},
  memoStats:  {display:"flex",justifyContent:"space-between",fontSize:11,color:"#999"},

  memoDetail: {flex:1,padding:"24px 32px",overflowY:"auto"},
  mdHeader:   {display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,paddingBottom:16,borderBottom:"1px solid #f0f0f0"},
  mdDate:     {fontSize:18,fontWeight:700,marginTop:4},
  delBtn:     {background:"#fff1f0",color:"#ef4444",border:"none",borderRadius:6,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer"},
  mdSection:  {fontSize:10,fontWeight:700,letterSpacing:1.2,color:"#aaa",margin:"18px 0 8px",textTransform:"uppercase"},
  mdContent:  {fontSize:14,lineHeight:1.8,color:"#222",whiteSpace:"pre-wrap",background:"#fafbff",padding:"14px 16px",borderRadius:8,border:"1px solid #e5e5e5"},
  mdEntry:    {background:"#fff",border:"1px solid #e5e5e5",borderRadius:8,padding:"12px",marginBottom:8},
  mdEntryHead:{display:"flex",alignItems:"center",gap:6,marginBottom:6},
  mdPrj:      {fontSize:12,fontWeight:600,color:"#2563eb"},
  mdPrjGone:  {fontSize:12,color:"#aaa",fontStyle:"italic"},
  mdTag:      {fontSize:11,background:"#f5f5f5",color:"#666",padding:"1px 8px",borderRadius:5},
  mdSnippet:  {fontSize:13,color:"#333",lineHeight:1.6},

  toast:      {position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#1a1a1a",color:"#fff",padding:"10px 20px",borderRadius:8,fontSize:13,fontWeight:500,zIndex:2000,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"},
};
