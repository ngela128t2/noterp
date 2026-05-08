import { useState, useEffect } from "react";
import {
  LayoutDashboard, Building2, FolderKanban,
  PenLine, Receipt, ChevronLeft, ChevronRight, Lock, LogOut, Menu, X
} from "lucide-react";

import Dashboard from "./modules/Dashboard.jsx";
import Clients   from "./modules/Clients.jsx";
import Projects  from "./modules/Projects.jsx";
import Memo      from "./modules/Memo.jsx";
import Ledger    from "./modules/Ledger.jsx";

const PASSWORD = "ghkdlxld!";

const MENU = [
  { key:"dashboard", label:"대시보드",     short:"홈",     Icon:LayoutDashboard, Component:Dashboard },
  { key:"clients",   label:"거래처",        short:"거래처", Icon:Building2,       Component:Clients   },
  { key:"projects",  label:"프로젝트",      short:"프로젝트", Icon:FolderKanban,  Component:Projects  },
  { key:"memo",      label:"데일리 메모",   short:"메모",   Icon:PenLine,         Component:Memo      },
  { key:"ledger",    label:"매출매입장",    short:"장부",   Icon:Receipt,         Component:Ledger    },
];

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

function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    setUnlocked(localStorage.getItem("noterp_unlocked") === "yes");
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === PASSWORD) {
      localStorage.setItem("noterp_unlocked", "yes");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setInput("");
    }
  };

  if (unlocked === null) return null;
  if (unlocked) return children;

  return (
    <div style={lockS.root}>
      <style>{`
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
        body{margin:0}
      `}</style>
      <div style={lockS.box}>
        <Lock size={32} color="#2563eb" strokeWidth={2.2}/>
        <div style={lockS.brand}>NOTERP</div>
        <div style={lockS.title}>비밀번호를 입력해주세요</div>
        <form onSubmit={handleSubmit} style={{width:"100%"}}>
          <input type="password" autoFocus placeholder="비밀번호" value={input}
            onChange={e=>{setInput(e.target.value); setError(false);}}
            style={{...lockS.input, ...(error?lockS.inputErr:{}), animation:error?"shake 0.3s":"none"}}/>
          {error && <div style={lockS.err}>비밀번호가 틀렸어요</div>}
          <button type="submit" style={lockS.btn}>들어가기</button>
        </form>
      </div>
    </div>
  );
}

