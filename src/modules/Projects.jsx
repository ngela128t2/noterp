import { useState, useEffect, useRef } from "react";

// ─── 상수 ─────────────────────────────────────────────────────
const STATUS_LIST = [
  { value:"진행중", color:"#2563eb", bg:"#eff6ff" },
  { value:"완료",   color:"#059669", bg:"#ecfdf5" },
  { value:"대기",   color:"#d97706", bg:"#fffbeb" },
  { value:"보류",   color:"#6b7280", bg:"#f3f4f6" },
];

const SERVICE_TYPES = ["세무대리","외부감사","컨설팅","자문","한공회","강의","중회협","기타"];

const EMPTY_PRJ = {
  name:"", client_id:"", client_name:"",
  service:"", status:"진행중",
  start_date: today(), end_date:"",
  memo:"",
};

const EMPTY_TL = { date: today(), content:"", tag:"" };

const TAGS = ["계약","미팅","현장","서류","검토","완료","기타"];

function today() { return new Date().toISOString().slice(0,10); }

const SERVICE_PREFIX = {
  "세무대리":"TR",
  "외부감사":"AUD",
  "컨설팅":  "CON",
  "자문":    "ADV",
  "한공회":  "KIC",
  "강의":    "LEC",
  "중회협":  "SCA",
  "기타":    "ETC",
};

function genPrjCode(projects, service) {
  const prefix = SERVICE_PREFIX[service] || "PRJ";
  const nums = projects
    .filter(p => p.code?.startsWith(prefix+"-"))
    .map(p => parseInt(p.code.split("-")[1])||0);
  const next = nums.length ? Math.max(...nums)+1 : 1;
  return prefix+"-"+String(next).padStart(3,"0");
}

function stStyle(status) {
  const t = STATUS_LIST.find(s=>s.value===status)||STATUS_LIST[0];
  return { color:t.color, background:t.bg };
}

function fmtDate(d) {
  if(!d) return "";
  const [y,m,day] = d.split("-");
  return `${y}.${m}.${day}`;
}

