import { useState, useEffect } from "react";

// ─── 상수 ─────────────────────────────────────────────────────
const TX_TYPES = [
  { value:"매출", color:"#2563eb", bg:"#eff6ff" },
  { value:"매입", color:"#dc2626", bg:"#fef2f2" },
];

const TX_STATUS = [
  { value:"예정",     color:"#6b7280", bg:"#f3f4f6" },
  { value:"청구완료", color:"#d97706", bg:"#fffbeb" },
  { value:"입금완료", color:"#059669", bg:"#ecfdf5" },
  { value:"취소",     color:"#9ca3af", bg:"#f9fafb" },
];

const FREQ = ["월정액","연1회","월정액+연1회"];

function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) { if(!d) return ""; const [y,m,day]=d.split("-"); return `${y}.${m}.${day}`; }
function won(n) { return Number(n||0).toLocaleString("ko-KR")+"원"; }
function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function monthLabel(ym) {
  const [y,m] = ym.split("-");
  return `${y}년 ${parseInt(m)}월`;
}

function genTrCode(txs) {
  const nums = txs.map(t=>parseInt(t.code?.replace("TR-",""))||0);
  const next = nums.length ? Math.max(...nums)+1 : 1;
  return "TR-"+String(next).padStart(4,"0");
}
function genScCode(scs) {
  const nums = scs.map(s=>parseInt(s.code?.replace("SC-",""))||0);
  const next = nums.length ? Math.max(...nums)+1 : 1;
  return "SC-"+String(next).padStart(3,"0");
}

function txTypeStyle(t) { return TX_TYPES.find(x=>x.value===t)||TX_TYPES[0]; }
function statusStyle(s) { return TX_STATUS.find(x=>x.value===s)||TX_STATUS[0]; }

