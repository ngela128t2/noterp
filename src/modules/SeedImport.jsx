import { useState, useEffect } from "react";

// ─── 어제·오늘 실제 업무 데이터 ─────────────────────────────────
const SEED = {
  clients: [
    // 세무대리 - 기장 (장기 거래처)
    { key:"도예공방", name:"도예공방 아트앤", corp_type:"법인", client_type:"매출처",
      manager:"노재영 대표", reg_date:"2026-05-07",
      service:"세무대리", service_detail:"기장" },
    { key:"하남필라", name:"하남필라테스린", corp_type:"법인", client_type:"매출처",
      manager:"박지영 대표", reg_date:"2026-05-08",
      service:"세무대리", service_detail:"기장" },
    { key:"레이백",   name:"레이백 바버샵",  corp_type:"법인", client_type:"매출처",
      manager:"변광섭 대표", reg_date:"2026-05-08",
      service:"세무대리", service_detail:"기장" },

    // 세무대리 - 청산신고
    { key:"상상인스팩", name:"상상인제4호스팩", corp_type:"법인", client_type:"매출처",
      manager:"이채영 과장", reg_date:"2026-05-07",
      service:"세무대리", service_detail:"청산신고" },
    { key:"상상인증권", name:"상상인증권",     corp_type:"법인", client_type:"매출처",
      manager:"이채영 과장", reg_date:"2026-05-08",
      service:"세무대리", service_detail:"청산신고" },

    // 외부감사
    { key:"데일리펀딩", name:"데일리펀딩",    corp_type:"법인", client_type:"매출처",
      manager:"이선희 팀장", reg_date:"2026-05-07",
      service:"외부감사" },
    { key:"월산신우",   name:"월산신우아파트", corp_type:"법인", client_type:"매출처",
      email:"ttangttang05@naver.com", reg_date:"2026-05-08",
      service:"외부감사" },

    // 중회협 협업
    { key:"CCK",  name:"CCK솔루션",      corp_type:"법인", client_type:"매출처",
      manager:"이용주 이사", reg_date:"2026-05-07",
      service:"중회협" },
    { key:"안진", name:"안진회계법인",    corp_type:"법인", client_type:"매출처",
      manager:"이승영 이사", reg_date:"2026-05-08",
      service:"중회협" },

    // 한공회 + 품질관리
    { key:"회계법인성지", name:"회계법인 성지", corp_type:"법인", client_type:"매출처",
      manager:"마혜원", reg_date:"2026-05-07",
      service:"한공회" },

    // 강의
    { key:"가톨릭대", name:"가톨릭대학교", corp_type:"법인", client_type:"매출처",
      reg_date:"2026-03-01",
      service:"강의" },

    // 매입처 - 인건비
    { key:"유세영", name:"유세영", corp_type:"개인", client_type:"매입처",
      manager:"유세영", reg_date:"2026-05-07",
      bank_name:"카카오뱅크", account_no:"3333-06-4159767", account_holder:"유세영" },
    { key:"이경택", name:"이경택", corp_type:"개인", client_type:"매입처",
      manager:"이경택", reg_date:"2026-05-07" },
  ],

  projects: [
    // 세무대리 - 기장
    { client_key:"도예공방", name:"세무대리 (기장)",       service:"세무대리", start_date:"2026-05-07" },
    { client_key:"하남필라", name:"세무대리 신규 (기장)",  service:"세무대리", start_date:"2026-05-08" },
    { client_key:"레이백",   name:"세무대리 신규 (기장)",  service:"세무대리", start_date:"2026-05-08" },

    // 세무대리 - 청산신고
    { client_key:"상상인스팩", name:"청산신고",  service:"세무대리", start_date:"2026-05-07" },
    { client_key:"상상인증권", name:"청산신고",  service:"세무대리", start_date:"2026-05-08" },

    // 외부감사
    { client_key:"데일리펀딩", name:"외부감사 검토보고서", service:"외부감사", start_date:"2026-05-07" },
    { client_key:"월산신우",   name:"아파트 외부감사",     service:"외부감사", start_date:"2026-05-08" },

    // 중회협
    { client_key:"CCK",  name:"중회협 협업포인트 개발", service:"중회협", start_date:"2026-05-07" },
    { client_key:"안진", name:"중회협 협업포인트 개발", service:"중회협", start_date:"2026-05-08" },

    // 한공회 (감리 대응) + 품질관리(사전심리) — 회계법인 성지에 두 개 프로젝트
    { client_key:"회계법인성지", name:"한공회 감리 대응",   service:"한공회", start_date:"2026-05-07",
      detail:"감리" },
    { client_key:"회계법인성지", name:"품질관리 - 사전심리", service:"한공회", start_date:"2026-05-07",
      detail:"품질관리" },

    // 강의
    { client_key:"가톨릭대", name:"법인세법개론 강의", service:"강의", start_date:"2026-03-01" },
  ],

  timeline: [
    // 5/7
    { client_key:"상상인스팩",   project_name:"청산신고",
      date:"2026-05-07", time:"10:31", tag:"계약",
      content:"계약서 초안 수정 후 발송 (이채영 과장)" },

    { client_key:"도예공방",     project_name:"세무대리 (기장)",
      date:"2026-05-07", time:"10:31", tag:"미팅",
      content:"세무대리 진행 (노재영 대표)" },

    { client_key:"데일리펀딩",   project_name:"외부감사 검토보고서",
      date:"2026-05-07", time:"11:24", tag:"서류",
      content:"검토보고서 초안 검토 후 발송 (이선희 팀장) — 마감 5/8" },

    { client_key:"CCK",          project_name:"중회협 협업포인트 개발",
      date:"2026-05-07", time:"14:00", tag:"서류",
      content:"전산조서 — 협업포인트 개발요청 (231,000원, 이용주 이사)" },

    // HL부동산 → 회계법인 성지의 품질관리(사전심리) 타임라인으로
    { client_key:"회계법인성지", project_name:"품질관리 - 사전심리",
      date:"2026-05-07", time:"16:38", tag:"완료",
      content:"에이치엘제2호위탁관리부동산투자회사 사전심리 완료 (담당: 최상기 회계사)" },

    { client_key:"회계법인성지", project_name:"한공회 감리 대응",
      date:"2026-05-07", time:"17:58", tag:"서류",
      content:"위험 관련 조서 보완 요청 — 개별팀 보완 (담당: 마혜원, 마감 5/11)" },

    // 5/8
    { client_key:"월산신우",     project_name:"아파트 외부감사",
      date:"2026-05-08", time:"05:50", tag:"서류",
      content:"아파트감사 견적서 제출 (ttangttang05@naver.com)" },

    { client_key:"상상인증권",   project_name:"청산신고",
      date:"2026-05-08", time:"",      tag:"서류",
      content:"청산신고 — 이연법인세 등 최종 (이채영 과장, 마감 5/11)" },

    { client_key:"가톨릭대",     project_name:"법인세법개론 강의",
      date:"2026-05-08", time:"",      tag:"기타",
      content:"중간고사 채점" },

    { client_key:"안진",         project_name:"중회협 협업포인트 개발",
      date:"2026-05-08", time:"10:00", tag:"서류",
      content:"전산조서 — 협업포인트 개발요청 (이승영 이사)" },

    { client_key:"하남필라",     project_name:"세무대리 신규 (기장)",
      date:"2026-05-08", time:"12:30", tag:"미팅",
      content:"최초 상담 (박지영 대표)" },

    { client_key:"레이백",       project_name:"세무대리 신규 (기장)",
      date:"2026-05-08", time:"15:00", tag:"미팅",
      content:"최초 상담 (변광섭 대표)" },
  ],

  transactions: [
    { date:"2026-05-07", type:"매입", client_key:"유세영", amount:6769000, status:"입금완료",
      description:"용역대금 (원천 3.3% 차감, 총 7,000,000원)" },
    { date:"2026-05-07", type:"매입", client_key:"이경택", amount:450000,  status:"입금완료",
      description:"용역대금 오송금액 재송금" },
    { date:"2026-05-07", type:"매출", client_key:"CCK",     amount:231000,  status:"청구완료",
      description:"전산조서 협업포인트 개발" },
  ],
};