// ─── 메인 ─────────────────────────────────────────────────────
export default function NoterpProjects() {
  const [projects,  setProjects]  = useState([]);
  const [timeline,  setTimeline]  = useState({}); // { prj_id: [...entries] }
  const [clients,   setClients]   = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [showPrjForm, setShowPrjForm] = useState(false);
  const [editPrjId,   setEditPrjId]  = useState(null);
  const [prjForm,     setPrjForm]    = useState(EMPTY_PRJ);
  const [showTlForm,  setShowTlForm] = useState(false);
  const [editTlId,    setEditTlId]   = useState(null);
  const [tlForm,      setTlForm]     = useState(EMPTY_TL);
  const [search,      setSearch]     = useState("");
  const [ftStatus,    setFtStatus]   = useState("");
  const [loading,     setLoading]    = useState(true);
  const [toast,       setToast]      = useState(null);
  const [tab,         setTab]        = useState("타임라인"); // 타임라인 | 정보

  useEffect(()=>{
    (async()=>{
      try {
        const [pc, pp, pt] = await Promise.allSettled([
          window.storage.get("noterp_cl"),
          window.storage.get("noterp_prj"),
          window.storage.get("noterp_tl"),
        ]);
        if(pc.status==="fulfilled"&&pc.value) setClients(JSON.parse(pc.value.value));
        if(pp.status==="fulfilled"&&pp.value) setProjects(JSON.parse(pp.value.value));
        if(pt.status==="fulfilled"&&pt.value) setTimeline(JSON.parse(pt.value.value));
      } catch{}
      setLoading(false);
    })();
  },[]);

  const persistPrj = async d => { try{ await window.storage.set("noterp_prj",JSON.stringify(d)); }catch{} };
  const persistTl  = async d => { try{ await window.storage.set("noterp_tl", JSON.stringify(d)); }catch{} };
  const notify     = msg => { setToast(msg); setTimeout(()=>setToast(null),2500); };
  const setP       = (k,v) => setPrjForm(f=>({...f,[k]:v}));

  // ── 프로젝트 CRUD ──
  const openAddPrj = () => { setEditPrjId(null); setPrjForm(EMPTY_PRJ); setShowPrjForm(true); };
  const openEditPrj = p => { setEditPrjId(p.id); setPrjForm({...p}); setShowPrjForm(true); };

  const submitPrj = async () => {
    if(!prjForm.name.trim()||!prjForm.client_id) return;
    const client = clients.find(c=>c.id===prjForm.client_id);
    let updated;
    if(editPrjId){
      updated = projects.map(p=>p.id===editPrjId
        ?{...prjForm,id:editPrjId,code:p.code,client_name:client?.name||""}:p);
      notify("수정 완료");
      if(selected?.id===editPrjId) setSelected(updated.find(p=>p.id===editPrjId));
    } else {
      const code = genPrjCode(projects, prjForm.service);
      const np = {...prjForm,id:Date.now().toString(),code,client_name:client?.name||""};
      updated = [np,...projects];
      notify(`프로젝트 추가 완료 (${code})`);
    }
    setProjects(updated); await persistPrj(updated); setShowPrjForm(false);
  };

  const deletePrj = async id => {
    if(!confirm("프로젝트를 삭제하시겠습니까?")) return;
    const updated = projects.filter(p=>p.id!==id);
    setProjects(updated); await persistPrj(updated);
    if(selected?.id===id) setSelected(null);
    notify("삭제 완료");
  };

  // ── 타임라인 CRUD ──
  const openAddTl = () => { setEditTlId(null); setTlForm({...EMPTY_TL,date:today()}); setShowTlForm(true); };
  const openEditTl = e => { setEditTlId(e.id); setTlForm({date:e.date,content:e.content,tag:e.tag||""}); setShowTlForm(true); };

  const submitTl = async () => {
    if(!tlForm.content.trim()||!selected) return;
    const prjId = selected.id;
    const cur = timeline[prjId]||[];
    let updated;
    if(editTlId){
      updated = cur.map(e=>e.id===editTlId?{...e,...tlForm}:e);
      notify("수정 완료");
    } else {
      const ne = {...tlForm, id:Date.now().toString(), type:"direct", created_at:new Date().toISOString()};
      updated = [ne,...cur].sort((a,b)=>b.date.localeCompare(a.date));
      notify("타임라인 추가");
    }
    const newTl = {...timeline,[prjId]:updated};
    setTimeline(newTl); await persistTl(newTl); setShowTlForm(false);
  };

  const deleteTl = async (prjId, entryId) => {
    if(!confirm("삭제하시겠습니까?")) return;
    const updated = (timeline[prjId]||[]).filter(e=>e.id!==entryId);
    const newTl = {...timeline,[prjId]:updated};
    setTimeline(newTl); await persistTl(newTl); notify("삭제 완료");
  };

  // ── 필터 ──
  const filtered = projects.filter(p=>{
    const q=search.toLowerCase();
    return (!q||[p.name,p.code,p.client_name,p.service].some(v=>(v||"").toLowerCase().includes(q)))
      && (!ftStatus||p.status===ftStatus);
  });

  const curTl = selected ? (timeline[selected.id]||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)) : [];

  if(loading) return <div style={s.center}><Spin/></div>;

  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .prow:hover{background:#f8faff!important}
        input:focus,select:focus,textarea:focus{border-color:#2563eb!important;outline:none}
      `}</style>

      {/* 헤더 */}
      <div style={s.header}>
        <div>
          <div style={s.brand}>NOTERP</div>
          <div style={s.pageTitle}>프로젝트</div>
        </div>
        <button style={s.addBtn} onClick={openAddPrj}>+ 프로젝트 추가</button>
      </div>

      {/* 툴바 */}
      <div style={s.toolbar}>
        <input style={s.search} placeholder="프로젝트명 / 코드 / 거래처 검색"
          value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={s.filters}>
          {["",...STATUS_LIST.map(st=>st.value)].map(v=>(
            <button key={v||"전체"} style={{...s.fBtn,...(ftStatus===v?{...s.fBtnOn,...(v?stStyle(v):{})}:{})}}
              onClick={()=>setFtStatus(v)}>{v||"전체"}</button>
          ))}
        </div>
        <span style={s.count}>{filtered.length}개</span>
      </div>

      {/* 바디: 목록 + 상세 */}
      <div style={s.body}>

        {/* 프로젝트 목록 */}
        <div style={s.pList}>
          {filtered.length===0?(
            <div style={s.empty}>
              {projects.length===0?"프로젝트를 추가해주세요":"검색 결과 없음"}
            </div>
          ):filtered.map(p=>(
            <div key={p.id} className="prow"
              style={{...s.pCard,...(selected?.id===p.id?s.pCardOn:{})}}
              onClick={()=>{ setSelected(p); setTab("타임라인"); }}>
              <div style={s.pCardTop}>
                <span style={s.pCode}>{p.code}</span>
                <span style={{...s.badge,...stStyle(p.status)}}>{p.status}</span>
              </div>
              <div style={s.pName}>{p.name}</div>
              <div style={s.pSub}>
                <span style={s.pClient}>{p.client_name}</span>
                {p.service&&<span style={s.pSvc}>{p.service}</span>}
              </div>
              {p.start_date&&(
                <div style={s.pDate}>
                  {fmtDate(p.start_date)}{p.end_date&&` ~ ${fmtDate(p.end_date)}`}
                </div>
              )}
              <div style={s.pTlCount}>
                타임라인 {(timeline[p.id]||[]).length}건
              </div>
            </div>
          ))}
        </div>

        {/* 상세 패널 */}
        {selected ? (
          <div style={s.detail}>
            {/* 상단 */}
            <div style={s.dHeader}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                  <span style={s.dCode}>{selected.code}</span>
                  <span style={{...s.badge,...stStyle(selected.status)}}>{selected.status}</span>
                </div>
                <div style={s.dName}>{selected.name}</div>
                <div style={s.dClient}>{selected.client_name}</div>
              </div>
              <div style={{display:"flex",gap:6,alignSelf:"flex-start"}}>
                <button style={s.editBtn} onClick={()=>openEditPrj(selected)}>수정</button>
                <button style={s.delBtn}  onClick={()=>deletePrj(selected.id)}>삭제</button>
              </div>
            </div>

            {/* 탭 */}
            <div style={s.tabs}>
              {["타임라인","정보"].map(t=>(
                <button key={t} style={{...s.tabBtn,...(tab===t?s.tabOn:{})}}
                  onClick={()=>setTab(t)}>{t}</button>
              ))}
            </div>

            {/* 타임라인 탭 */}
            {tab==="타임라인"&&(
              <div>
                <button style={s.addTlBtn} onClick={openAddTl}>+ 내용 추가</button>

                {curTl.length===0?(
                  <div style={s.tlEmpty}>아직 기록이 없어요</div>
                ):(
                  <div style={s.tlList}>
                    {curTl.map((e,i)=>(
                      <div key={e.id} style={s.tlItem}>
                        {/* 타임라인 선 */}
                        <div style={s.tlLine}>
                          <div style={{...s.tlDot,...(e.type==="memo"?{background:"#7c3aed"}:{})}}/>
                          {i<curTl.length-1&&<div style={s.tlVLine}/>}
                        </div>
                        {/* 내용 */}
                        <div style={s.tlContent}>
                          <div style={s.tlMeta}>
                            <span style={s.tlDate}>{fmtDate(e.date)}</span>
                            {e.tag&&<span style={s.tlTag}>{e.tag}</span>}
                            <span style={{...s.tlSource,...(e.type==="memo"?{color:"#7c3aed",background:"#f5f3ff"}:{})}}>
                              {e.type==="memo"?"📝 메모연동":"✏️ 직접입력"}
                            </span>
                          </div>
                          <div style={s.tlText}>{e.content}</div>
                          {e.type!=="memo"&&(
                            <div style={s.tlActions}>
                              <button style={s.tlEditBtn} onClick={()=>openEditTl(e)}>수정</button>
                              <button style={s.tlDelBtn}  onClick={()=>deleteTl(selected.id,e.id)}>삭제</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 정보 탭 */}
            {tab==="정보"&&(
              <div>
                {[
                  ["거래처",   selected.client_name],
                  ["서비스",   selected.service],
                  ["계약일",   fmtDate(selected.start_date)],
                  ["종료일",   fmtDate(selected.end_date)],
                  ["메모",     selected.memo],
                ].filter(([,v])=>v).map(([k,v])=>(
                  <div key={k} style={s.infoRow}>
                    <div style={s.infoLabel}>{k}</div>
                    <div style={s.infoVal}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ):(
          <div style={s.detailEmpty}>프로젝트를 선택하면 타임라인이 표시됩니다</div>
        )}
      </div>

      {/* 프로젝트 폼 */}
      {showPrjForm&&(
        <div style={s.overlay} onClick={()=>setShowPrjForm(false)}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            <div style={s.mTitle}>{editPrjId?"프로젝트 수정":"프로젝트 추가"}</div>
            <div style={s.grid}>
              <FL label="프로젝트명 *" full>
                <In value={prjForm.name} onChange={v=>setP("name",v)} ph="2024년 외부감사"/>
              </FL>
              <FL label="거래처 *">
                <select style={s.inp} value={prjForm.client_id}
                  onChange={e=>setP("client_id",e.target.value)}>
                  <option value="">선택</option>
                  {clients.map(c=>(
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </FL>
              <FL label="서비스">
                <select style={s.inp} value={prjForm.service} onChange={e=>setP("service",e.target.value)}>
                  <option value="">선택</option>
                  {SERVICE_TYPES.map(sv=><option key={sv}>{sv}</option>)}
                </select>
              </FL>
              <FL label="상태">
                <select style={s.inp} value={prjForm.status} onChange={e=>setP("status",e.target.value)}>
                  {STATUS_LIST.map(st=><option key={st.value}>{st.value}</option>)}
                </select>
              </FL>
              <FL label="계약일">
                <input type="date" style={s.inp} value={prjForm.start_date}
                  onChange={e=>setP("start_date",e.target.value)}/>
              </FL>
              <FL label="종료일">
                <input type="date" style={s.inp} value={prjForm.end_date}
                  onChange={e=>setP("end_date",e.target.value)}/>
              </FL>
              <FL label="메모" full>
                <textarea style={{...s.inp,height:80,resize:"vertical"}}
                  value={prjForm.memo} onChange={e=>setP("memo",e.target.value)}/>
              </FL>
            </div>
            <div style={s.mFoot}>
              <button style={s.cancelBtn} onClick={()=>setShowPrjForm(false)}>취소</button>
              <button style={s.saveBtn} onClick={submitPrj}>{editPrjId?"수정 완료":"추가"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 타임라인 엔트리 폼 */}
      {showTlForm&&(
        <div style={s.overlay} onClick={()=>setShowTlForm(false)}>
          <div style={{...s.modal,width:480}} onClick={e=>e.stopPropagation()}>
            <div style={s.mTitle}>{editTlId?"내용 수정":"타임라인 추가"}</div>
            <div style={{...s.grid,gridTemplateColumns:"1fr"}}>
              <FL label="날짜">
                <input type="date" style={s.inp} value={tlForm.date}
                  onChange={e=>setTlForm(f=>({...f,date:e.target.value}))}/>
              </FL>
              <FL label="태그">
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {TAGS.map(t=>(
                    <button key={t} style={{...s.tagBtn,...(tlForm.tag===t?s.tagBtnOn:{})}}
                      onClick={()=>setTlForm(f=>({...f,tag:f.tag===t?"":t}))}>{t}</button>
                  ))}
                </div>
              </FL>
              <FL label="내용 *">
                <textarea style={{...s.inp,height:120,resize:"vertical"}}
                  placeholder="오늘 진행한 업무 내용을 입력하세요"
                  value={tlForm.content}
                  onChange={e=>setTlForm(f=>({...f,content:e.target.value}))}/>
              </FL>
            </div>
            <div style={s.mFoot}>
              <button style={s.cancelBtn} onClick={()=>setShowTlForm(false)}>취소</button>
              <button style={s.saveBtn} onClick={submitTl}>{editTlId?"수정 완료":"추가"}</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={s.toast}>{toast}</div>}
    </div>
  );
}

// ─── 서브 ─────────────────────────────────────────────────────
function Spin({size=22}){
  return <div style={{width:size,height:size,borderRadius:"50%",
    border:`3px solid #e5e5e5`,borderTopColor:"#2563eb",
    animation:"spin 0.8s linear infinite"}}/>;
}
function FL({label,children,full}){
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4,...(full?{gridColumn:"1/-1"}:{})}}>
      {label&&<label style={{fontSize:11,color:"#666",fontWeight:500}}>{label}</label>}
      {children}
    </div>
  );
}
function In({value,onChange,ph=""}){
  return <input style={s.inp} placeholder={ph} value={value} onChange={e=>onChange(e.target.value)}/>;
}