// 정기 패턴 → 거래 자동생성
function generateFromSchedule(schedule, fromDate, toDate) {
  const generated = [];
  const start = new Date(Math.max(new Date(schedule.start_date), new Date(fromDate)));
  const end   = new Date(Math.min(
    schedule.end_date ? new Date(schedule.end_date) : new Date(toDate),
    new Date(toDate)
  ));

  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while(cur <= end) {
    const y = cur.getFullYear();
    const m = cur.getMonth();

    // 월정액
    if(schedule.monthly_amount > 0) {
      const day = Math.min(schedule.monthly_day||5, new Date(y, m+1, 0).getDate());
      const date = `${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      if(date >= schedule.start_date && date >= fromDate && date <= toDate) {
        generated.push({
          date, amount: schedule.monthly_amount,
          description: schedule.monthly_desc||"월 정기료",
          subtype: "monthly",
        });
      }
    }
    // 연 1회
    if(schedule.yearly_amount > 0 && (m+1) === parseInt(schedule.yearly_month||3)) {
      const day = Math.min(schedule.yearly_day||5, new Date(y, m+1, 0).getDate());
      const date = `${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      if(date >= schedule.start_date && date >= fromDate && date <= toDate) {
        generated.push({
          date, amount: schedule.yearly_amount,
          description: schedule.yearly_desc||"연 조정료",
          subtype: "yearly",
        });
      }
    }
    cur.setMonth(cur.getMonth()+1);
  }
  return generated;
}

// ─── 메인 ─────────────────────────────────────────────────────
export default function NoterpLedger() {
  const [txs,       setTxs]       = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [clients,   setClients]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState(null);
  const [view,      setView]      = useState("list"); // list | schedule

  // 필터
  const [ftMonth,  setFtMonth]  = useState(thisMonth());
  const [ftType,   setFtType]   = useState("");
  const [ftStatus, setFtStatus] = useState("");
  const [ftPrj,    setFtPrj]    = useState("");
  const [search,   setSearch]   = useState("");

  // 폼
  const [showTxForm, setShowTxForm] = useState(false);
  const [editTxId,   setEditTxId]   = useState(null);
  const [txForm,     setTxForm]     = useState(emptyTx());

  const [showScForm, setShowScForm] = useState(false);
  const [editScId,   setEditScId]   = useState(null);
  const [scForm,     setScForm]     = useState(emptySc());

  function emptyTx() {
    return {
      date: today(), type:"매출", project_id:"", client_id:"",
      amount:"", status:"예정", description:"",
    };
  }
  function emptySc() {
    return {
      project_id:"", client_id:"", type:"매출", freq:"월정액",
      monthly_amount:"", monthly_day:"5", monthly_desc:"기장료",
      yearly_amount:"", yearly_month:"3", yearly_day:"5", yearly_desc:"조정료",
      start_date: today(), end_date:"",
    };
  }

  useEffect(()=>{
    (async()=>{
      try {
        const [pt, ps, pp, pc] = await Promise.allSettled([
          window.storage.get("noterp_tx"),
          window.storage.get("noterp_sc"),
          window.storage.get("noterp_prj"),
          window.storage.get("noterp_cl"),
        ]);
        if(pt.status==="fulfilled"&&pt.value) setTxs(JSON.parse(pt.value.value));
        if(ps.status==="fulfilled"&&ps.value) setSchedules(JSON.parse(ps.value.value));
        if(pp.status==="fulfilled"&&pp.value) setProjects(JSON.parse(pp.value.value));
        if(pc.status==="fulfilled"&&pc.value) setClients(JSON.parse(pc.value.value));
      } catch{}
      setLoading(false);
    })();
  },[]);

  const persistTx = async d => { try{ await window.storage.set("noterp_tx",JSON.stringify(d)); }catch{} };
  const persistSc = async d => { try{ await window.storage.set("noterp_sc",JSON.stringify(d)); }catch{} };
  const notify = msg => { setToast(msg); setTimeout(()=>setToast(null),2500); };

  // ── 거래 CRUD ──
  const openAddTx = () => { setEditTxId(null); setTxForm(emptyTx()); setShowTxForm(true); };
  const openEditTx = t => { setEditTxId(t.id); setTxForm({...t}); setShowTxForm(true); };

  const submitTx = async () => {
    if(!txForm.client_id||!txForm.amount) { notify("거래처와 금액을 입력해주세요"); return; }
    const client = clients.find(c=>c.id===txForm.client_id);
    const project = projects.find(p=>p.id===txForm.project_id);
    let updated;
    if(editTxId){
      updated = txs.map(t=>t.id===editTxId?{...txForm,id:editTxId,code:t.code,
        client_name:client?.name||"", project_code:project?.code||"", amount:Number(txForm.amount)}:t);
      notify("수정 완료");
    } else {
      const code = genTrCode(txs);
      updated = [{...txForm, id:Date.now().toString(), code,
        client_name:client?.name||"", project_code:project?.code||"",
        amount:Number(txForm.amount),
        created_at:new Date().toISOString()}, ...txs];
      notify(`거래 추가 완료 (${code})`);
    }
    setTxs(updated); await persistTx(updated); setShowTxForm(false);
  };

  const deleteTx = async id => {
    if(!confirm("삭제하시겠습니까?")) return;
    const updated = txs.filter(t=>t.id!==id);
    setTxs(updated); await persistTx(updated); notify("삭제 완료");
  };

  const updateTxStatus = async (id, status) => {
    const updated = txs.map(t=>t.id===id?{...t,status}:t);
    setTxs(updated); await persistTx(updated);
  };

  // ── 정기거래 CRUD ──
  const openAddSc = () => { setEditScId(null); setScForm(emptySc()); setShowScForm(true); };
  const openEditSc = sc => { setEditScId(sc.id); setScForm({...sc}); setShowScForm(true); };

  const submitSc = async () => {
    if(!scForm.client_id) { notify("거래처를 선택해주세요"); return; }
    const client  = clients.find(c=>c.id===scForm.client_id);
    const project = projects.find(p=>p.id===scForm.project_id);
    let updated;
    const data = {
      ...scForm,
      client_name: client?.name||"",
      project_code: project?.code||"",
      monthly_amount: Number(scForm.monthly_amount||0),
      yearly_amount:  Number(scForm.yearly_amount||0),
    };
    if(editScId){
      updated = schedules.map(s=>s.id===editScId?{...data,id:editScId,code:s.code}:s);
      notify("수정 완료");
    } else {
      const code = genScCode(schedules);
      updated = [{...data, id:Date.now().toString(), code, created_at:new Date().toISOString()}, ...schedules];
      notify(`정기거래 등록 완료 (${code})`);
    }
    setSchedules(updated); await persistSc(updated); setShowScForm(false);
  };

  const deleteSc = async id => {
    if(!confirm("정기거래 패턴을 삭제하시겠습니까?")) return;
    const updated = schedules.filter(s=>s.id!==id);
    setSchedules(updated); await persistSc(updated); notify("삭제 완료");
  };

  // ── 정기거래 → 거래 자동생성 ──
  const generateTxs = async () => {
    if(schedules.length===0) { notify("정기거래 패턴이 없어요"); return; }
    if(!confirm("이번 달 + 다음 달 분 정기거래를 생성합니다. 계속할까요?")) return;

    const now = new Date();
    const fromDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
    const toEnd = new Date(now.getFullYear(), now.getMonth()+2, 0);
    const toDate = toEnd.toISOString().slice(0,10);

    const newTxs = [...txs];
    let added = 0;

    for(const sc of schedules) {
      const generated = generateFromSchedule(sc, fromDate, toDate);
      const client  = clients.find(c=>c.id===sc.client_id);
      const project = projects.find(p=>p.id===sc.project_id);

      for(const g of generated) {
        // 중복 방지: 같은 schedule_id + date + subtype 이미 있으면 스킵
        const dup = newTxs.find(t =>
          t.schedule_id===sc.id && t.date===g.date && t.subtype===g.subtype);
        if(dup) continue;

        const code = genTrCode(newTxs);
        newTxs.unshift({
          id: `${Date.now()}-${added}`, code,
          date: g.date, type: sc.type,
          project_id: sc.project_id, client_id: sc.client_id,
          client_name: client?.name||"", project_code: project?.code||"",
          amount: g.amount, status:"예정", description: g.description,
          schedule_id: sc.id, schedule_code: sc.code, subtype: g.subtype,
          created_at: new Date().toISOString(),
        });
        added++;
      }
    }

    setTxs(newTxs); await persistTx(newTxs);
    notify(`✓ ${added}건 자동생성 완료`);
  };

  // ── 필터링 ──
  const filtered = txs.filter(t=>{
    const q = search.toLowerCase();
    const monthMatch = !ftMonth || t.date?.startsWith(ftMonth);
    const typeMatch  = !ftType   || t.type===ftType;
    const statMatch  = !ftStatus || t.status===ftStatus;
    const prjMatch   = !ftPrj    || t.project_id===ftPrj;
    const qMatch = !q || [t.client_name, t.project_code, t.code, t.description].some(v=>(v||"").toLowerCase().includes(q));
    return monthMatch && typeMatch && statMatch && prjMatch && qMatch;
  }).sort((a,b)=>b.date.localeCompare(a.date));

  // ── 합계 ──
  const sumRev = filtered.filter(t=>t.type==="매출").reduce((a,t)=>a+(t.amount||0),0);
  const sumExp = filtered.filter(t=>t.type==="매입").reduce((a,t)=>a+(t.amount||0),0);
  const sumPending = filtered.filter(t=>t.type==="매출"&&t.status!=="입금완료"&&t.status!=="취소").reduce((a,t)=>a+(t.amount||0),0);

  if(loading) return <div style={s.center}><Spin/></div>;

  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .row:hover{background:#f8faff!important}
        textarea:focus,input:focus,select:focus{border-color:#2563eb!important;outline:none}
      `}</style>

      {/* 헤더 */}
      <div style={s.header}>
        <div>
          <div style={s.brand}>NOTERP</div>
          <div style={s.pageTitle}>매출매입장</div>
        </div>
        <div style={s.viewTabs}>
          <button style={{...s.viewBtn,...(view==="list"?s.viewOn:{})}} onClick={()=>setView("list")}>📋 거래내역</button>
          <button style={{...s.viewBtn,...(view==="schedule"?s.viewOn:{})}} onClick={()=>setView("schedule")}>🔁 정기거래</button>
        </div>
      </div>

      {/* 거래내역 화면 */}
      {view==="list"&&(
        <>
          {/* 요약 카드 */}
          <div style={s.summary}>
            <div style={{...s.sumCard, borderLeftColor:"#2563eb"}}>
              <div style={s.sumLabel}>{monthLabel(ftMonth)} 매출</div>
              <div style={{...s.sumVal, color:"#2563eb"}}>{won(sumRev)}</div>
            </div>
            <div style={{...s.sumCard, borderLeftColor:"#dc2626"}}>
              <div style={s.sumLabel}>{monthLabel(ftMonth)} 매입</div>
              <div style={{...s.sumVal, color:"#dc2626"}}>{won(sumExp)}</div>
            </div>
            <div style={{...s.sumCard, borderLeftColor:"#059669"}}>
              <div style={s.sumLabel}>순이익</div>
              <div style={{...s.sumVal, color:"#059669"}}>{won(sumRev-sumExp)}</div>
            </div>
            <div style={{...s.sumCard, borderLeftColor:"#d97706"}}>
              <div style={s.sumLabel}>미수금</div>
              <div style={{...s.sumVal, color:"#d97706"}}>{won(sumPending)}</div>
            </div>
          </div>

          {/* 필터 */}
          <div style={s.toolbar}>
            <input type="month" style={s.monthInp} value={ftMonth} onChange={e=>setFtMonth(e.target.value)}/>
            <input style={s.search} placeholder="거래처 / 프로젝트 / 적요 검색"
              value={search} onChange={e=>setSearch(e.target.value)}/>
            <select style={s.fSel} value={ftType} onChange={e=>setFtType(e.target.value)}>
              <option value="">매출/매입</option>
              <option value="매출">매출</option>
              <option value="매입">매입</option>
            </select>
            <select style={s.fSel} value={ftStatus} onChange={e=>setFtStatus(e.target.value)}>
              <option value="">전체상태</option>
              {TX_STATUS.map(st=><option key={st.value}>{st.value}</option>)}
            </select>
            <select style={s.fSel} value={ftPrj} onChange={e=>setFtPrj(e.target.value)}>
              <option value="">전체프로젝트</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
            <button style={s.addBtn} onClick={openAddTx}>+ 거래 추가</button>
          </div>

          {/* 테이블 */}
          <div style={s.tableWrap}>
            {filtered.length===0?(
              <div style={s.empty}>거래내역이 없어요</div>
            ):(
              <table style={s.table}>
                <thead><tr style={s.thead}>
                  {["날짜","코드","구분","거래처","프로젝트","적요","금액","상태",""].map(h=>(
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(t=>{
                    const ts = txTypeStyle(t.type);
                    return (
                      <tr key={t.id} className="row" style={s.tr}>
                        <td style={s.td}>{fmtDate(t.date)}</td>
                        <td style={{...s.td, ...s.code}}>{t.code}</td>
                        <td style={s.td}>
                          <span style={{...s.badge, color:ts.color, background:ts.bg}}>{t.type}</span>
                        </td>
                        <td style={{...s.td, fontWeight:600}}>{t.client_name}</td>
                        <td style={s.td}>
                          {t.project_code&&<span style={s.prjTag}>{t.project_code}</span>}
                          {t.schedule_code&&<span style={s.scTag} title="정기거래">🔁</span>}
                        </td>
                        <td style={{...s.td, color:"#444"}}>{t.description}</td>
                        <td style={{...s.td, ...s.amount, color:t.type==="매출"?"#2563eb":"#dc2626"}}>
                          {t.type==="매출"?"+":"-"}{won(t.amount)}
                        </td>
                        <td style={s.td}>
                          <select style={{...s.statusSel, ...statusStyle(t.status)}}
                            value={t.status} onChange={e=>updateTxStatus(t.id, e.target.value)}>
                            {TX_STATUS.map(st=><option key={st.value}>{st.value}</option>)}
                          </select>
                        </td>
                        <td style={s.td}>
                          <button style={s.miniBtn} onClick={()=>openEditTx(t)}>수정</button>
                          <button style={s.miniDel} onClick={()=>deleteTx(t.id)}>×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* 정기거래 화면 */}
      {view==="schedule"&&(
        <>
          <div style={s.scHead}>
            <div>
              <div style={s.scTitle}>정기거래 패턴 ({schedules.length}개)</div>
              <div style={s.scDesc}>월정액·연1회 자동발생 거래를 등록하세요</div>
            </div>
            <div style={{display:"flex", gap:8}}>
              <button style={s.genBtn} onClick={generateTxs} disabled={schedules.length===0}>
                ⚡ 거래 자동생성
              </button>
              <button style={s.addBtn} onClick={openAddSc}>+ 정기거래 추가</button>
            </div>
          </div>

          <div style={s.scList}>
            {schedules.length===0?(
              <div style={s.empty}>정기거래 패턴이 없어요</div>
            ):schedules.map(sc=>(
              <div key={sc.id} style={s.scCard}>
                <div style={s.scCardTop}>
                  <div>
                    <span style={{...s.code, fontSize:11, marginRight:8}}>{sc.code}</span>
                    <span style={{...s.badge, ...txTypeStyle(sc.type)}}>{sc.type}</span>
                    {sc.project_code&&<span style={{...s.prjTag, marginLeft:6}}>{sc.project_code}</span>}
                  </div>
                  <div style={{display:"flex", gap:6}}>
                    <button style={s.miniBtn} onClick={()=>openEditSc(sc)}>수정</button>
                    <button style={s.miniDel} onClick={()=>deleteSc(sc.id)}>×</button>
                  </div>
                </div>
                <div style={s.scClient}>{sc.client_name}</div>
                <div style={s.scDetail}>
                  {sc.monthly_amount>0&&(
                    <div style={s.scLine}>
                      <span style={s.scIcon}>📅</span>
                      매월 {sc.monthly_day}일 · <b>{won(sc.monthly_amount)}</b> · {sc.monthly_desc}
                    </div>
                  )}
                  {sc.yearly_amount>0&&(
                    <div style={s.scLine}>
                      <span style={s.scIcon}>🗓️</span>
                      매년 {sc.yearly_month}월 {sc.yearly_day}일 · <b>{won(sc.yearly_amount)}</b> · {sc.yearly_desc}
                    </div>
                  )}
                </div>
                <div style={s.scPeriod}>
                  {fmtDate(sc.start_date)} ~ {sc.end_date?fmtDate(sc.end_date):"진행중"}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 거래 폼 */}
      {showTxForm&&(
        <div style={s.overlay} onClick={()=>setShowTxForm(false)}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            <div style={s.mTitle}>{editTxId?"거래 수정":"거래 추가"}</div>
            <div style={s.grid}>
              <FL label="날짜">
                <input type="date" style={s.inp} value={txForm.date}
                  onChange={e=>setTxForm(f=>({...f,date:e.target.value}))}/>
              </FL>
              <FL label="구분">
                <div style={{display:"flex", gap:14, paddingTop:6}}>
                  {TX_TYPES.map(t=>(
                    <label key={t.value} style={{display:"flex",alignItems:"center",gap:5,fontSize:13,cursor:"pointer",color:t.color, fontWeight:txForm.type===t.value?700:400}}>
                      <input type="radio" checked={txForm.type===t.value}
                        onChange={()=>setTxForm(f=>({...f,type:t.value}))}/>
                      {t.value}
                    </label>
                  ))}
                </div>
              </FL>
              <FL label="거래처 *">
                <select style={s.inp} value={txForm.client_id}
                  onChange={e=>setTxForm(f=>({...f,client_id:e.target.value}))}>
                  <option value="">선택</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </FL>
              <FL label="프로젝트">
                <select style={s.inp} value={txForm.project_id}
                  onChange={e=>setTxForm(f=>({...f,project_id:e.target.value}))}>
                  <option value="">선택</option>
                  {projects.filter(p=>!txForm.client_id||p.client_id===txForm.client_id).map(p=>(
                    <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                  ))}
                </select>
              </FL>
              <FL label="금액 *">
                <input type="number" style={s.inp} value={txForm.amount} placeholder="500000"
                  onChange={e=>setTxForm(f=>({...f,amount:e.target.value}))}/>
              </FL>
              <FL label="상태">
                <select style={s.inp} value={txForm.status}
                  onChange={e=>setTxForm(f=>({...f,status:e.target.value}))}>
                  {TX_STATUS.map(st=><option key={st.value}>{st.value}</option>)}
                </select>
              </FL>
              <FL label="적요" full>
                <input style={s.inp} value={txForm.description} placeholder="4월 기장료"
                  onChange={e=>setTxForm(f=>({...f,description:e.target.value}))}/>
              </FL>
            </div>
            <div style={s.mFoot}>
              <button style={s.cancelBtn} onClick={()=>setShowTxForm(false)}>취소</button>
              <button style={s.saveBtn} onClick={submitTx}>{editTxId?"수정 완료":"추가"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 정기거래 폼 */}
      {showScForm&&(
        <div style={s.overlay} onClick={()=>setShowScForm(false)}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            <div style={s.mTitle}>{editScId?"정기거래 수정":"정기거래 등록"}</div>
            <div style={s.grid}>
              <FL label="거래처 *">
                <select style={s.inp} value={scForm.client_id}
                  onChange={e=>setScForm(f=>({...f,client_id:e.target.value}))}>
                  <option value="">선택</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FL>
              <FL label="프로젝트">
                <select style={s.inp} value={scForm.project_id}
                  onChange={e=>setScForm(f=>({...f,project_id:e.target.value}))}>
                  <option value="">선택</option>
                  {projects.filter(p=>!scForm.client_id||p.client_id===scForm.client_id).map(p=>(
                    <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                  ))}
                </select>
              </FL>
              <FL label="구분">
                <div style={{display:"flex", gap:14, paddingTop:6}}>
                  {TX_TYPES.map(t=>(
                    <label key={t.value} style={{display:"flex",alignItems:"center",gap:5,fontSize:13,cursor:"pointer",color:t.color, fontWeight:scForm.type===t.value?700:400}}>
                      <input type="radio" checked={scForm.type===t.value}
                        onChange={()=>setScForm(f=>({...f,type:t.value}))}/>
                      {t.value}
                    </label>
                  ))}
                </div>
              </FL>
              <FL label="시작일">
                <input type="date" style={s.inp} value={scForm.start_date}
                  onChange={e=>setScForm(f=>({...f,start_date:e.target.value}))}/>
              </FL>

              <div style={{...s.scSection, gridColumn:"1/-1"}}>📅 월 정액 (없으면 비워두세요)</div>
              <FL label="월 금액">
                <input type="number" style={s.inp} value={scForm.monthly_amount} placeholder="500000"
                  onChange={e=>setScForm(f=>({...f,monthly_amount:e.target.value}))}/>
              </FL>
              <FL label="매월 며칠">
                <input type="number" style={s.inp} value={scForm.monthly_day} min="1" max="31"
                  onChange={e=>setScForm(f=>({...f,monthly_day:e.target.value}))}/>
              </FL>
              <FL label="월정액 적요" full>
                <input style={s.inp} value={scForm.monthly_desc} placeholder="기장료"
                  onChange={e=>setScForm(f=>({...f,monthly_desc:e.target.value}))}/>
              </FL>

              <div style={{...s.scSection, gridColumn:"1/-1"}}>🗓️ 연 1회 (없으면 비워두세요)</div>
              <FL label="연 금액">
                <input type="number" style={s.inp} value={scForm.yearly_amount} placeholder="1000000"
                  onChange={e=>setScForm(f=>({...f,yearly_amount:e.target.value}))}/>
              </FL>
              <FL label="발생 월">
                <select style={s.inp} value={scForm.yearly_month}
                  onChange={e=>setScForm(f=>({...f,yearly_month:e.target.value}))}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m}>{m}월</option>)}
                </select>
              </FL>
              <FL label="발생 일">
                <input type="number" style={s.inp} value={scForm.yearly_day} min="1" max="31"
                  onChange={e=>setScForm(f=>({...f,yearly_day:e.target.value}))}/>
              </FL>
              <FL label="연1회 적요" full>
                <input style={s.inp} value={scForm.yearly_desc} placeholder="조정료"
                  onChange={e=>setScForm(f=>({...f,yearly_desc:e.target.value}))}/>
              </FL>
            </div>
            <div style={s.mFoot}>
              <button style={s.cancelBtn} onClick={()=>setShowScForm(false)}>취소</button>
              <button style={s.saveBtn} onClick={submitSc}>{editScId?"수정 완료":"등록"}</button>
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
    border:"3px solid #e5e5e5",borderTopColor:"#2563eb",
    animation:"spin 0.8s linear infinite"}}/>;
}
function FL({label,children,full}){
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4,...(full?{gridColumn:"1/-1"}:{})}}>
      <label style={{fontSize:11,color:"#666",fontWeight:500}}>{label}</label>
      {children}
    </div>
  );
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

  summary:    {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,padding:"20px 32px 0"},
  sumCard:    {background:"#fff",borderRadius:10,padding:"14px 18px",borderLeft:"4px solid #2563eb",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"},
  sumLabel:   {fontSize:11,color:"#888",fontWeight:500,marginBottom:6},
  sumVal:     {fontSize:18,fontWeight:700},

  toolbar:    {display:"flex",alignItems:"center",gap:8,padding:"16px 32px",flexWrap:"wrap"},
  monthInp:   {border:"1px solid #ddd",borderRadius:8,padding:"8px 12px",fontSize:13,background:"#fff",fontWeight:600,color:"#2563eb"},
  search:     {flex:1,minWidth:160,border:"1px solid #ddd",borderRadius:8,padding:"8px 14px",fontSize:13,background:"#fff",outline:"none"},
  fSel:       {border:"1px solid #ddd",borderRadius:8,padding:"8px 12px",fontSize:13,background:"#fff",cursor:"pointer"},
  addBtn:     {background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"},

  tableWrap:  {padding:"0 32px 32px",overflowX:"auto"},
  table:      {width:"100%",borderCollapse:"collapse",background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  thead:      {background:"#f8f9fa"},
  th:         {padding:"11px 12px",fontSize:11,fontWeight:600,color:"#888",textAlign:"left",borderBottom:"1px solid #eee",whiteSpace:"nowrap"},
  tr:         {borderBottom:"1px solid #f5f5f5",transition:"background 0.1s"},
  td:         {padding:"11px 12px",fontSize:13},
  code:       {fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#2563eb"},
  amount:     {fontFamily:"monospace",fontWeight:700,textAlign:"right"},
  badge:      {fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,display:"inline-block"},
  prjTag:     {fontSize:10,background:"#eff6ff",color:"#2563eb",padding:"2px 7px",borderRadius:5,fontFamily:"monospace",fontWeight:600},
  scTag:      {marginLeft:5,fontSize:11},
  statusSel:  {fontSize:11,fontWeight:600,padding:"3px 8px",borderRadius:20,border:"1px solid currentColor",cursor:"pointer"},
  miniBtn:    {background:"#f0f4ff",color:"#2563eb",border:"none",borderRadius:5,padding:"3px 9px",fontSize:11,fontWeight:600,cursor:"pointer",marginRight:3},
  miniDel:    {background:"#fff1f0",color:"#ef4444",border:"none",borderRadius:5,padding:"3px 8px",fontSize:13,fontWeight:600,cursor:"pointer",lineHeight:1},
  empty:      {textAlign:"center",color:"#bbb",fontSize:14,padding:"60px 0"},

  scHead:     {display:"flex",alignItems:"flex-end",justifyContent:"space-between",padding:"24px 32px 16px"},
  scTitle:    {fontSize:16,fontWeight:700,marginBottom:4},
  scDesc:     {fontSize:12,color:"#888"},
  genBtn:     {background:"linear-gradient(135deg,#2563eb,#7c3aed)",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer"},
  scList:     {display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(380px,1fr))",gap:14,padding:"0 32px 32px"},
  scCard:     {background:"#fff",borderRadius:12,padding:"18px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  scCardTop:  {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10},
  scClient:   {fontSize:15,fontWeight:700,marginBottom:12},
  scDetail:   {display:"flex",flexDirection:"column",gap:7,paddingTop:10,borderTop:"1px solid #f0f0f0"},
  scLine:     {fontSize:13,color:"#444",lineHeight:1.5,display:"flex",alignItems:"center",gap:6},
  scIcon:     {fontSize:14},
  scPeriod:   {fontSize:11,color:"#aaa",marginTop:10,paddingTop:8,borderTop:"1px solid #f5f5f5"},
  scSection:  {fontSize:12,fontWeight:700,color:"#2563eb",marginTop:8,paddingTop:8,borderTop:"1px dashed #e0e7ff"},

  overlay:    {position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000},
  modal:      {background:"#fff",borderRadius:14,padding:"26px",width:580,maxWidth:"94vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"},
  mTitle:     {fontSize:17,fontWeight:700,marginBottom:18},
  grid:       {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px 18px"},
  inp:        {border:"1px solid #ddd",borderRadius:7,padding:"8px 12px",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"},
  mFoot:      {display:"flex",justifyContent:"flex-end",gap:8,marginTop:22,paddingTop:16,borderTop:"1px solid #f0f0f0"},
  cancelBtn:  {background:"#f5f5f5",color:"#555",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:"pointer"},
  saveBtn:    {background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"9px 22px",fontSize:13,fontWeight:600,cursor:"pointer"},

  toast:      {position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#1a1a1a",color:"#fff",padding:"10px 20px",borderRadius:8,fontSize:13,fontWeight:500,zIndex:2000,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"},
};
