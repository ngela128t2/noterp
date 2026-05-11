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

// 🎯 타임존 해결: 한국 시간(KST) 기준으로 오늘 날짜 구하기
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
  reg_date: today(),
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
    setExtract(true); setShowForm(true); setTab("기본");
    
    try {
      const ex = await extractFromFile(file);
      const cleanBizNo = (ex.biz_no || "").replace(/\D/g, "");
      
      // 🎯 수정 포인트: 기존 거래처 목록에 같은 사업자번호가 있는지 검사
      const existingClient = clients.find(c => c.biz_no.replace(/\D/g, "") === cleanBizNo && cleanBizNo !== "");
