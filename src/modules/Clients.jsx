import { useState, useEffect, useRef } from "react";

// ─── 상수 ─────────────────────────────────────────────────────
const SERVICE_TYPES = ["세무대리","외부감사","컨설팅","자문","한공회","강의","중회협","기타"];

const SERVICE_DETAIL = {
  "세무대리":["기장","청산신고","법인세 신고","종합소득세 신고","부가가치세 신고","원천세","기타"],
  "외부감사":["상장법인","코스닥법인","비상장법인","학교법인","공공기관","사회복지법인","기타"],
  "컨설팅":  ["세무컨설팅","회계컨설팅","M&A","기타"],
  "자문":    ["세무자문","회계자문","법률자문","기타"],
  "한공회":  ["감리","윤리","품질관리","기타"],
  "기타":    [],
};

const CLIENT_TYPES = [
  { value:"매출처", color:"#2563eb", bg:"#eff6ff" },
  { value:"매입처", color:"#059669", bg:"#ecfdf5" },
  { value:"공통",   color:"#7c3aed", bg:"#f5f3ff" },
];

const BANKS = ["국민","신한","하나","우리","농협","기업","SC제일","씨티","카카오뱅크",
  "토스뱅크","새마을금고","수협","부산","경남","대구","광주","전북","제주","산업","수출입","기타"];

const EMPTY = {
  name:"", corp_type:"법인", biz_no:"", id_no:"", fss_no:"",
  rep:"", address:"", contact:"", email:"", industry:"",
  reg_date: today(),
  client_type:"매출처", service:"", service_detail:"", service_desc:"",
  bank_name:"", account_no:"", account_holder:"",
  manager:"", memo:"",
};

function today() {
  return new Date().toISOString().slice(0,10);
}

// ─── 포맷 유틸 ────────────────────────────────────────────────
const fmt = {
  bizNo: v => {
    const n = v.replace(/\D/g,"").slice(0,10);
    if (n.length<=3) return n;
    if (n.length<=5) return n.slice(0,3)+"-"+n.slice(3);
    return n.slice(0,3)+"-"+n.slice(3,5)+"-"+n.slice(5);
  },
  idNo: v => {
    // 법인번호: 000000-0000000  /  주민번호: 000000-0000000
    const n = v.replace(/\D/g,"").slice(0,13);
    if (n.length<=6) return n;
    return n.slice(0,6)+"-"+n.slice(6);
  },
};

function genCode(clients, corpType) {
  const prefix = corpType==="개인" ? "IN" : "CL";
  const nums = clients
    .filter(c => c.code?.startsWith(prefix+"-"))
    .map(c => parseInt(c.code.split("-")[1])||0);
  const next = nums.length ? Math.max(...nums)+1 : 1;
  return prefix+"-"+String(next).padStart(3,"0");
}

function ctStyle(type) {
  const t = CLIENT_TYPES.find(x=>x.value===type)||CLIENT_TYPES[0];
  return { color:t.color, background:t.bg };
}

// ─── AI 추출 ──────────────────────────────────────────────────
async function extractFromFile(file) {
  const base64 = await new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const isPdf = file.type==="application/pdf";
  const resp = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514", max_tokens:1000,
      messages:[{role:"user", content:[
        { type: isPdf?"document":"image", source:{type:"base64",media_type:file.type,data:base64} },
        { type:"text", text:`사업자등록증에서 정보 추출 후 JSON만 반환. 없으면 빈 문자열.
{
  "name":"상호 또는 법인명",
  "corp_type":"법인 또는 개인",
  "biz_no":"사업자등록번호(000-00-00000)",
  "id_no":"법인등록번호(있으면 000000-0000000, 없으면 빈 문자열)",
  "rep":"대표자 성명",
  "address":"사업장 소재지",
  "industry":"업태/종목"
}
JSON 외 텍스트 없이.` }
      ]}]
    })
  });
  const data = await resp.json();
  return JSON.parse(data.content?.[0]?.text?.replace(/```json|```/g,"").trim());
}

