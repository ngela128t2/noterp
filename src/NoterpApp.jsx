import { useState, useEffect } from "react";

// ─── 유틸 ─────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) { if(!d) return ""; const [y,m,day]=d.split("-"); return `${y}.${m}.${day}`; }
function fmtMonth(y, m) { return `${y}년 ${m+1}월`; }

const WEEKDAYS = ["일","월","화","수","목","금","토"];
const TAGS = ["계약","미팅","현장","서류","검토","완료","기타"];

function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month+1, 0);
  const startWeekday = first.getDay();
  const daysInMonth = last.getDate();
  const grid = [];
  for(let i=0; i<startWeekday; i++) grid.push(null);
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    grid.push({ day: d, date: dateStr });
  }
  return grid;
}
function isPast(d) { return d < today(); }
function isToday(d) { return d === today(); }
function isFuture(d) { return d > today(); }

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

// ─── 메인 ─────────────────────────────────────────────────────
export default function NoterpDashboard() {
  const isMobile = useIsMobile();
  const [memos,    setMemos]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [timeline, setTimeline] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selDate, setSelDate] = useState(today());

  const [showQuick, setShowQuick] = useState(false);
  const [quickForm, setQuickForm] = useState({
    date: today(), content:"", project_id:"", tag:"",
  });

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

  const persistTl = async d => { try{ await window.storage.set("noterp_tl",JSON.stringify(d)); }catch{} };
  const notify = msg => { setToast(msg); setTimeout(()=>setToast(null),2500); };

  // 데이터 모으기
  const allEntries = [];
  Object.entries(timeline).forEach(([prjId, entries])=>{
    const prj = projects.find(p=>p.id===prjId);
    (entries||[]).forEach(e=>{
      allEntries.push({ ...e, project_id: prjId, project: prj });
    });
  });

  const entriesByDate = {};
  allEntries.forEach(e=>{
    if(!entriesByDate[e.date]) entriesByDate[e.date]=[];
    entriesByDate[e.date].push(e);
  });
  memos.forEach(m=>{
    if(!entriesByDate[m.date]) entriesByDate[m.date]=[];
    if((m.entries||[]).length===0) {
      entriesByDate[m.date].push({
        id: `memo-${m.id}`, date: m.date, content: m.content, type: "memo_only",
      });
    }
  });

  const todayEntries = (entriesByDate[today()]||[]);
  const futureEntries = allEntries
    .filter(e => isFuture(e.date))
    .sort((a,b)=>a.date.localeCompare(b.date))
    .slice(0,8);
  const activeProjects = projects.filter(p=>p.status==="진행중");
  const recentEntries = allEntries
    .filter(e => isPast(e.date) || isToday(e.date))
    .sort((a,b)=> b.date.localeCompare(a.date) || (b.created_at||"").localeCompare(a.created_at||""))
    .slice(0,6);

  const handleQuickSave = async () => {
    if(!quickForm.content.trim()||!quickForm.project_id) {
      notify("내용과 프로젝트를 선택해주세요"); return;
    }
    const pid = quickForm.project_id;
    const cur = timeline[pid]||[];
    const ne = {
      id: Date.now().toString(),
      date: quickForm.date, content: quickForm.content,
      tag: quickForm.tag||"", type: "direct",
      created_at: new Date().toISOString(),
    };
    const updated = [ne,...cur].sort((a,b)=>b.date.localeCompare(a.date));
    const newTl = {...timeline, [pid]: updated};
    setTimeline(newTl); await persistTl(newTl);
    notify(isFuture(quickForm.date)||isToday(quickForm.date) ? "계획 추가 완료" : "기록 추가 완료");
    setShowQuick(false);
    setQuickForm({date:selDate,content:"",project_id:"",tag:""});
  };

  const grid = getMonthGrid(year, month);
  const selEntries = entriesByDate[selDate]||[];

  if(loading) return <div style={s.center}><Spin/></div>;

  // ─── 모바일 레이아웃 ─────────────────────────────────────
  if (isMobile) {
    return (
      <div style={s.mRoot}>
        <style>{`
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes fadeIn{from{opacity:0}to{opacity:1}}
          .day-cell:active{background:#e0e7ff!important}
          textarea:focus,input:focus,select:focus{border-color:#2563eb!important;outline:none}
        `}</style>

        {/* 상단 액션 */}
        <div style={s.mActionRow}>
          <div style={s.mDateLabel}>{fmtDate(today())}</div>
          <button style={s.mQuickBtn} onClick={()=>{
            setQuickForm({date:selDate||today(),content:"",project_id:"",tag:""});
            setShowQuick(true);
          }}>+ 빠른 추가</button>
        </div>

        {/* 캘린더 */}
        <div style={s.mCalCard}>
          <div style={s.mCalHeader}>
            <button style={s.navBtn} onClick={()=>{
              if(month===0){ setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1);
            }}>‹</button>
            <div style={s.mCalTitle}>{fmtMonth(year, month)}</div>
            <button style={s.navBtn} onClick={()=>{
              if(month===11){ setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1);
            }}>›</button>
          </div>
          <div style={s.weekRow}>
            {WEEKDAYS.map((w,i)=>(
              <div key={w} style={{...s.weekday, color: i===0?"#ef4444":i===6?"#2563eb":"#888"}}>{w}</div>
            ))}
          </div>
          <div style={s.mGrid}>
            {grid.map((cell, i)=>{
              if(!cell) return <div key={i} style={s.mDayEmpty}/>;
              const dayOfWeek = i%7;
              const entries = entriesByDate[cell.date]||[];
              const isSel = cell.date===selDate;
              const isTd  = isToday(cell.date);
              const isFut = isFuture(cell.date);
              return (
                <div key={i} className="day-cell"
                  style={{
                    ...s.mDay,
                    ...(isTd ? s.mDayToday : {}),
                    ...(isSel ? s.mDaySel : {}),
                  }}
                  onClick={()=>setSelDate(cell.date)}>
                  <div style={{
                    ...s.mDayNum,
                    color: dayOfWeek===0?"#ef4444":dayOfWeek===6?"#2563eb":"#222",
                    ...(isTd ? {color:"#fff",fontWeight:700} : {}),
                  }}>{cell.day}</div>
                  {entries.length>0&&(
                    <div style={s.mDots}>
                      {entries.slice(0,3).map((e,j)=>(
                        <div key={j} style={{
                          ...s.mDot,
                          background: e.type==="memo"?"#7c3aed":isFut?"#d97706":"#2563eb",
                        }}/>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 선택일 상세 */}
        <div style={s.mCard}>
          <div style={s.mCardHead}>
            <span style={s.mCardTitle}>📅 {fmtDate(selDate)}</span>
            <span style={s.mBadge}>
              {isToday(selDate) ? "오늘" : isFuture(selDate) ? "계획" : "기록"}
            </span>
          </div>
          {selEntries.length===0 ? (
            <div style={s.mEmpty}>이 날엔 아직 기록이 없어요</div>
          ) : (
            <div style={s.mList}>
              {selEntries.map((e,i)=>(
                <div key={i} style={s.mItem}>
                  <div style={s.mItemHead}>
                    {e.project ? (
                      <span style={s.mPrj}>{e.project.code}</span>
                    ) : e.type==="memo_only" ? (
                      <span style={{...s.mPrj,color:"#7c3aed"}}>📝 메모</span>
                    ) : null}
                    {e.tag&&<span style={s.mTag}>{e.tag}</span>}
                  </div>
                  <div style={s.mText}>{e.content || e.snippet}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 오늘 */}
        <div style={s.mCard}>
          <div style={s.mCardHead}>
            <span style={s.mCardTitle}>오늘 일정</span>
            <span style={s.mCount}>{todayEntries.length}건</span>
          </div>
          {todayEntries.length===0 ? (
            <div style={s.mEmpty}>오늘 일정이 없어요</div>
          ) : (
            <div style={s.mList}>
              {todayEntries.slice(0,5).map((e,i)=>(
                <div key={i} style={s.mItem}>
                  <div style={s.mItemHead}>
                    {e.project && <span style={s.mPrj}>{e.project.code}</span>}
                    {e.tag && <span style={s.mTag}>{e.tag}</span>}
                  </div>
                  <div style={s.mText}>{e.content || e.snippet}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 다가오는 계획 */}
        <div style={s.mCard}>
          <div style={s.mCardHead}>
            <span style={s.mCardTitle}>📌 다가오는 계획</span>
            <span style={s.mCount}>{futureEntries.length}건</span>
          </div>
          {futureEntries.length===0 ? (
            <div style={s.mEmpty}>예정된 계획이 없어요</div>
          ) : (
            <div style={s.mList}>
              {futureEntries.map((e,i)=>(
                <div key={i} style={s.mItem}>
                  <div style={s.mItemHead}>
                    <span style={s.mFutDate}>{fmtDate(e.date)}</span>
                    {e.project && <span style={s.mPrj}>{e.project.code}</span>}
                    {e.tag && <span style={s.mTag}>{e.tag}</span>}
                  </div>
                  <div style={s.mText}>{e.content || e.snippet}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 진행중 프로젝트 */}
        <div style={s.mCard}>
          <div style={s.mCardHead}>
            <span style={s.mCardTitle}>🎯 진행중 프로젝트</span>
            <span style={s.mCount}>{activeProjects.length}개</span>
          </div>
          {activeProjects.length===0 ? (
            <div style={s.mEmpty}>진행중 프로젝트가 없어요</div>
          ) : (
            <div style={s.mList}>
              {activeProjects.slice(0,8).map(p=>{
                const tlCount = (timeline[p.id]||[]).length;
                return (
                  <div key={p.id} style={s.mPrjItem}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={s.mPrjCode}>{p.code}</div>
                      <div style={s.mPrjName}>{p.client_name} · {p.name}</div>
                    </div>
                    <div style={s.mPrjCount}>{tlCount}건</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 빠른 추가 모달 */}
        {showQuick && (
          <div style={s.overlay} onClick={()=>setShowQuick(false)}>
            <div style={s.mModal} onClick={e=>e.stopPropagation()}>
              <div style={s.mModalHead}>
                <div style={s.mModalTitle}>
                  {isFuture(quickForm.date)||isToday(quickForm.date) ? "계획 추가" : "기록 추가"}
                </div>
                <button style={s.mModalClose} onClick={()=>setShowQuick(false)}>×</button>
              </div>
              <FL label="날짜">
                <input type="date" style={s.inp} value={quickForm.date}
                  onChange={e=>setQuickForm(f=>({...f,date:e.target.value}))}/>
              </FL>
              <FL label="태그">
                <select style={s.inp} value={quickForm.tag}
                  onChange={e=>setQuickForm(f=>({...f,tag:e.target.value}))}>
                  <option value="">선택</option>
                  {TAGS.map(t=><option key={t}>{t}</option>)}
                </select>
              </FL>
              <FL label="프로젝트 *">
                <select style={s.inp} value={quickForm.project_id}
                  onChange={e=>setQuickForm(f=>({...f,project_id:e.target.value}))}>
                  <option value="">선택</option>
                  {activeProjects.map(p=>(
                    <option key={p.id} value={p.id}>{p.code} · {p.client_name}</option>
                  ))}
                </select>
              </FL>
              <FL label="내용 *">
                <textarea style={{...s.inp,height:90,resize:"vertical"}}
                  placeholder="계획·기록 내용"
                  value={quickForm.content}
                  onChange={e=>setQuickForm(f=>({...f,content:e.target.value}))}/>
              </FL>
              <button style={s.mSaveBtn} onClick={handleQuickSave}>추가하기</button>
            </div>
          </div>
        )}

        {toast && <div style={s.toast}>{toast}</div>}
      </div>
    );
  }

  // ─── 데스크톱 레이아웃 ─────────────────────────────────────
  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .day-cell:hover{background:#f0f4ff!important}
        textarea:focus,input:focus,select:focus{border-color:#2563eb!important;outline:none}
      `}</style>

      <div style={s.header}>
        <div>
          <div style={s.brand}>NOTERP</div>
          <div style={s.pageTitle}>대시보드</div>
        </div>
        <button style={s.quickBtn} onClick={()=>{
          setQuickForm({date:selDate||today(),content:"",project_id:"",tag:""});
          setShowQuick(true);
        }}>+ 빠른 추가</button>
      </div>

      <div style={s.body}>
        <div style={s.left}>
          <div style={s.calCard}>
            <div style={s.calHeader}>
              <button style={s.navBtn} onClick={()=>{
                if(month===0){ setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1);
              }}>‹</button>
              <div style={s.calTitle}>{fmtMonth(year, month)}</div>
              <button style={s.navBtn} onClick={()=>{
                if(month===11){ setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1);
              }}>›</button>
            </div>
            <div style={s.weekRow}>
              {WEEKDAYS.map((w,i)=>(
                <div key={w} style={{...s.weekday, color: i===0?"#ef4444":i===6?"#2563eb":"#888"}}>{w}</div>
              ))}
            </div>
            <div style={s.grid}>
              {grid.map((cell, i)=>{
                if(!cell) return <div key={i} style={s.dayEmpty}/>;
                const dayOfWeek = i%7;
                const entries = entriesByDate[cell.date]||[];
                const entryCount = entries.length;
                const isSel  = cell.date===selDate;
                const isTd   = isToday(cell.date);
                const isFut  = isFuture(cell.date);
                return (
                  <div key={i} className="day-cell"
                    style={{
                      ...s.day,
                      ...(isTd ? s.dayToday : {}),
                      ...(isSel ? s.daySel : {}),
                      cursor:"pointer",
                    }}
                    onClick={()=>setSelDate(cell.date)}>
                    <div style={{
                      ...s.dayNum,
                      color: dayOfWeek===0?"#ef4444":dayOfWeek===6?"#2563eb":"#222",
                      ...(isTd ? {color:"#fff",fontWeight:700} : {}),
                    }}>{cell.day}</div>
                    {entryCount>0&&(
                      <div style={s.dots}>
                        {entries.slice(0,3).map((e,j)=>(
                          <div key={j} style={{
                            ...s.dot,
                            background: e.type==="memo"?"#7c3aed":isFut?"#d97706":"#2563eb",
                          }}/>
                        ))}
                        {entryCount>3&&<div style={s.dotMore}>+{entryCount-3}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={s.legend}>
              <span style={s.legendItem}><span style={{...s.dot,background:"#2563eb"}}/>기록·직접입력</span>
              <span style={s.legendItem}><span style={{...s.dot,background:"#7c3aed"}}/>메모연동</span>
              <span style={s.legendItem}><span style={{...s.dot,background:"#d97706"}}/>계획(미래)</span>
            </div>
          </div>

          <div style={s.dayDetail}>
            <div style={s.ddHeader}>
              <div style={s.ddDate}>{fmtDate(selDate)}</div>
              <div style={s.ddBadge}>
                {isToday(selDate) ? "오늘" : isFuture(selDate) ? "계획" : "기록"}
              </div>
            </div>
            {selEntries.length===0 ? (
              <div style={s.ddEmpty}>이 날엔 아직 기록이 없어요</div>
            ) : (
              <div style={s.ddList}>
                {selEntries.map((e,i)=>(
                  <div key={i} style={s.ddItem}>
                    <div style={s.ddItemHead}>
                      {e.project ? (
                        <span style={s.ddPrj}>{e.project.code} · {e.project.client_name}</span>
                      ) : e.type==="memo_only" ? (
                        <span style={{...s.ddPrj,color:"#7c3aed"}}>📝 데일리 메모</span>
                      ) : (
                        <span style={{...s.ddPrj,color:"#aaa"}}>프로젝트 미연결</span>
                      )}
                      {e.tag&&<span style={s.ddTag}>{e.tag}</span>}
                    </div>
                    <div style={s.ddText}>{e.content || e.snippet}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={s.right}>
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardTitle}>오늘 ({fmtDate(today())})</span>
              <span style={s.cardCount}>{todayEntries.length}건</span>
            </div>
            {todayEntries.length===0 ? (
              <div style={s.cardEmpty}>오늘 일정이 없어요</div>
            ) : (
              <div style={s.cardList}>
                {todayEntries.slice(0,5).map((e,i)=>(
                  <div key={i} style={s.cItem}>
                    <div style={s.cItemHead}>
                      {e.project && <span style={s.cPrj}>{e.project.code}</span>}
                      {e.tag && <span style={s.cTag}>{e.tag}</span>}
                    </div>
                    <div style={s.cText}>{e.content || e.snippet}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardTitle}>📌 다가오는 계획</span>
              <span style={s.cardCount}>{futureEntries.length}건</span>
            </div>
            {futureEntries.length===0 ? (
              <div style={s.cardEmpty}>예정된 계획이 없어요</div>
            ) : (
              <div style={s.cardList}>
                {futureEntries.map((e,i)=>(
                  <div key={i} style={s.cItem}>
                    <div style={s.cItemHead}>
                      <span style={s.cFutDate}>{fmtDate(e.date)}</span>
                      {e.project && <span style={s.cPrj}>{e.project.code}</span>}
                      {e.tag && <span style={s.cTag}>{e.tag}</span>}
                    </div>
                    <div style={s.cText}>{e.content || e.snippet}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardTitle}>🎯 진행중 프로젝트</span>
              <span style={s.cardCount}>{activeProjects.length}개</span>
            </div>
            {activeProjects.length===0 ? (
              <div style={s.cardEmpty}>진행중 프로젝트가 없어요</div>
            ) : (
              <div style={s.cardList}>
                {activeProjects.slice(0,6).map(p=>{
                  const tlCount = (timeline[p.id]||[]).length;
                  return (
                    <div key={p.id} style={s.prjItem}>
                      <div style={s.prjLeft}>
                        <div style={s.prjCode}>{p.code}</div>
                        <div style={s.prjName}>{p.client_name} · {p.name}</div>
                      </div>
                      <div style={s.prjRight}>{tlCount}건</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardTitle}>최근 활동</span>
            </div>
            {recentEntries.length===0 ? (
              <div style={s.cardEmpty}>최근 활동이 없어요</div>
            ) : (
              <div style={s.cardList}>
                {recentEntries.map((e,i)=>(
                  <div key={i} style={s.cItem}>
                    <div style={s.cItemHead}>
                      <span style={s.cPastDate}>{fmtDate(e.date)}</span>
                      {e.project && <span style={s.cPrj}>{e.project.code}</span>}
                    </div>
                    <div style={s.cText}>{e.content || e.snippet}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showQuick && (
        <div style={s.overlay} onClick={()=>setShowQuick(false)}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            <div style={s.mTitleD}>
              {isFuture(quickForm.date)||isToday(quickForm.date) ? "계획 추가" : "기록 추가"}
            </div>
            <div style={s.formGrid}>
              <FL label="날짜">
                <input type="date" style={s.inp} value={quickForm.date}
                  onChange={e=>setQuickForm(f=>({...f,date:e.target.value}))}/>
              </FL>
              <FL label="태그">
                <select style={s.inp} value={quickForm.tag}
                  onChange={e=>setQuickForm(f=>({...f,tag:e.target.value}))}>
                  <option value="">선택</option>
                  {TAGS.map(t=><option key={t}>{t}</option>)}
                </select>
              </FL>
              <FL label="프로젝트 *" full>
                <select style={s.inp} value={quickForm.project_id}
                  onChange={e=>setQuickForm(f=>({...f,project_id:e.target.value}))}>
                  <option value="">선택</option>
                  {activeProjects.map(p=>(
                    <option key={p.id} value={p.id}>{p.code} · {p.client_name} {p.name}</option>
                  ))}
                </select>
              </FL>
              <FL label="내용 *" full>
                <textarea style={{...s.inp,height:90,resize:"vertical"}}
                  value={quickForm.content}
                  onChange={e=>setQuickForm(f=>({...f,content:e.target.value}))}/>
              </FL>
            </div>
            <div style={s.mFoot}>
              <button style={s.cancelBtn} onClick={()=>setShowQuick(false)}>취소</button>
              <button style={s.saveBtn} onClick={handleQuickSave}>추가</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={s.toast}>{toast}</div>}
    </div>
  );
}

function Spin({size=22}){
  return <div style={{width:size,height:size,borderRadius:"50%",
    border:"3px solid #e5e5e5",borderTopColor:"#2563eb",
    animation:"spin 0.8s linear infinite"}}/>;
}
function FL({label,children,full}){
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12,...(full?{gridColumn:"1/-1"}:{})}}>
      <label style={{fontSize:11,color:"#666",fontWeight:500}}>{label}</label>
      {children}
    </div>
  );
}

const s = {
  root:       {fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",background:"#f5f5f3",minHeight:"100vh",color:"#1a1a1a"},
  center:     {display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"},
  header:     {display:"flex",alignItems:"flex-end",justifyContent:"space-between",padding:"24px 32px 18px",background:"#fff",borderBottom:"1px solid #e5e5e5"},
  brand:      {fontSize:10,fontWeight:700,letterSpacing:4,color:"#2563eb",marginBottom:4},
  pageTitle:  {fontSize:21,fontWeight:700},
  quickBtn:   {background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"10px 18px",fontSize:13,fontWeight:600,cursor:"pointer"},

  body:       {display:"flex",gap:20,padding:"20px 32px",alignItems:"flex-start"},
  left:       {flex:1,display:"flex",flexDirection:"column",gap:16,minWidth:0},
  right:      {width:340,display:"flex",flexDirection:"column",gap:14,flexShrink:0},

  calCard:    {background:"#fff",borderRadius:12,padding:"22px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  calHeader:  {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18},
  calTitle:   {fontSize:18,fontWeight:700},
  navBtn:     {background:"#f5f5f5",border:"none",borderRadius:8,width:32,height:32,fontSize:18,cursor:"pointer",color:"#555",fontWeight:700},
  weekRow:    {display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:8},
  weekday:    {textAlign:"center",fontSize:11,fontWeight:600,paddingBottom:4},
  grid:       {display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4},
  day:        {minHeight:64,borderRadius:8,padding:"5px 6px",background:"#fafafa",position:"relative",transition:"all 0.1s"},
  dayEmpty:   {minHeight:64},
  dayToday:   {background:"#2563eb"},
  daySel:     {boxShadow:"0 0 0 2px #2563eb",background:"#fff"},
  dayNum:     {fontSize:12,fontWeight:500},
  dots:       {display:"flex",gap:3,marginTop:4,alignItems:"center"},
  dot:        {width:6,height:6,borderRadius:"50%",display:"inline-block"},
  dotMore:    {fontSize:9,color:"#888",fontWeight:600},
  legend:     {display:"flex",gap:14,marginTop:16,paddingTop:14,borderTop:"1px solid #f0f0f0",flexWrap:"wrap"},
  legendItem: {fontSize:11,color:"#666",display:"flex",alignItems:"center",gap:5},

  dayDetail:  {background:"#fff",borderRadius:12,padding:"20px 22px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  ddHeader:   {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingBottom:14,borderBottom:"1px solid #f0f0f0"},
  ddDate:     {fontSize:16,fontWeight:700},
  ddBadge:    {fontSize:11,fontWeight:600,background:"#eff6ff",color:"#2563eb",padding:"3px 10px",borderRadius:20},
  ddEmpty:    {textAlign:"center",color:"#bbb",fontSize:13,padding:"24px 0"},
  ddList:     {display:"flex",flexDirection:"column",gap:8},
  ddItem:     {padding:"10px 12px",background:"#fafafa",borderRadius:8,borderLeft:"3px solid #2563eb"},
  ddItemHead: {display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"},
  ddPrj:      {fontSize:11,fontWeight:600,color:"#2563eb",fontFamily:"monospace"},
  ddTag:      {fontSize:10,background:"#fff",color:"#666",padding:"1px 7px",borderRadius:5,border:"1px solid #e5e5e5"},
  ddText:     {fontSize:13,color:"#222",lineHeight:1.5,whiteSpace:"pre-wrap"},

  card:       {background:"#fff",borderRadius:12,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  cardHead:   {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,paddingBottom:10,borderBottom:"1px solid #f5f5f5"},
  cardTitle:  {fontSize:13,fontWeight:700},
  cardCount:  {fontSize:11,color:"#888",fontWeight:600,background:"#f5f5f5",padding:"2px 8px",borderRadius:10},
  cardEmpty:  {textAlign:"center",color:"#bbb",fontSize:12,padding:"16px 0"},
  cardList:   {display:"flex",flexDirection:"column",gap:9},
  cItem:      {padding:"8px 0",borderBottom:"1px solid #f8f8f8"},
  cItemHead:  {display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"},
  cFutDate:   {fontSize:10,fontWeight:600,color:"#d97706",background:"#fffbeb",padding:"1px 6px",borderRadius:5},
  cPastDate:  {fontSize:10,fontWeight:600,color:"#888",background:"#f5f5f5",padding:"1px 6px",borderRadius:5},
  cPrj:       {fontSize:10,fontWeight:600,color:"#2563eb",fontFamily:"monospace"},
  cTag:       {fontSize:10,color:"#666",padding:"1px 6px",borderRadius:5,border:"1px solid #e5e5e5"},
  cText:      {fontSize:12,color:"#333",lineHeight:1.5,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"},

  prjItem:    {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f8f8f8"},
  prjLeft:    {flex:1,minWidth:0},
  prjCode:    {fontSize:10,fontFamily:"monospace",fontWeight:700,color:"#2563eb",marginBottom:2},
  prjName:    {fontSize:12,color:"#333",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  prjRight:   {fontSize:11,color:"#999",fontWeight:600,marginLeft:8},

  // 모바일 전용
  mRoot:      {padding:"12px 12px 24px",display:"flex",flexDirection:"column",gap:12},
  mActionRow: {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 4px"},
  mDateLabel: {fontSize:13,color:"#666",fontWeight:600},
  mQuickBtn:  {background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer"},

  mCalCard:   {background:"#fff",borderRadius:12,padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  mCalHeader: {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12},
  mCalTitle:  {fontSize:15,fontWeight:700},
  mGrid:      {display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3},
  mDay:       {aspectRatio:"1/1",borderRadius:6,padding:"3px 4px",background:"#fafafa",position:"relative",display:"flex",flexDirection:"column",justifyContent:"space-between",cursor:"pointer"},
  mDayEmpty:  {aspectRatio:"1/1"},
  mDayToday:  {background:"#2563eb"},
  mDaySel:    {boxShadow:"0 0 0 2px #2563eb",background:"#fff"},
  mDayNum:    {fontSize:12,fontWeight:500,lineHeight:1},
  mDots:      {display:"flex",gap:2,justifyContent:"center"},
  mDot:       {width:4,height:4,borderRadius:"50%"},

  mCard:      {background:"#fff",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  mCardHead:  {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingBottom:10,borderBottom:"1px solid #f5f5f5"},
  mCardTitle: {fontSize:14,fontWeight:700},
  mCount:     {fontSize:11,color:"#888",fontWeight:600,background:"#f5f5f5",padding:"2px 8px",borderRadius:10},
  mBadge:     {fontSize:11,fontWeight:600,background:"#eff6ff",color:"#2563eb",padding:"2px 10px",borderRadius:20},
  mEmpty:     {textAlign:"center",color:"#bbb",fontSize:12,padding:"18px 0"},
  mList:      {display:"flex",flexDirection:"column",gap:8},
  mItem:      {padding:"10px 12px",background:"#fafafa",borderRadius:8,borderLeft:"3px solid #2563eb"},
  mItemHead:  {display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"},
  mPrj:       {fontSize:11,fontWeight:700,color:"#2563eb",fontFamily:"monospace"},
  mTag:       {fontSize:10,color:"#666",padding:"1px 7px",borderRadius:5,border:"1px solid #e5e5e5",background:"#fff"},
  mFutDate:   {fontSize:10,fontWeight:600,color:"#d97706",background:"#fffbeb",padding:"1px 6px",borderRadius:5},
  mText:      {fontSize:13,color:"#222",lineHeight:1.5,whiteSpace:"pre-wrap"},
  mPrjItem:   {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f8f8f8",gap:8},
  mPrjCode:   {fontSize:11,fontFamily:"monospace",fontWeight:700,color:"#2563eb",marginBottom:2},
  mPrjName:   {fontSize:13,color:"#333",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  mPrjCount:  {fontSize:11,color:"#999",fontWeight:600,flexShrink:0},

  mModal:     {background:"#fff",borderTopLeftRadius:16,borderTopRightRadius:16,padding:"20px 18px 24px",width:"100%",maxHeight:"85vh",overflowY:"auto",position:"fixed",bottom:0,left:0,right:0,boxShadow:"0 -8px 32px rgba(0,0,0,0.15)"},
  mModalHead: {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  mModalTitle:{fontSize:17,fontWeight:700},
  mModalClose:{background:"none",border:"none",fontSize:26,color:"#888",cursor:"pointer",lineHeight:1,padding:"0 4px"},
  mSaveBtn:   {width:"100%",background:"#2563eb",color:"#fff",border:"none",borderRadius:10,padding:"14px",fontSize:15,fontWeight:700,cursor:"pointer",marginTop:8},

  // 모달 (데스크톱)
  overlay:    {position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:1000},
  modal:      {background:"#fff",borderRadius:14,padding:"24px",width:480,maxWidth:"94vw",boxShadow:"0 24px 64px rgba(0,0,0,0.18)",alignSelf:"center",marginBottom:0},
  mTitleD:    {fontSize:17,fontWeight:700,marginBottom:18},
  formGrid:   {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px 16px"},
  inp:        {border:"1px solid #ddd",borderRadius:7,padding:"10px 12px",fontSize:14,fontFamily:"inherit",width:"100%",boxSizing:"border-box"},
  mFoot:      {display:"flex",justifyContent:"flex-end",gap:8,marginTop:18,paddingTop:16,borderTop:"1px solid #f0f0f0"},
  cancelBtn:  {background:"#f5f5f5",color:"#555",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:"pointer"},
  saveBtn:    {background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"9px 22px",fontSize:13,fontWeight:600,cursor:"pointer"},

  toast:      {position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:"#1a1a1a",color:"#fff",padding:"10px 20px",borderRadius:8,fontSize:13,fontWeight:500,zIndex:2000,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"},
};