// ─── 스타일 ───────────────────────────────────────────────────
const s = {
  root:       {fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",background:"#f5f5f3",minHeight:"100vh",color:"#1a1a1a"},
  center:     {display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"},
  header:     {display:"flex",alignItems:"flex-end",justifyContent:"space-between",padding:"24px 32px 18px",background:"#fff",borderBottom:"1px solid #e5e5e5"},
  brand:      {fontSize:10,fontWeight:700,letterSpacing:4,color:"#2563eb",marginBottom:4},
  pageTitle:  {fontSize:21,fontWeight:700},
  addBtn:     {background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:"pointer"},
  toolbar:    {display:"flex",alignItems:"center",gap:8,padding:"12px 32px",background:"#fff",borderBottom:"1px solid #e5e5e5",flexWrap:"wrap"},
  search:     {flex:1,minWidth:180,border:"1px solid #ddd",borderRadius:8,padding:"8px 14px",fontSize:13,background:"#fafafa",outline:"none"},
  filters:    {display:"flex",gap:4,flexWrap:"wrap"},
  fBtn:       {border:"1px solid #e5e5e5",borderRadius:20,padding:"4px 12px",fontSize:12,cursor:"pointer",background:"#fff",color:"#888",fontWeight:500},
  fBtnOn:     {fontWeight:700,borderColor:"currentColor"},
  count:      {fontSize:12,color:"#999",whiteSpace:"nowrap",marginLeft:"auto"},
  body:       {display:"flex",gap:0,minHeight:"calc(100vh - 150px)"},
  pList:      {width:280,borderRight:"1px solid #e5e5e5",padding:"16px 12px",display:"flex",flexDirection:"column",gap:8,overflowY:"auto",background:"#fff"},
  pCard:      {padding:"14px 14px",borderRadius:10,border:"1.5px solid transparent",cursor:"pointer",background:"#f9f9f9",transition:"all 0.1s"},
  pCardOn:    {border:"1.5px solid #2563eb",background:"#fff",boxShadow:"0 0 0 3px rgba(37,99,235,0.08)"},
  pCardTop:   {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4},
  pCode:      {fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#2563eb"},
  pName:      {fontWeight:600,fontSize:14,marginBottom:4,lineHeight:1.3},
  pSub:       {display:"flex",alignItems:"center",gap:6,marginBottom:4},
  pClient:    {fontSize:12,color:"#555"},
  pSvc:       {fontSize:11,background:"#f0f4ff",color:"#2563eb",padding:"1px 7px",borderRadius:5},
  pDate:      {fontSize:11,color:"#aaa",marginBottom:3},
  pTlCount:   {fontSize:11,color:"#aaa"},
  badge:      {fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,display:"inline-block"},
  detail:     {flex:1,padding:"20px 28px",overflowY:"auto"},
  detailEmpty:{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc",fontSize:14},
  empty:      {textAlign:"center",color:"#ccc",fontSize:13,padding:"40px 0"},
  dHeader:    {display:"flex",justifyContent:"space-between",marginBottom:16,paddingBottom:16,borderBottom:"1px solid #f0f0f0"},
  dCode:      {fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#2563eb"},
  dName:      {fontSize:18,fontWeight:700,margin:"4px 0 3px"},
  dClient:    {fontSize:13,color:"#888"},
  editBtn:    {background:"#f0f4ff",color:"#2563eb",border:"none",borderRadius:6,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer"},
  delBtn:     {background:"#fff1f0",color:"#ef4444",border:"none",borderRadius:6,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer"},
  tabs:       {display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid #eee"},
  tabBtn:     {background:"none",border:"none",borderBottom:"2px solid transparent",padding:"8px 18px",fontSize:13,fontWeight:500,color:"#888",cursor:"pointer",marginBottom:-1},
  tabOn:      {color:"#2563eb",borderBottomColor:"#2563eb",fontWeight:700},
  addTlBtn:   {background:"#f0f7ff",color:"#2563eb",border:"1.5px solid #bfdbfe",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:20,display:"block"},
  tlList:     {display:"flex",flexDirection:"column",gap:0},
  tlItem:     {display:"flex",gap:12,paddingBottom:20},
  tlLine:     {display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,paddingTop:4},
  tlDot:      {width:10,height:10,borderRadius:"50%",background:"#2563eb",flexShrink:0},
  tlVLine:    {flex:1,width:2,background:"#e5e5e5",marginTop:4},
  tlContent:  {flex:1,paddingBottom:4},
  tlMeta:     {display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"},
  tlDate:     {fontSize:12,fontWeight:600,color:"#555"},
  tlTag:      {fontSize:11,background:"#f5f5f5",color:"#666",padding:"1px 7px",borderRadius:5},
  tlSource:   {fontSize:11,background:"#f0f4ff",color:"#2563eb",padding:"1px 7px",borderRadius:5},
  tlText:     {fontSize:14,color:"#1a1a1a",lineHeight:1.7,whiteSpace:"pre-wrap"},
  tlActions:  {display:"flex",gap:6,marginTop:6},
  tlEditBtn:  {background:"none",border:"none",color:"#aaa",fontSize:11,cursor:"pointer",padding:"2px 0"},
  tlDelBtn:   {background:"none",border:"none",color:"#f87171",fontSize:11,cursor:"pointer",padding:"2px 0"},
  tlEmpty:    {textAlign:"center",color:"#ccc",fontSize:13,padding:"40px 0"},
  infoRow:    {display:"flex",gap:10,marginBottom:12},
  infoLabel:  {width:60,fontSize:12,color:"#999",flexShrink:0,paddingTop:1},
  infoVal:    {fontSize:13,color:"#222",lineHeight:1.6},
  overlay:    {position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000},
  modal:      {background:"#fff",borderRadius:14,padding:"26px 26px 22px",width:560,maxWidth:"94vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"},
  mTitle:     {fontSize:17,fontWeight:700,marginBottom:20},
  grid:       {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px 20px"},
  inp:        {border:"1px solid #ddd",borderRadius:7,padding:"8px 12px",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"},
  mFoot:      {display:"flex",justifyContent:"flex-end",gap:8,marginTop:22,paddingTop:16,borderTop:"1px solid #f0f0f0"},
  cancelBtn:  {background:"#f5f5f5",color:"#555",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:"pointer"},
  saveBtn:    {background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"9px 22px",fontSize:13,fontWeight:600,cursor:"pointer"},
  tagBtn:     {border:"1px solid #e5e5e5",borderRadius:20,padding:"4px 12px",fontSize:12,cursor:"pointer",background:"#fff",color:"#888"},
  tagBtnOn:   {background:"#eff6ff",color:"#2563eb",borderColor:"#bfdbfe",fontWeight:600},
  toast:      {position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#1a1a1a",color:"#fff",padding:"10px 20px",borderRadius:8,fontSize:13,fontWeight:500,zIndex:2000,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"},
};
