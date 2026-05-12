import { useState, useEffect, useRef } from "react";

// ─── 상수 (품질관리 강화) ──────────────────────────────────────────────────
const SERVICE_TYPES = ["세무대리", "외부감사", "품질관리", "컨설팅", "자문", "한공회", "강의", "기타"];
const SERVICE_DETAIL = {
  "세무대리": ["기장", "청산신고", "법인세 신고", "종합소득세 신고", "부가가치세 신고", "원천세", "기타"],
  "품질관리": ["사전심리(심리)", "발행후감리", "수시감리", "모니터링", "독립성체크", "QC컨설팅", "기타"],
  "외부감사": ["상장법인", "코스닥법인", "비상장법인", "학교법인", "공공기관", "사회복지법인", "기타"],
  "컨설팅":   ["세무컨설팅", "회계컨설팅", "M&A", "기업가치평가", "기타"],
  "자문":     ["세무자문", "회계자문", "법률자문", "경영자문"],import { useState, useEffect, useRef } from "react";

// ─── 상수 (회계법인 맞춤형) ───────────────────────────────────────────────────
const SERVICE_TYPES = ["세무대리","외부감사","컨설팅","자문","한공회","강의","기타"];

const SERVICE_DETAIL = {
  "세무대리":["기장","청산신고","법인세 신고","종합소득세 신고","부가가치세 신고","원천세","기타"],
  "외부감사":["상장법인","코스닥법인","비상장법인","학교법인","공공기관","사회복지법인","기타"],
  "컨설팅":  ["세무컨설팅","회계컨설팅","M&A","기타"],
  "자문":    ["세무자문","회계자문","법률자문","기타"],
  "한공회":  ["감리","윤리","품질관리","기타"],
  "강의":    ["중회협","기업출강","기타"],
  "기타":    [],
};

const CLIENT_TYPES = [
  { value:"매출처", color:"#2563eb", bg:"#eff6ff" },
  { value:"매입처", color:"#059669", bg:"#ecfdf5" },
  { value:"공통",   color:"#7c3aed", bg:"#f5f3ff" },
];

const BANKS = ["국민","신한","하나","우리","농협","기업","SC제일","씨티","카카오뱅크",
  "토스뱅크","새마을금고","수협","부산","경남","대구","광주","전북","제주","산업","수출입","기타"];

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const EMPTY = {
  name:"", corp_type:"법인", biz_no:"", id_no:"", fss_no:"",
  rep:"", address:"", contact:"", email:"", industry:"",
  opening_date: "", 
  reg_date: today(), 
  fiscal_month: "12월", // 🎯 추가: 회계법인 디폴트는 12월 결산!
  client_type:"매출처", service:"", service_detail:"", service_desc:"",
  bank_name:"", account_no:"", account_holder:"",
  manager:"", memo:"",
};

// ─── 포맷 유틸 ────────────────────────────────────────────────
const fmt = {
  bizNo: v => {
    const n = v.replace(/\D/g,"").slice(0,10);
    if (n.length<=3) return n;
    if (n.length<=5) return n.slice(0,3)+"-"+n.slice(3);
    return n.slice(0,3)+"-"+n.slice(3,5)+"-"+n.slice(5);
  },
  idNo: v => {
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
      prompt: `사업자등록증에서 정보 추출 후 JSON만 반환. 없으면 빈 문자열.
{
  "name": "상호 또는 법인명",
  "corp_type": "법인 또는 개인",
  "biz_no": "사업자등록번호(000-00-00000)",
  "id_no": "법인등록번호(있으면 000000-0000000, 없으면 빈 문자열)",
  "rep": "대표자 성명",
  "address": "사업장 소재지",
  "industry": "업태/종목",
  "opening_date": "개업연월일(YYYY-MM-DD 형태로 변환)"
}
JSON 외 텍스트 없이.`,
      image: { base64, mimeType: file.type }
    })
  });

  const data = await resp.json();
  const text = data.text || data.content?.[0]?.text || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─── 메인 ─────────────────────────────────────────────────────