const lockS = {
  root:    { display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"linear-gradient(135deg,#eff6ff,#f5f3ff)",fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",padding:"20px" },
  box:     { background:"#fff",borderRadius:16,padding:"36px 28px",width:"100%",maxWidth:340,boxShadow:"0 20px 60px rgba(0,0,0,0.1)",display:"flex",flexDirection:"column",alignItems:"center",boxSizing:"border-box" },
  brand:   { fontSize:13,fontWeight:800,letterSpacing:4,color:"#2563eb",marginTop:14 },
  title:   { fontSize:14,color:"#444",margin:"6px 0 22px",fontWeight:500,textAlign:"center" },
  input:   { width:"100%",border:"1.5px solid #e5e5e5",borderRadius:10,padding:"13px 14px",fontSize:16,outline:"none",boxSizing:"border-box",fontFamily:"inherit" },
  inputErr:{ borderColor:"#ef4444" },
  err:     { color:"#ef4444",fontSize:12,marginTop:6,textAlign:"left" },
  btn:     { width:"100%",background:"#2563eb",color:"#fff",border:"none",borderRadius:10,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:14 },
};

export default function NoterpApp() {
  return <PasswordGate><NoterpMain/></PasswordGate>;
}

function NoterpMain() {
  const isMobile = useIsMobile();
  const [active,    setActive]    = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen,setDrawerOpen]= useState(false);
  const [stats,     setStats]     = useState({ clients:0, projects:0, memos:0, txs:0 });

  useEffect(()=>{
    const loadStats = async () => {
      try {
        const [pc, pp, pm, pt] = await Promise.allSettled([
          window.storage.get("noterp_cl"),
          window.storage.get("noterp_prj"),
          window.storage.get("noterp_memo"),
          window.storage.get("noterp_tx"),
        ]);
        const allClients = pc.status==="fulfilled"&&pc.value ? JSON.parse(pc.value.value) : [];
        const bk = allClients.filter(c => c.service==="세무대리" && c.service_detail==="기장");
        setStats({
          clients:  bk.length,
          projects: pp.status==="fulfilled"&&pp.value ? JSON.parse(pp.value.value).length : 0,
          memos:    pm.status==="fulfilled"&&pm.value ? JSON.parse(pm.value.value).length : 0,
          txs:      pt.status==="fulfilled"&&pt.value ? JSON.parse(pt.value.value).length : 0,
        });
      } catch{}
    };
    loadStats();
  }, [active]);

  const handleLogout = () => {
    if(!confirm("로그아웃 하시겠습니까?")) return;
    localStorage.removeItem("noterp_unlocked");
    window.location.reload();
  };

  const ActiveComponent = MENU.find(m=>m.key===active)?.Component || Dashboard;
  const activeMenu = MENU.find(m=>m.key===active);

  if (isMobile) {
    return (
      <div style={s.mRoot}>
        <style>{`
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
          @keyframes fadeIn{from{opacity:0}to{opacity:1}}
          body{margin:0}
          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          input, select, textarea { font-size: 16px !important; }
        `}</style>

        <header style={s.mTopBar}>
          <button style={s.mMenuBtn} onClick={()=>setDrawerOpen(true)}><Menu size={22}/></button>
          <div style={s.mTopTitle}>
            <div style={s.mBrand}>NOTERP</div>
            <div style={s.mPageLabel}>{activeMenu?.label}</div>
          </div>
          <div style={{width:38}}/>
        </header>

        <main style={s.mContent}>
          <div key={active} style={{animation:"fadeIn 0.2s"}}>
            <ActiveComponent/>
          </div>
        </main>

        <nav style={s.mTabBar}>
          {MENU.map(m=>{
            const isActive = active===m.key;
            return (
              <button key={m.key} style={{...s.mTab, ...(isActive?s.mTabOn:{})}}
                onClick={()=>setActive(m.key)}>
                <m.Icon size={20} strokeWidth={isActive?2.4:1.8}/>
                <span style={s.mTabLabel}>{m.short}</span>
              </button>
            );
          })}
        </nav>

        {drawerOpen && (
          <>
            <div style={s.drawerOverlay} onClick={()=>setDrawerOpen(false)}/>
            <aside style={s.drawer}>
              <div style={s.drawerHeader}>
                <div>
                  <div style={s.logoMain}>NOTERP</div>
                  <div style={s.logoSub}>업무관리 시스템</div>
                </div>
                <button style={s.drawerClose} onClick={()=>setDrawerOpen(false)}><X size={20}/></button>
              </div>
              <div style={s.drawerStats}>
                <div style={s.statsTitle}>현황</div>
                <div style={s.statRow}><span>거래처(기장)</span><b>{stats.clients}</b></div>
                <div style={s.statRow}><span>프로젝트</span><b>{stats.projects}</b></div>
                <div style={s.statRow}><span>메모</span><b>{stats.memos}</b></div>
                <div style={s.statRow}><span>거래</span><b>{stats.txs}</b></div>
              </div>
              <div style={s.drawerFoot}>
                <button style={s.drawerLogout} onClick={handleLogout}>
                  <LogOut size={14}/><span style={{marginLeft:8}}>로그아웃</span>
                </button>
              </div>
            </aside>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateX(4px)}to{opacity:1;transform:translateX(0)}}
        body{margin:0}
        * { box-sizing: border-box; }
        .menu-item:hover{background:#f0f4ff!important}
        .menu-item-active:hover{background:#2563eb!important}
        .collapse-btn:hover,.logout-btn:hover{background:#e5e7eb!important}
      `}</style>

      <aside style={{...s.sidebar, width: collapsed ? 64 : 220}}>
        <div style={s.logoBox}>
          {!collapsed ? (
            <div>
              <div style={s.logoMain}>NOTERP</div>
              <div style={s.logoSub}>업무관리 시스템</div>
            </div>
          ) : (
            <div style={s.logoMini}>N</div>
          )}
        </div>
        <nav style={s.nav}>
          {MENU.map(m=>{
            const isActive = active===m.key;
            return (
              <button key={m.key} className={isActive?"menu-item-active":"menu-item"}
                style={{...s.menuBtn, ...(isActive?s.menuBtnOn:{}), justifyContent:collapsed?"center":"flex-start"}}
                onClick={()=>setActive(m.key)} title={collapsed?m.label:""}>
                <m.Icon size={18} strokeWidth={isActive?2.4:1.8}/>
                {!collapsed && <span style={s.menuLabel}>{m.label}</span>}
              </button>
            );
          })}
        </nav>
        {!collapsed && (
          <div style={s.statsBox}>
            <div style={s.statsTitle}>현황</div>
            <div style={s.statRow}><span>거래처(기장)</span><b>{stats.clients}</b></div>
            <div style={s.statRow}><span>프로젝트</span><b>{stats.projects}</b></div>
            <div style={s.statRow}><span>메모</span><b>{stats.memos}</b></div>
            <div style={s.statRow}><span>거래</span><b>{stats.txs}</b></div>
          </div>
        )}
        <div style={s.sideFoot}>
          <button className="logout-btn"
            style={{...s.collapseBtn, justifyContent:collapsed?"center":"flex-start", marginBottom:4}}
            onClick={handleLogout}>
            <LogOut size={14}/>
            {!collapsed && <span style={{marginLeft:6,fontSize:12}}>로그아웃</span>}
          </button>
          <button className="collapse-btn"
            style={{...s.collapseBtn, justifyContent:collapsed?"center":"flex-start"}}
            onClick={()=>setCollapsed(c=>!c)}>
            {collapsed
              ? <ChevronRight size={16}/>
              : <><ChevronLeft size={16}/><span style={{marginLeft:6,fontSize:12}}>접기</span></>}
          </button>
        </div>
      </aside>
      <main style={s.main}>
        <div key={active} style={s.contentFrame}><ActiveComponent/></div>
      </main>
    </div>
  );
}

const s = {
  root: { display:"flex", minHeight:"100vh", height:"100vh", overflow:"hidden",
    fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif", background:"#f5f5f3", color:"#1a1a1a" },
  sidebar: { background:"#fff", borderRight:"1px solid #e5e7eb",
    display:"flex", flexDirection:"column", transition:"width 0.2s ease", flexShrink:0 },
  logoBox: { padding:"22px 18px 20px", borderBottom:"1px solid #f0f0f0",
    minHeight:80, display:"flex", alignItems:"center" },
  logoMain: { fontSize:18, fontWeight:800, letterSpacing:2.5, color:"#2563eb" },
  logoSub:  { fontSize:10, color:"#999", marginTop:3, letterSpacing:0.3 },
  logoMini: { width:30, height:30, borderRadius:8, background:"#2563eb",
    color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:16, fontWeight:800, margin:"0 auto" },
  nav: { padding:"12px 10px", display:"flex", flexDirection:"column", gap:2, flex:1 },
  menuBtn: { display:"flex", alignItems:"center", gap:11, padding:"10px 12px",
    border:"none", background:"transparent", borderRadius:8, cursor:"pointer",
    fontSize:13, fontWeight:500, color:"#555", transition:"all 0.12s", width:"100%" },
  menuBtnOn: { background:"#2563eb", color:"#fff", fontWeight:700 },
  menuLabel: { animation:"fadeIn 0.2s", whiteSpace:"nowrap" },
  statsBox: { margin:"0 12px 12px", padding:"14px", background:"#f8fafc", borderRadius:10 },
  statsTitle: { fontSize:10, fontWeight:700, color:"#94a3b8",
    letterSpacing:1.2, marginBottom:10, textTransform:"uppercase" },
  statRow: { display:"flex", justifyContent:"space-between",
    fontSize:12, color:"#64748b", padding:"4px 0" },
  sideFoot: { padding:"10px", borderTop:"1px solid #f0f0f0" },
  collapseBtn: { width:"100%", display:"flex", alignItems:"center",
    border:"none", background:"transparent", borderRadius:8,
    padding:"8px 12px", cursor:"pointer", color:"#888", transition:"background 0.1s" },
  main: { flex:1, overflow:"hidden", display:"flex", flexDirection:"column" },
  contentFrame: { flex:1, overflow:"auto", animation:"fadeIn 0.25s ease" },

  mRoot: { display:"flex", flexDirection:"column", minHeight:"100vh",
    background:"#f5f5f3", color:"#1a1a1a",
    fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" },
  mTopBar: { position:"sticky", top:0, zIndex:50, display:"flex", alignItems:"center",
    justifyContent:"space-between", padding:"10px 12px",
    background:"#fff", borderBottom:"1px solid #e5e7eb",
    boxShadow:"0 1px 3px rgba(0,0,0,0.04)" },
  mMenuBtn: { background:"none", border:"none", cursor:"pointer",
    padding:8, color:"#555", display:"flex", alignItems:"center" },
  mTopTitle: { textAlign:"center", flex:1 },
  mBrand: { fontSize:9, fontWeight:800, letterSpacing:3, color:"#2563eb" },
  mPageLabel: { fontSize:15, fontWeight:700, color:"#1a1a1a", marginTop:2 },
  mContent: { flex:1, paddingBottom:64, overflow:"auto" },
  mTabBar: { position:"fixed", bottom:0, left:0, right:0, zIndex:40,
    display:"grid", gridTemplateColumns:"repeat(5,1fr)",
    background:"#fff", borderTop:"1px solid #e5e7eb",
    boxShadow:"0 -2px 8px rgba(0,0,0,0.04)",
    paddingBottom:"env(safe-area-inset-bottom)" },
  mTab: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    gap:3, padding:"8px 4px", border:"none", background:"transparent",
    cursor:"pointer", color:"#999", transition:"color 0.1s" },
  mTabOn: { color:"#2563eb" },
  mTabLabel: { fontSize:10, fontWeight:600 },

  drawerOverlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
    zIndex:100, animation:"fadeIn 0.2s" },
  drawer: { position:"fixed", top:0, left:0, bottom:0, width:280, maxWidth:"82vw",
    background:"#fff", zIndex:101, display:"flex", flexDirection:"column",
    animation:"slideIn 0.25s ease" },
  drawerHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-start",
    padding:"22px 20px", borderBottom:"1px solid #f0f0f0" },
  drawerClose: { background:"none", border:"none", cursor:"pointer",
    padding:6, color:"#888", display:"flex" },
  drawerStats: { margin:16, padding:16, background:"#f8fafc", borderRadius:12 },
  drawerFoot: { marginTop:"auto", padding:16, borderTop:"1px solid #f0f0f0" },
  drawerLogout: { display:"flex", alignItems:"center", justifyContent:"center",
    width:"100%", padding:"10px 12px", background:"#f5f5f5", border:"none",
    borderRadius:8, cursor:"pointer", color:"#666", fontSize:13, fontWeight:600 },
};