// ─── 메인 ─────────────────────────────────────────────────────
export default function NoterpClients() {
  const [clients,  setClients]  = useState([]);
  const [search,   setSearch]   = useState("");
  const [ftType,   setFtType]   = useState("");
  const [ftCorp,   setFtCorp]   = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [extract,  setExtract]  = useState(false);
  const [toast,    setToast]    = useState(null);
  const [tab,      setTab]      = useState("기본");
  const fileRef = useRef();

  useEffect(()=>{
    (async()=>{
      try { const r=await window.storage.get("noterp_cl"); if(r) setClients(JSON.parse(r.value)); } catch{}
      setLoading(false);
    })();
  },[]);

  const persist = async d => { try{ await window.storage.set("noterp_cl",JSON.stringify(d)); }catch{} };
  const notify  = msg => { setToast(msg); setTimeout(()=>setToast(null),2500); };
  const setF    = (k,v) => setForm(f=>({...f,[k]:v}));

  const openAdd  = () => { setEditId(null); setForm({...EMPTY,reg_date:today()}); setTab("기본"); setShowForm(true); };
  const openEdit = c  => { setEditId(c.id); setForm({...c}); setTab("기본"); setShowForm(true); setSelected(null); };

  const handleFile = async e => {
    const file = e.target.files?.[0]; if(!file) return; e.target.value="";
    setExtract(true); setEditId(null); setForm({...EMPTY,reg_date:today()}); setTab("기본"); setShowForm(true);
    try {
      const ex = await extractFromFile(file);
      setForm(f=>({...f,
        name:        ex.name||"",
        corp_type:   ex.corp_type==="개인"?"개인":"법인",
        biz_no:      fmt.bizNo(ex.biz_no||""),
        id_no:       fmt.idNo(ex.id_no||""),
        rep:         ex.rep||"",
        address:     ex.address||"",
        industry:    ex.industry||"",
      }));
      notify("✓ 사업자등록증 인식 완료");
    } catch { notify("인식 실패 — 직접 입력해주세요"); }
    finally { setExtract(false); }
  };

  const handleSubmit = async () => {
    if(!form.name.trim()) return;
    let updated;
    if(editId){
      updated = clients.map(c=>c.id===editId?{...form,id:editId,code:c.code}:c);
      notify("수정 완료");
    } else {
      const code = genCode(clients, form.corp_type);
      updated = [{...form, id:Date.now().toString(), code, created_at:new Date().toISOString()}, ...clients];
      notify(`거래처 추가 완료 (${code})`);
    }
    setClients(updated); await persist(updated); setShowForm(false);
  };

  const handleDelete = async id => {
    if(!confirm("삭제하시겠습니까?")) return;
    const updated = clients.filter(c=>c.id!==id);
    setClients(updated); await persist(updated); setSelected(null); notify("삭제 완료");
  };

  const filtered = clients.filter(c=>{
    const q=search.toLowerCase();
    return (!q||[c.name,c.biz_no,c.code,c.rep,c.manager,c.id_no].some(v=>(v||"").toLowerCase().includes(q)))
      && (!ftType||c.client_type===ftType)
      && (!ftCorp||c.corp_type===ftCorp);
  });

  const idLabel = form.corp_type==="개인" ? "주민등록번호" : "법인번호";
  const selIdLabel = selected?.corp_type==="개인" ? "주민등록번호" : "법인번호";

  if(loading) return <div style={s.center}><Spin/></div>;

  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .row:hover{background:#f8faff!important}
        input:focus,select:focus,textarea:focus{border-color:#2563eb!important;outline:none}
        .tab-btn:hover{color:#2563eb}
      `}</style>

      {/* 헤더 */}
      <div style={s.header}>
        <div>
          <div style={s.brand}>NOTERP</div>
          <div style={s.pageTitle}>거래처 관리</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={s.uploadBtn} onClick={()=>fileRef.current?.click()}>📄 사업자등록증</button>
          <button style={s.addBtn} onClick={openAdd}>+ 직접 추가</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={handleFile}/>
      </div>

      {/* 툴바 */}
      <div style={s.toolbar}>
        <input style={s.search} placeholder="거래처명 / 코드 / 사업자번호 / 대표자 검색"
          value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={s.filters}>
          {["",..."매출처,매입처,공통".split(",")].map(v=>(
            <button key={v||"전체"} style={{...s.fBtn,...(ftType===v?{...s.fBtnOn,...(v?ctStyle(v):{color:"#1a1a1a",background:"#f0f0f0"})}:{})}}
              onClick={()=>setFtType(v)}>{v||"전체"}</button>
          ))}
          <div style={{width:1,background:"#e5e5e5",height:20}}/>
          {["","법인","개인"].map(v=>(
            <button key={v||"전체법인구분"} style={{...s.fBtn,...(ftCorp===v?s.fBtnOn:{})}}
              onClick={()=>setFtCorp(v)}>{v||"전체"}</button>
          ))}
        </div>
        <span style={s.count}>{filtered.length}개</span>
      </div>

      {/* 바디 */}
      <div style={s.body}>
        {/* 테이블 */}
        <div style={s.tableWrap}>
          {filtered.length===0 ? (
            <div style={s.empty}>
              {clients.length===0?"사업자등록증을 업로드하거나 직접 추가해주세요":"검색 결과가 없습니다"}
            </div>
          ):(
            <table style={s.table}>
              <thead><tr style={s.thead}>
                {["코드","거래처명","구분","사업자번호","대표자","서비스","등록일","담당자"].map(h=>(
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(c=>(
                  <tr key={c.id} className="row"
                    style={{...s.tr,...(selected?.id===c.id?s.trOn:{})}}
                    onClick={()=>setSelected(selected?.id===c.id?null:c)}>
                    <td style={{...s.td,...s.codeCell}}>
                      <span style={s.codeTag}>{c.code}</span>
                    </td>
                    <td style={{...s.td,fontWeight:600}}>{c.name}</td>
                    <td style={s.td}>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        <span style={{...s.badge,...ctStyle(c.client_type)}}>{c.client_type}</span>
                        <span style={{...s.badge,background:"#f5f5f5",color:"#666"}}>{c.corp_type}</span>
                      </div>
                    </td>
                    <td style={{...s.td,...s.mono}}>{c.biz_no}</td>
                    <td style={s.td}>{c.rep}</td>
                    <td style={s.td}>
                      {c.service&&<span style={s.svcTag}>{c.service}</span>}
                      {c.service_detail&&<span style={{...s.svcTag,background:"#f0fdf4",color:"#059669",marginLeft:3}}>{c.service_detail}</span>}
                    </td>
                    <td style={{...s.td,color:"#888",fontSize:12}}>{c.reg_date}</td>
                    <td style={{...s.td,color:"#666"}}>{c.manager}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 상세 패널 */}
        {selected&&(
          <div style={s.detail}>
            <div style={s.dTop}>
              <div>
                <div style={{display:"flex",gap:4,marginBottom:6}}>
                  <span style={{...s.badge,...ctStyle(selected.client_type)}}>{selected.client_type}</span>
                  <span style={{...s.badge,background:"#f5f5f5",color:"#555"}}>{selected.corp_type}</span>
                </div>
                <div style={s.dName}>{selected.name}</div>
                <div style={s.dCode}>{selected.code}</div>
              </div>
              <div style={{display:"flex",gap:4}}>
                <button style={s.editBtn} onClick={()=>openEdit(selected)}>수정</button>
                <button style={s.delBtn}  onClick={()=>handleDelete(selected.id)}>삭제</button>
              </div>
            </div>

            <Sec title="기본정보"/>
            {[
              ["사업자번호",  selected.biz_no,  true],
              [selIdLabel,    selected.id_no,   true],
              ["금감원번호",  selected.fss_no,  false],
              ["대표자",      selected.rep,     false],
              ["주소",        selected.address, false],
              ["연락처",      selected.contact, false],
              ["이메일",      selected.email,   false],
              ["업종",        selected.industry,false],
              ["등록일",      selected.reg_date,false],
            ].filter(([,v])=>v).map(([k,v,m])=>(
              <Row key={k} label={k} val={v} mono={m}/>
            ))}

            {(selected.service||selected.service_detail||selected.service_desc)&&<>
              <Sec title="용역구분"/>
              {[
                ["서비스",    selected.service],
                ["상세분류",  selected.service_detail],
                ["용역내용",  selected.service_desc],
              ].filter(([,v])=>v).map(([k,v])=><Row key={k} label={k} val={v}/>)}
            </>}

            {(selected.bank_name||selected.account_no)&&<>
              <Sec title="계좌정보"/>
              {[
                ["은행",      selected.bank_name],
                ["계좌번호",  selected.account_no],
                ["예금주",    selected.account_holder],
              ].filter(([,v])=>v).map(([k,v])=><Row key={k} label={k} val={v} mono={k==="계좌번호"}/>)}
            </>}

            {(selected.manager||selected.memo)&&<>
              <Sec title="기타"/>
              {[["담당자",selected.manager],["메모",selected.memo]].filter(([,v])=>v).map(([k,v])=>(
                <Row key={k} label={k} val={v}/>
              ))}
            </>}
          </div>
        )}
      </div>

      {/* 폼 모달 */}
      {showForm&&(
        <div style={s.overlay} onClick={()=>!extract&&setShowForm(false)}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            <div style={s.mHead}>
              <div style={s.mTitle}>{editId?"거래처 수정":"거래처 추가"}</div>
              {extract&&<div style={s.extracting}><Spin size={13}/> 읽는 중...</div>}
            </div>

            {!extract&&(
              <div style={s.tabs}>
                {["기본","용역","계좌","기타"].map(t=>(
                  <button key={t} className="tab-btn"
                    style={{...s.tabBtn,...(tab===t?s.tabOn:{})}}
                    onClick={()=>setTab(t)}>{t}</button>
                ))}
              </div>
            )}

            {extract?(
              <div style={s.extBody}>AI가 사업자등록증 정보를 자동 추출하고 있어요 ✨</div>
            ):tab==="기본"?(
              <div style={s.grid}>
                <FL label="거래처명 *" full>
                  <In value={form.name} onChange={v=>setF("name",v)} ph="주식회사 성문화학"/>
                </FL>

                <FL label="법인구분">
                  <Radio options={["법인","개인"]} value={form.corp_type}
                    onChange={v=>setF("corp_type",v)}/>
                </FL>

                <FL label="거래처 유형">
                  <Radio options={["매출처","매입처","공통"]} value={form.client_type}
                    onChange={v=>setF("client_type",v)}
                    colors={CLIENT_TYPES.reduce((a,t)=>({...a,[t.value]:t.color}),{})}/>
                </FL>

                <FL label="사업자번호">
                  <In value={form.biz_no} onChange={v=>setF("biz_no",fmt.bizNo(v))} ph="000-00-00000"/>
                </FL>

                <FL label={idLabel}>
                  <In value={form.id_no} onChange={v=>setF("id_no",fmt.idNo(v))} ph="000000-0000000"/>
                </FL>

                <FL label="금감원 고유번호">
                  <In value={form.fss_no} onChange={v=>setF("fss_no",v)} ph="00000000"/>
                </FL>

                <FL label="대표자">
                  <In value={form.rep} onChange={v=>setF("rep",v)}/>
                </FL>

                <FL label="거래처 등록일">
                  <input type="date" style={s.inp} value={form.reg_date}
                    onChange={e=>setF("reg_date",e.target.value)}/>
                </FL>

                <FL label="연락처">
                  <In value={form.contact} onChange={v=>setF("contact",v)} ph="02-0000-0000"/>
                </FL>

                <FL label="이메일">
                  <In value={form.email} onChange={v=>setF("email",v)} ph="example@company.com"/>
                </FL>

                <FL label="업종">
                  <In value={form.industry} onChange={v=>setF("industry",v)} ph="제조업 / 플라스틱제품"/>
                </FL>

                <FL label="주소" full>
                  <In value={form.address} onChange={v=>setF("address",v)} ph="서울시 강남구..."/>
                </FL>
              </div>
            ):tab==="용역"?(
              <div style={s.grid}>
                <FL label="서비스 대분류">
                  <select style={s.inp} value={form.service}
                    onChange={e=>{setF("service",e.target.value); setF("service_detail","");}}>
                    <option value="">선택</option>
                    {SERVICE_TYPES.map(sv=><option key={sv}>{sv}</option>)}
                  </select>
                </FL>

                <FL label="상세분류">
                  <select style={s.inp} value={form.service_detail}
                    onChange={e=>setF("service_detail",e.target.value)}
                    disabled={!form.service||!SERVICE_DETAIL[form.service]?.length}>
                    <option value="">선택</option>
                    {(SERVICE_DETAIL[form.service]||[]).map(d=><option key={d}>{d}</option>)}
                  </select>
                </FL>

                <FL label="용역 내용" full>
                  <textarea style={{...s.inp,height:100,resize:"vertical"}}
                    placeholder="예: 2024사업연도 외부감사 및 검토"
                    value={form.service_desc} onChange={e=>setF("service_desc",e.target.value)}/>
                </FL>
              </div>
            ):tab==="계좌"?(
              <div style={s.grid}>
                <FL label="은행명">
                  <select style={s.inp} value={form.bank_name} onChange={e=>setF("bank_name",e.target.value)}>
                    <option value="">선택</option>
                    {BANKS.map(b=><option key={b}>{b}</option>)}
                  </select>
                </FL>
                <FL label="예금주">
                  <In value={form.account_holder} onChange={v=>setF("account_holder",v)}/>
                </FL>
                <FL label="계좌번호" full>
                  <In value={form.account_no} onChange={v=>setF("account_no",v)} ph="000-000000-00000"/>
                </FL>
              </div>
            ):(
              <div style={s.grid}>
                <FL label="담당자">
                  <In value={form.manager} onChange={v=>setF("manager",v)} ph="곽송"/>
                </FL>
                <FL label="" />
                <FL label="메모" full>
                  <textarea style={{...s.inp,height:100,resize:"vertical"}}
                    value={form.memo} onChange={e=>setF("memo",e.target.value)}/>
                </FL>
              </div>
            )}

            {!extract&&(
              <div style={s.mFoot}>
                <button style={s.cancelBtn} onClick={()=>setShowForm(false)}>취소</button>
                <button style={s.saveBtn} onClick={handleSubmit}>{editId?"수정 완료":"추가"}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast&&<div style={s.toast}>{toast}</div>}
    </div>
  );
}

// ─── 서브 컴포넌트 ─────────────────────────────────────────────
function Spin({size=22}){
  return <div style={{width:size,height:size,borderRadius:"50%",
    border:`${size>16?"3":"2"}px solid #e5e5e5`,borderTopColor:"#2563eb",
    animation:"spin 0.8s linear infinite",flexShrink:0}}/>;
}
function Sec({title}){
  return <div style={{fontSize:10,fontWeight:700,letterSpacing:1.2,color:"#aaa",
    margin:"14px 0 8px",textTransform:"uppercase"}}>{title}</div>;
}
function Row({label,val,mono}){
  return (
    <div style={{display:"flex",gap:8,marginBottom:8}}>
      <div style={{width:68,fontSize:11,color:"#999",flexShrink:0,paddingTop:1}}>{label}</div>
      <div style={{fontSize:12,color:"#222",lineHeight:1.5,wordBreak:"break-all",
        ...(mono?{fontFamily:"monospace",letterSpacing:0.5}:{})}}>{val}</div>
    </div>
  );
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
  return <input style={s.inp} placeholder={ph} value={value}
    onChange={e=>onChange(e.target.value)}/>;
}
function Radio({options,value,onChange,colors={}}){
  return (
    <div style={{display:"flex",gap:14,paddingTop:6,flexWrap:"wrap"}}>
      {options.map(o=>(
        <label key={o} style={{display:"flex",alignItems:"center",gap:5,fontSize:13,cursor:"pointer",
          ...(colors[o]?{color:colors[o],fontWeight:value===o?700:400}:{})}}>
          <input type="radio" checked={value===o} onChange={()=>onChange(o)}
            style={{accentColor:colors[o]||"#2563eb"}}/>
          {o}
        </label>
      ))}
    </div>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────
const s = {
  root:      {fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",background:"#f5f5f3",minHeight:"100vh",color:"#1a1a1a"},
  center:    {display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"},
  header:    {display:"flex",alignItems:"flex-end",justifyContent:"space-between",padding:"24px 32px 18px",background:"#fff",borderBottom:"1px solid #e5e5e5"},
  brand:     {fontSize:10,fontWeight:700,letterSpacing:4,color:"#2563eb",marginBottom:4},
  pageTitle: {fontSize:21,fontWeight:700},
  uploadBtn: {background:"#f0f7ff",color:"#2563eb",border:"1.5px solid #bfdbfe",borderRadius:8,padding:"9px 14px",fontSize:13,fontWeight:600,cursor:"pointer"},
  addBtn:    {background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:"pointer"},
  toolbar:   {display:"flex",alignItems:"center",gap:8,padding:"12px 32px",background:"#fff",borderBottom:"1px solid #e5e5e5",flexWrap:"wrap"},
  search:    {flex:1,minWidth:180,border:"1px solid #ddd",borderRadius:8,padding:"8px 14px",fontSize:13,background:"#fafafa",outline:"none"},
  filters:   {display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"},
  fBtn:      {border:"1px solid #e5e5e5",borderRadius:20,padding:"4px 12px",fontSize:12,cursor:"pointer",background:"#fff",color:"#888",fontWeight:500},
  fBtnOn:    {fontWeight:700,borderColor:"currentColor"},
  count:     {fontSize:12,color:"#999",whiteSpace:"nowrap",marginLeft:"auto"},
  body:      {display:"flex",padding:"20px 32px",gap:20,minHeight:"calc(100vh - 150px)"},
  tableWrap: {flex:1,overflowX:"auto"},
  table:     {width:"100%",borderCollapse:"collapse",background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"},
  thead:     {background:"#f8f9fa"},
  th:        {padding:"11px 14px",fontSize:11,fontWeight:600,color:"#888",textAlign:"left",borderBottom:"1px solid #eee",whiteSpace:"nowrap",letterSpacing:0.3},
  tr:        {borderBottom:"1px solid #f5f5f5",cursor:"pointer",transition:"background 0.1s"},
  trOn:      {background:"#eff6ff"},
  td:        {padding:"11px 14px",fontSize:13},
  codeCell:  {whiteSpace:"nowrap"},
  codeTag:   {fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#2563eb",background:"#eff6ff",padding:"2px 7px",borderRadius:5},
  mono:      {fontFamily:"monospace",letterSpacing:0.5},
  badge:     {fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,display:"inline-block",whiteSpace:"nowrap"},
  svcTag:    {fontSize:11,background:"#f0f4ff",color:"#2563eb",padding:"2px 7px",borderRadius:5,display:"inline-block"},
  empty:     {textAlign:"center",color:"#bbb",fontSize:14,padding:"80px 0"},
  detail:    {width:280,background:"#fff",borderRadius:12,padding:18,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",alignSelf:"flex-start",position:"sticky",top:20,flexShrink:0},
  dTop:      {display:"flex",justifyContent:"space-between",marginBottom:14,paddingBottom:14,borderBottom:"1px solid #f0f0f0"},
  dName:     {fontSize:15,fontWeight:700,lineHeight:1.3,marginBottom:3},
  dCode:     {fontSize:11,color:"#2563eb",fontFamily:"monospace",fontWeight:700},
  editBtn:   {background:"#f0f4ff",color:"#2563eb",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"},
  delBtn:    {background:"#fff1f0",color:"#ef4444",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"},
  overlay:   {position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000},
  modal:     {background:"#fff",borderRadius:14,padding:"26px 26px 22px",width:600,maxWidth:"94vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"},
  mHead:     {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16},
  mTitle:    {fontSize:17,fontWeight:700},
  extracting:{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#2563eb",fontWeight:500},
  extBody:   {textAlign:"center",color:"#888",fontSize:14,padding:"44px 0"},
  tabs:      {display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid #eee"},
  tabBtn:    {background:"none",border:"none",borderBottom:"2px solid transparent",padding:"8px 18px",fontSize:13,fontWeight:500,color:"#888",cursor:"pointer",marginBottom:-1,transition:"color 0.15s"},
  tabOn:     {color:"#2563eb",borderBottomColor:"#2563eb",fontWeight:700},
  grid:      {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px 20px"},
  inp:       {border:"1px solid #ddd",borderRadius:7,padding:"8px 12px",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"},
  mFoot:     {display:"flex",justifyContent:"flex-end",gap:8,marginTop:22,paddingTop:16,borderTop:"1px solid #f0f0f0"},
  cancelBtn: {background:"#f5f5f5",color:"#555",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:"pointer"},
  saveBtn:   {background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"9px 22px",fontSize:13,fontWeight:600,cursor:"pointer"},
  toast:     {position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#1a1a1a",color:"#fff",padding:"10px 20px",borderRadius:8,fontSize:13,fontWeight:500,zIndex:2000,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"},
};