// ─── 코드 생성 헬퍼 ──────────────────────────────────────────
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

function genClientCode(existing, corpType) {
  const prefix = corpType==="개인" ? "IN" : "CL";
  const nums = existing.filter(c=>c.code?.startsWith(prefix+"-"))
    .map(c=>parseInt(c.code.split("-")[1])||0);
  return prefix+"-"+String((nums.length?Math.max(...nums):0)+1).padStart(3,"0");
}
function genProjectCode(existing, service) {
  const prefix = SERVICE_PREFIX[service]||"PRJ";
  const nums = existing.filter(p=>p.code?.startsWith(prefix+"-"))
    .map(p=>parseInt(p.code.split("-")[1])||0);
  return prefix+"-"+String((nums.length?Math.max(...nums):0)+1).padStart(3,"0");
}
function genTrCode(existing) {
  const nums = existing.map(t=>parseInt(t.code?.replace("TR-",""))||0);
  return "TR-"+String((nums.length?Math.max(...nums):0)+1).padStart(4,"0");
}

function won(n){ return Number(n||0).toLocaleString("ko-KR")+"원"; }

// ─── 메인 ─────────────────────────────────────────────────────
export default function NoterpSeedImport() {
  const [existing, setExisting] = useState({clients:[],projects:[],timeline:{},txs:[]});
  const [loading,  setLoading]  = useState(true);
  const [importing,setImporting]= useState(false);
  const [done,     setDone]     = useState(null);

  useEffect(()=>{
    (async()=>{
      try {
        const [pc,pp,pt,px] = await Promise.allSettled([
          window.storage.get("noterp_cl"),
          window.storage.get("noterp_prj"),
          window.storage.get("noterp_tl"),
          window.storage.get("noterp_tx"),
        ]);
        setExisting({
          clients: pc.status==="fulfilled"&&pc.value ? JSON.parse(pc.value.value) : [],
          projects:pp.status==="fulfilled"&&pp.value ? JSON.parse(pp.value.value) : [],
          timeline:pt.status==="fulfilled"&&pt.value ? JSON.parse(pt.value.value) : {},
          txs:     px.status==="fulfilled"&&px.value ? JSON.parse(px.value.value) : [],
        });
      } catch{}
      setLoading(false);
    })();
  },[]);

  const newClientCount = SEED.clients.filter(s=>!existing.clients.find(c=>c.name===s.name)).length;
  const newProjectCount = SEED.projects.length;
  const newTlCount = SEED.timeline.length;
  const newTxCount = SEED.transactions.length;

  // 기장 거래처 미리 카운트
  const bookkeepingCount = SEED.clients.filter(c =>
    c.service==="세무대리" && c.service_detail==="기장"
  ).length;

  const handleImport = async () => {
    setImporting(true);

    const newClients  = [...existing.clients];
    const newProjects = [...existing.projects];
    const newTimeline = {...existing.timeline};
    const newTxs      = [...existing.txs];
    const keyToClientId  = {};
    const projectKeyToId = {}; // "client_key|project_name" -> id
    const stats = { clients:0, projects:0, timeline:0, txs:0 };

    // 1. 거래처
    for(const s of SEED.clients) {
      const exists = newClients.find(c=>c.name===s.name);
      if(exists) { keyToClientId[s.key] = exists.id; continue; }
      const code = genClientCode(newClients, s.corp_type);
      const id = `seed-cl-${Date.now()}-${stats.clients}`;
      newClients.unshift({
        id, code,
        name:s.name, corp_type:s.corp_type, client_type:s.client_type,
        biz_no:"", id_no:"", fss_no:"", rep:"",
        address:"", contact:"", email:s.email||"", industry:"",
        reg_date:s.reg_date,
        service:s.service||"", service_detail:s.service_detail||"", service_desc:"",
        bank_name:s.bank_name||"", account_no:s.account_no||"", account_holder:s.account_holder||"",
        manager:s.manager||"", memo:"",
        created_at: new Date().toISOString(),
      });
      keyToClientId[s.key] = id;
      stats.clients++;
    }

    // 2. 프로젝트
    for(const s of SEED.projects) {
      const clientId = keyToClientId[s.client_key];
      const client = newClients.find(c=>c.id===clientId);
      if(!client) continue;

      const exists = newProjects.find(p=>p.client_id===clientId&&p.name===s.name);
      if(exists) {
        projectKeyToId[s.client_key+"|"+s.name] = exists.id;
        continue;
      }
      const code = genProjectCode(newProjects, s.service);
      const id = `seed-pr-${Date.now()}-${stats.projects}`;
      newProjects.unshift({
        id, code,
        name:s.name, client_id:clientId, client_name:client.name,
        service:s.service, status:s.status||"진행중",
        start_date:s.start_date, end_date:"", memo:"",
        created_at:new Date().toISOString(),
      });
      projectKeyToId[s.client_key+"|"+s.name] = id;
      stats.projects++;
    }

    // 3. 타임라인 — 정확한 프로젝트에 매칭
    for(const s of SEED.timeline) {
      const pid = projectKeyToId[s.client_key+"|"+s.project_name];
      if(!pid) continue;

      const cur = newTimeline[pid]||[];
      const content = s.time ? `[${s.time}] ${s.content}` : s.content;
      const entry = {
        id:`seed-tl-${Date.now()}-${stats.timeline}`,
        date:s.date, content, tag:s.tag||"",
        type:"direct", created_at:new Date().toISOString(),
      };
      newTimeline[pid] = [entry,...cur].sort((a,b)=>b.date.localeCompare(a.date));
      stats.timeline++;
    }

    // 4. 거래내역
    for(const s of SEED.transactions) {
      const clientId = keyToClientId[s.client_key];
      const client = newClients.find(c=>c.id===clientId);
      if(!client) continue;
      const project = newProjects.find(p=>p.client_id===clientId);

      const code = genTrCode(newTxs);
      newTxs.unshift({
        id:`seed-tx-${Date.now()}-${stats.txs}`, code,
        date:s.date, type:s.type,
        client_id:clientId, client_name:client.name,
        project_id:project?.id||"", project_code:project?.code||"",
        amount:s.amount, status:s.status, description:s.description,
        created_at:new Date().toISOString(),
      });
      stats.txs++;
    }

    await window.storage.set("noterp_cl",  JSON.stringify(newClients));
    await window.storage.set("noterp_prj", JSON.stringify(newProjects));
    await window.storage.set("noterp_tl",  JSON.stringify(newTimeline));
    await window.storage.set("noterp_tx",  JSON.stringify(newTxs));

    setImporting(false);
    setDone(stats);
  };

  if(loading) return <div style={s.center}><Spin/></div>;

  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        body{margin:0}
      `}</style>

      <div style={s.container}>
        <div style={s.brand}>NOTERP</div>
        <h1 style={s.title}>실제 업무 데이터 자동 등록</h1>
        <p style={s.subtitle}>어제(5/7)·오늘(5/8) 곽송님 업무를 Noterp에 자동으로 넣을게요</p>

        {!done ? (
          <>
            <div style={s.cards}>
              <div style={s.card}>
                <div style={s.cardIcon}>🏢</div>
                <div style={s.cardNum}>{newClientCount}<span style={s.cardUnit}>개</span></div>
                <div style={s.cardLabel}>거래처</div>
                <div style={s.cardSub}>법인 11 · 개인 2 · 기장 {bookkeepingCount}</div>
              </div>
              <div style={s.card}>
                <div style={s.cardIcon}>📁</div>
                <div style={s.cardNum}>{newProjectCount}<span style={s.cardUnit}>개</span></div>
                <div style={s.cardLabel}>프로젝트</div>
                <div style={s.cardSub}>세무대리 5 · 외부감사 2 · 외</div>
              </div>
              <div style={s.card}>
                <div style={s.cardIcon}>📝</div>
                <div style={s.cardNum}>{newTlCount}<span style={s.cardUnit}>건</span></div>
                <div style={s.cardLabel}>타임라인</div>
                <div style={s.cardSub}>5/7 · 5/8 업무</div>
              </div>
              <div style={s.card}>
                <div style={s.cardIcon}>💰</div>
                <div style={s.cardNum}>{newTxCount}<span style={s.cardUnit}>건</span></div>
                <div style={s.cardLabel}>거래내역</div>
                <div style={s.cardSub}>매출 1 · 매입 2</div>
              </div>
            </div>

            <div style={s.section}>
              <h3 style={s.sectionTitle}>거래처 ({SEED.clients.length}개)</h3>
              <div style={s.list}>
                {SEED.clients.map((c,i)=>(
                  <div key={i} style={s.item}>
                    <span style={{...s.tag, ...(c.corp_type==="개인"?{background:"#f3f4f6",color:"#666"}:{background:"#eff6ff",color:"#2563eb"})}}>
                      {c.corp_type}
                    </span>
                    <span style={s.itemName}>{c.name}</span>
                    {c.manager&&<span style={s.itemMeta}>· {c.manager}</span>}
                    {c.service&&(
                      <span style={s.svcTag}>
                        {c.service}{c.service_detail?` · ${c.service_detail}`:""}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={s.section}>
              <h3 style={s.sectionTitle}>프로젝트 ({SEED.projects.length}개)</h3>
              <div style={s.list}>
                {SEED.projects.map((p,i)=>{
                  const cl = SEED.clients.find(x=>x.key===p.client_key);
                  return (
                    <div key={i} style={s.item}>
                      <span style={{...s.svcTag, fontWeight:700}}>{SERVICE_PREFIX[p.service]||"PRJ"}</span>
                      <span style={s.itemName}>{cl?.name}</span>
                      <span style={s.itemMeta}>· {p.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={s.section}>
              <h3 style={s.sectionTitle}>거래내역 ({SEED.transactions.length}건)</h3>
              <div style={s.list}>
                {SEED.transactions.map((t,i)=>{
                  const cl = SEED.clients.find(x=>x.key===t.client_key);
                  return (
                    <div key={i} style={s.item}>
                      <span style={{...s.tag, ...(t.type==="매출"?{background:"#eff6ff",color:"#2563eb"}:{background:"#fef2f2",color:"#dc2626"})}}>
                        {t.type}
                      </span>
                      <span style={s.itemName}>{cl?.name}</span>
                      <span style={{...s.itemMeta, fontFamily:"monospace", fontWeight:700, color:t.type==="매출"?"#2563eb":"#dc2626"}}>
                        {won(t.amount)}
                      </span>
                      <span style={s.itemMeta}>· {t.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={s.actionBox}>
              <button style={s.importBtn} onClick={handleImport} disabled={importing}>
                {importing ? <><Spin size={14}/> 등록 중...</> : "🚀 한 번에 등록하기"}
              </button>
              <div style={s.notice}>
                * HL부동산은 회계법인 성지의 사전심리 업무로 기록됩니다<br/>
                * 사이드바 '거래처' 카운트는 세무대리(기장)만 집계됩니다
              </div>
            </div>
          </>
        ) : (
          <div style={s.doneBox}>
            <div style={s.doneIcon}>🎉</div>
            <h2 style={s.doneTitle}>등록 완료!</h2>
            <div style={s.doneStats}>
              <div style={s.doneStat}><b>{done.clients}</b><span>거래처</span></div>
              <div style={s.doneStat}><b>{done.projects}</b><span>프로젝트</span></div>
              <div style={s.doneStat}><b>{done.timeline}</b><span>타임라인</span></div>
              <div style={s.doneStat}><b>{done.txs}</b><span>거래내역</span></div>
            </div>
            <p style={s.doneText}>
              이제 Noterp 대시보드·거래처·프로젝트·매출매입장에서<br/>
              어제·오늘 업무가 모두 보일 거예요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Spin({size=22}){
  return <span style={{display:"inline-block", width:size, height:size, borderRadius:"50%",
    border:"3px solid #e5e5e5", borderTopColor:"#2563eb",
    animation:"spin 0.8s linear infinite", verticalAlign:"middle"}}/>;
}

const s = {
  root:        {fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif", background:"#f5f5f3", minHeight:"100vh", color:"#1a1a1a", padding:"40px 20px"},
  center:      {display:"flex", alignItems:"center", justifyContent:"center", height:"100vh"},
  container:   {maxWidth:880, margin:"0 auto"},
  brand:       {fontSize:11, fontWeight:800, letterSpacing:4, color:"#2563eb", marginBottom:8},
  title:       {fontSize:26, fontWeight:800, margin:"0 0 6px"},
  subtitle:    {fontSize:14, color:"#666", marginBottom:32},
  cards:       {display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:14, marginBottom:36},
  card:        {background:"#fff", borderRadius:14, padding:"22px 18px", textAlign:"center", boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  cardIcon:    {fontSize:24, marginBottom:8},
  cardNum:     {fontSize:30, fontWeight:800, color:"#2563eb", lineHeight:1},
  cardUnit:    {fontSize:14, color:"#888", marginLeft:3, fontWeight:500},
  cardLabel:   {fontSize:13, fontWeight:600, marginTop:4, color:"#444"},
  cardSub:     {fontSize:11, color:"#aaa", marginTop:3},
  section:     {background:"#fff", borderRadius:14, padding:"20px 22px", marginBottom:14, boxShadow:"0 1px 4px rgba(0,0,0,0.05)"},
  sectionTitle:{fontSize:14, fontWeight:700, marginBottom:14, paddingBottom:10, borderBottom:"1px solid #f0f0f0"},
  list:        {display:"flex", flexDirection:"column", gap:7},
  item:        {display:"flex", alignItems:"center", gap:8, fontSize:13, padding:"4px 0", flexWrap:"wrap"},
  tag:         {fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:20, whiteSpace:"nowrap"},
  itemName:    {fontWeight:600, color:"#222"},
  itemMeta:    {color:"#777", fontSize:12},
  svcTag:      {fontSize:11, background:"#f0f4ff", color:"#2563eb", padding:"2px 8px", borderRadius:5, fontFamily:"monospace"},
  actionBox:   {textAlign:"center", marginTop:32, padding:"32px", background:"#fff", borderRadius:14, boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  importBtn:   {background:"linear-gradient(135deg,#2563eb,#7c3aed)", color:"#fff", border:"none", borderRadius:10, padding:"14px 36px", fontSize:15, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:10},
  notice:      {fontSize:12, color:"#999", marginTop:14, lineHeight:1.7},
  doneBox:     {textAlign:"center", padding:"60px 40px", background:"#fff", borderRadius:14, boxShadow:"0 1px 4px rgba(0,0,0,0.06)", animation:"fadeIn 0.4s ease"},
  doneIcon:    {fontSize:48, marginBottom:14},
  doneTitle:   {fontSize:24, fontWeight:800, margin:"0 0 24px", color:"#2563eb"},
  doneStats:   {display:"flex", justifyContent:"center", gap:32, marginBottom:24, flexWrap:"wrap"},
  doneStat:    {display:"flex", flexDirection:"column", alignItems:"center", gap:4},
  doneText:    {fontSize:14, color:"#666", lineHeight:1.7},
};
