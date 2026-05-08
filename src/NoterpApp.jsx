import { useState, useEffect } from "react";
import {
  LayoutDashboard, Building2, FolderKanban,
  PenLine, Receipt, Database, ChevronLeft, ChevronRight
} from "lucide-react";

import Dashboard  from "./modules/Dashboard.jsx";
import Clients    from "./modules/Clients.jsx";
import Projects   from "./modules/Projects.jsx";
import Memo       from "./modules/Memo.jsx";
import Ledger     from "./modules/Ledger.jsx";
import SeedImport from "./modules/SeedImport.jsx";

const MENU = [
  { key:"dashboard", label:"대시보드",       Icon:LayoutDashboard, Component:Dashboard },
  { key:"clients",   label:"거래처",          Icon:Building2,       Component:Clients   },
  { key:"projects",  label:"프로젝트",        Icon:FolderKanban,    Component:Projects  },
  { key:"memo",      label:"데일리 메모",     Icon:PenLine,         Component:Memo      },
  { key:"ledger",    label:"매출매입장",      Icon:Receipt,         Component:Ledger    },
  { key:"seed",      label:"데이터 가져오기", Icon:Database,        Component:SeedImport },
];

export default function NoterpApp() {
  const [active,    setActive]    = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
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
        const bookkeepingClients = allClients.filter(c =>
          c.service==="세무대리" && c.service_detail==="기장"
        );
        setStats({
          clients:  bookkeepingClients.length,
          projects: pp.status==="fulfilled"&&pp.value ? JSON.parse(pp.value.value).length : 0,
          memos:    pm.status==="fulfilled"&&pm.value ? JSON.parse(pm.value.value).length : 0,
          txs:      pt.status==="fulfilled"&&pt.value ? JSON.parse(pt.value.value).length : 0,
        });
      } catch{}
    };
    loadStats();
  }, [active]);

  const ActiveComponent = MENU.find(m=>m.key===active)?.Component || Dashboard;

  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateX(4px)}to{opacity:1;transform:translateX(0)}}
        body{margin:0}
        * { box-sizing: border-box; }
        .menu-item:hover{background:#f0f4ff!important}
        .menu-item-active:hover{background:#2563eb!important}
        .collapse-btn:hover{background:#e5e7eb!important}
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
              <button key={m.key}
                className={isActive?"menu-item-active":"menu-item"}
                style={{...s.menuBtn, ...(isActive?s.menuBtnOn:{}), justifyContent:collapsed?"center":"flex-start"}}
                onClick={()=>setActive(m.key)}
                title={collapsed?m.label:""}>
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
        <div key={active} style={s.contentFrame}>
          <ActiveComponent/>
        </div>
      </main>
    </div>
  );
}

const s = {
  root: { display:"flex", minHeight:"100vh", height:"100vh", overflow:"hidden",
    fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",
    background:"#f5f5f3", color:"#1a1a1a" },
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
};