export default function NoterpClients() {
  const [clients,  setClients]  = useState([]);
  const [projects, setProjects] = useState([]); // 🎯 추가: 프로젝트 데이터를 담을 공간
  const [search,   setSearch]   = useState("");
  const [ftSvc,    setFtSvc]    = useState(""); 
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
      // 🎯 추가: 프로젝트 데이터도 같이 불러옵니다 (키워드는 "noterp_pj"로 가정)
      try { const p=await window.storage.get("noterp_pj"); if(p) setProjects(JSON.parse(p.value)); } catch{}
      setLoading(false);
    })();
  },[]);

  const persist = async d => { try{ await window.storage.set("noterp_cl",JSON.stringify(d)); }catch{} };
  const notify  = msg => { setToast(msg); setTimeout(()=>setToast(null),2500); };
  const setF    = (k,v) => setForm(f=>({...f,[k]:v}));

  const openAdd  = () => { setEditId(null); setForm({...EMPTY,reg_date:today()}); setTab("기본"); setShowForm(true); };
  const openEdit = c  => { setEditId(c.id); setForm({...c, fiscal_month: c.fiscal_month || "12월"}); setTab("기본"); setShowForm(true); setSelected(null); };

  const handleFile = async e => {
    const file = e.target.files?.[0]; if(!file) return; e.target.value="";
    setExtract(true); setShowForm(true); setTab("기본");
    
    try {
      const ex = await extractFromFile(file);
      const cleanBizNo = (ex.biz_no || "").replace(/\D/g, "");
      const existingClient = clients.find(c => (c.biz_no || "").replace(/\D/g, "") === cleanBizNo && cleanBizNo !== "");

      if (existingClient) {
        setEditId(existingClient.id);
        setForm({
          ...existingClient,
          name:        ex.name || existingClient.name,
          corp_type:   ex.corp_type==="개인"?"개인":"법인",
          biz_no:      fmt.bizNo(ex.biz_no || existingClient.biz_no),
          id_no:       fmt.idNo(ex.id_no || existingClient.id_no),
          rep:         ex.rep || existingClient.rep,
          address:     ex.address || existingClient.address,
          industry:    ex.industry || existingClient.industry,
          opening_date: ex.opening_date || existingClient.opening_date || "",
          fiscal_month: existingClient.fiscal_month || "12월",
        });
        notify("✓ 기존 거래처 발견! 최신 정보로 업데이트합니다.");
      } else {
        setEditId(null);
        setForm({
          ...EMPTY,
          name:        ex.name||"",
          corp_type:   ex.corp_type==="개인"?"개인":"법인",
          biz_no:      fmt.bizNo(ex.biz_no||""),
          id_no:       fmt.idNo(ex.id_no||""),
          rep:         ex.rep||"",
          address:     ex.address||"",
          industry:    ex.industry||"",
          opening_date: ex.opening_date || "",
          fiscal_month: "12월", // 새 거래처도 기본은 12월
          reg_date:    today(),
        });
        notify("✓ 새 사업자등록증 인식 완료");
      }
    } catch { 
      setEditId(null); 
      setForm({...EMPTY, reg_date:today()}); 
      notify("인식 실패 — 직접 입력해주세요"); 
    }
    finally { setExtract(false); }
  };

  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf("image") === 0) {
          const file = item.getAsFile();
          handleFile({ target: { files: [file], value: "" } });
          break; 
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [clients]);

  const handleSubmit = async () => {
    if(!form.name.trim()) return;

    if (form.biz_no) {
      const cleanBiz = form.biz_no.replace(/\D/g, "");
      const isDuplicate = clients.some(c => c.id !== editId && (c.biz_no || "").replace(/\D/g, "") === cleanBiz && cleanBiz !== "");
      if (isDuplicate) {
        alert("⚠️ 이미 등록된 사업자번호입니다!");
        return; 
      }
    }

    let updated;
    if(editId){
      updated = clients.map(c=>c.id===editId?{...form,id:editId,code:c.code}:c);
      notify("정보 수정 완료");
    } else {
      const code = genCode(clients, form.corp_type);
      updated = [{...form, id:Date.now().toString(), code, created_at:new Date().toISOString()}, ...clients];
      notify(`새 거래처 추가 완료 (${code})`);
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
      && (!ftSvc||c.service===ftSvc); 
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
        <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4}}>
          <div style={{display:"flex",gap:8}}>
            <button style={s.uploadBtn} onClick={()=>fileRef.current?.click()}>📄 사업자등록증</button>
            <button style={s.addBtn} onClick={openAdd}>+ 직접 추가</button>
          </div>
          <span style={{fontSize: 11, color: "#999", marginRight: 2}}>* PDF 업로드 또는 이미지 화면 캡처 후 Ctrl+V 가능</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={handleFile}/>
      </div>

      {/* 툴바 */}
      <div style={s.toolbar}>
        <input style={s.search} placeholder="거래처명 / 사업자번호 검색"
          value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={s.filters}>
          {["", "세무대리", "외부감사", "자문", "컨설팅", "한공회"].map(v=>(
            <button key={v||"전체"} style={{...s.fBtn,...(ftSvc===v?s.fBtnOn:{})}}
              onClick={()=>setFtSvc(v)}>{v||"전체 보기"}</button>
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
              {clients.length===0?"사업자등록증을 캡처 후 Ctrl + V를 눌러보세요 ✨":"검색 결과가 없습니다"}
            </div>
          ):(
            <table style={s.table}>
              <thead><tr style={s.thead}>
                {/* 🎯 테이블 헤더에 결산월, PJT 수 추가 */}
                {["코드","거래처명","사업자번호","제공 용역","결산월","PJT","시스템 등록일","담당자"].map(h=>(
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(c=>{
                  // 🎯 이 거래처와 연결된 프로젝트 수 계산 (client_id 또는 code 기준)
                  const projCount = projects.filter(p => p.client_id === c.id || p.client_code === c.code).length;
                  
                  return (
                  <tr key={c.id} className="row"
                    style={{...s.tr,...(selected?.id===c.id?s.trOn:{})}}
                    onClick={()=>setSelected(selected?.id===c.id?null:c)}>
                    <td style={{...s.td,...s.codeCell}}>
                      <span style={s.codeTag}>{c.code}</span>
                    </td>
                    <td style={{...s.td,fontWeight:600}}>{c.name}</td>
                    <td style={{...s.td,...s.mono}}>{c.biz_no}</td>
                    <td style={s.td}>
                      {c.service ? (
                        <div style={{display:"flex", gap:4}}>
                          <span style={{...s.svcTag, 
                            background: c.service==="외부감사" ? "#eff6ff" : c.service==="세무대리" ? "#ecfdf5" : c.service==="한공회" ? "#f5f3ff" : "#f0f4ff",
                            color: c.service==="외부감사" ? "#2563eb" : c.service==="세무대리" ? "#059669" : c.service==="한공회" ? "#7c3aed" : "#555"
                          }}>{c.service}</span>
                        </div>
                      ) : <span style={{color:"#bbb", fontSize: 12}}>미지정</span>}
                    </td>
                    {/* 🎯 결산월 및 PJT 뱃지 표출 */}
                    <td style={{...s.td,color:"#475569",fontSize:12, fontWeight:500}}>{c.fiscal_month || "12월"}</td>
                    <td style={s.td}>
                      {projCount > 0 ? (
                        <span style={s.projTag}>{projCount}건</span>
                      ) : <span style={{color:"#ddd", fontSize:11}}>-</span>}
                    </td>
                    <td style={{...s.td,color:"#999",fontSize:12}}>{c.reg_date}</td>
                    <td style={{...s.td,color:"#666"}}>{c.manager}</td>
                  </tr>
                )})}
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
                  <span style={{...s.badge, background:"#f5f5f5", color:"#555"}}>{selected.corp_type}</span>
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
              ["결산월",      selected.fiscal_month || "12월", false], // 🎯 상세 패널 상단에 결산월 배치
              ["사업자번호",  selected.biz_no,  true],
              [selIdLabel,    selected.id_no,   true],
              ["금감원번호",  selected.fss_no,  false],
              ["대표자",      selected.rep,     false],
              ["개업일",      selected.opening_date, false], 
              ["등록일",      selected.reg_date, false], 
            ].filter(([,v])=>v).map(([k,v,m])=>(
              <Row key={k} label={k} val={v} mono={m}/>
            ))}

            {(selected.service||selected.service_detail||selected.service_desc)&&<>
              <Sec title="용역 및 계약정보"/>
              {[
                ["제공용역",  selected.service],
                ["상세분류",  selected.service_detail],
                ["용역내용",  selected.service_desc],
              ].filter(([,v])=>v).map(([k,v])=><Row key={k} label={k} val={v}/>)}
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
                {["기본","계좌","기타"].map(t=>(
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
                  <In value={form.name} onChange={v=>setF("name",v)} ph="주식회사 ABC"/>
                </FL>

                <FL label="법인구분">
                  <Radio options={["법인","개인"]} value={form.corp_type}
                    onChange={v=>setF("corp_type",v)}/>
                </FL>

                {/* 🎯 결산월 드롭다운 추가 */}
                <FL label="결산월">
                  <select style={s.inp} value={form.fiscal_month} onChange={e=>setF("fiscal_month",e.target.value)}>
                    {["12월","3월","6월","9월","기타"].map(m=><option key={m}>{m}</option>)}
                  </select>
                </FL>

                <FL label="제공 용역 (대분류)">
                  <select style={{...s.inp, borderColor:"#2563eb", borderWidth: 2}} value={form.service}
                    onChange={e=>{setF("service",e.target.value); setF("service_detail","");}}>
                    <option value="">선택</option>
                    {SERVICE_TYPES.map(sv=><option key={sv}>{sv}</option>)}
                  </select>
                </FL>

                <FL label="용역 (상세분류)">
                  <select style={s.inp} value={form.service_detail}
                    onChange={e=>setF("service_detail",e.target.value)}
                    disabled={!form.service||!SERVICE_DETAIL[form.service]?.length}>
                    <option value="">선택</option>
                    {(SERVICE_DETAIL[form.service]||[]).map(d=><option key={d}>{d}</option>)}
                  </select>
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

                <FL label="개업연월일">
                  <input type="date" style={s.inp} value={form.opening_date}
                    onChange={e=>setF("opening_date",e.target.value)}/>
                </FL>

                <FL label="시스템 등록일">
                  <input type="date" style={s.inp} value={form.reg_date}
                    onChange={e=>setF("reg_date",e.target.value)} disabled />
                </FL>

                <FL label="주소" full>
                  <In value={form.address} onChange={v=>setF("address",v)} ph="서울시 강남구..."/>
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
                <button style={s.saveBtn} onClick={handleSubmit}>{editId?"정보 수정 완료":"거래처 추가"}</button>
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
  fBtnOn:    {fontWeight:700,borderColor:"currentColor",background:"#f8f9fa",color:"#222"},
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
  svcTag:    {fontSize:11,padding:"3px 8px",borderRadius:6,display:"inline-block",fontWeight:600},
  projTag:   {fontSize:11, background:"#f1f5f9", color:"#475569", padding:"2px 8px", borderRadius:10, fontWeight:600}, // 🎯 프로젝트 수 뱃지 스타일
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
