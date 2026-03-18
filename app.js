/* ═══════════════════════════════════════════════════════════
   INVISOL Connect — BLE Web App
   Matches all features of the SoftAP page (main/web/index.html)
   ═══════════════════════════════════════════════════════════ */

const SERVICE_UUID  = 0xFFF0;
const CMD_CHAR_UUID = 0xFFF1;
const TX_CHAR_UUID  = 0xFFF2;
const SOFTAP_URL    = "http://192.168.4.1";
const POLL_MS       = 1500;
const PLACEHOLDER   = "—";

/* ── BMS PRESET COMMANDS (same as SoftAP) ──────────────────── */
const BMS_CMDS = [
  { label:"Get Thresholds",           base:[0x02,0x06,0x9B,0x7C], fixed:0x0001, desc:"Read all parameters at once" },
  { label:"Cell Count",               base:[0x02,0x06,0x9B,0xC5],               desc:"3-24 cells" },
  { label:"Factory Capacity",         base:[0x02,0x06,0x9B,0xC7],               desc:"5-250 Ah" },
  { label:"Balance Trigger Voltage",  base:[0x02,0x06,0x9B,0xBF],               desc:"Balance start voltage" },
  { label:"Cell OVP",                 base:[0x02,0x06,0x9B,0xAF],               desc:"Cell over-voltage protection" },
  { label:"Cell OVPR",                base:[0x02,0x06,0x9B,0xF2],               desc:"Cell OVP recovery voltage" },
  { label:"Charge Over Current",      base:[0x02,0x06,0x9B,0xB3],               desc:"Charge over-current limit" },
  { label:"Charge OTP",               base:[0x02,0x06,0x9B,0xC1],               desc:"Charge over-temp protection" },
  { label:"Charge OTPR",              base:[0x02,0x06,0x9B,0xA2],               desc:"Charge OTP recovery temp" },
  { label:"Cell UVP",                 base:[0x02,0x06,0x9B,0xAD],               desc:"Cell under-voltage protection" },
  { label:"Cell UVPR",                base:[0x02,0x06,0x9B,0xF4],               desc:"Cell UVP recovery voltage" },
  { label:"Discharge Over Current",   base:[0x02,0x06,0x9B,0xD6],               desc:"Discharge over-current limit" },
  { label:"Discharge OTP",            base:[0x02,0x06,0x9B,0xB9],               desc:"Discharge over-temp protection" },
  { label:"Discharge OTPR",           base:[0x02,0x06,0x9B,0xE3],               desc:"Discharge OTP recovery temp" },
  { label:"Sleep Hour",               base:[0x02,0x06,0x9B,0x3E],               desc:"Sleep hour (0-23)" },
  { label:"Sleep Minute",             base:[0x02,0x06,0x9B,0x3D],               desc:"Sleep minute (0-59)" },
  { label:"Sleep Enable",             base:[0x02,0x06,0x9B,0x4C], fixed:0x0001, desc:"Enable sleep mode" },
  { label:"Sleep Disable",            base:[0x02,0x06,0x9B,0x4C], fixed:0x0000, desc:"Disable sleep mode" },
];

/* ── INVERTER QUICK SETTINGS ───────────────────────────────── */
const INV_QUICK = [
  { cmd:"POP",  desc:"Output Source Priority",   opts:["00:Utility First","01:Solar First","02:SBU Priority"] },
  { cmd:"PCP",  desc:"Charger Source Priority",  opts:["00:Utility First","01:Solar First","02:Solar+Utility","03:Only Solar"] },
  { cmd:"PGR",  desc:"Grid Working Range",        opts:["00:Appliance","01:UPS"] },
  { cmd:"PBT",  desc:"Battery Type",              opts:["00:AGM","01:Flooded","02:User","08:LiFePO4"] },
  { cmd:"PBCV", desc:"Battery Re-charge Voltage", input:"nn.n", ph:"e.g. 48.0" },
  { cmd:"PBDV", desc:"Battery Re-discharge Voltage", input:"nn.n", ph:"e.g. 48.0" },
  { cmd:"PSDV", desc:"Battery Cut-off Voltage",   input:"nn.n", ph:"e.g. 42.0" },
  { cmd:"PCVV", desc:"Battery C.V. Charging Voltage", input:"nn.n", ph:"e.g. 56.4" },
  { cmd:"PBFT", desc:"Battery Float Voltage",     input:"nn.n", ph:"e.g. 54.0" },
  { cmd:"MCHGC",  desc:"Max Charging Current",    input:"nnn",  ph:"e.g. 060" },
  { cmd:"MUCHGC", desc:"Utility Max Charging Current", input:"nnn", ph:"e.g. 030" },
  { cmd:"F",    desc:"Output Frequency",          opts:["50:50 Hz","60:60 Hz"] },
  { cmd:"POPM", desc:"Output Mode",               opts:["00:Single","01:Parallel","02:Phase1/3","03:Phase2/3","04:Phase3/3"] },
  { cmd:"PEA",  desc:"Enable Buzzer" },
  { cmd:"PDA",  desc:"Disable Buzzer" },
  { cmd:"PEB",  desc:"Enable Overload Bypass" },
  { cmd:"PDB",  desc:"Disable Overload Bypass" },
  { cmd:"PEJ",  desc:"Enable Power Saving" },
  { cmd:"PDJ",  desc:"Disable Power Saving" },
  { cmd:"PEU",  desc:"Enable Overload Restart" },
  { cmd:"PDU",  desc:"Disable Overload Restart" },
  { cmd:"PEV",  desc:"Enable Over-Temp Restart" },
  { cmd:"PDV",  desc:"Disable Over-Temp Restart" },
  { cmd:"PEY",  desc:"Enable Alarm on Primary Interrupt" },
  { cmd:"PDY",  desc:"Disable Alarm on Primary Interrupt" },
  { cmd:"PF",   desc:"FACTORY RESET ALL PARAMETERS", danger:true },
];

/* ── SETTINGS GROUPS ───────────────────────────────────────── */
const SETTINGS_GROUPS = {
  "Battery":["PBT","PBCV","PBDV","PSDV","PCVV","PBFT","MCHGC","MUCHGC"],
  "Output":["POP","PCP","PGR","F","POPM"],
  "Buzzer":["PEA","PDA"],
  "Overload":["PEB","PDB","PEU","PDU"],
  "Power Saving":["PEJ","PDJ"],
  "Temp":["PEV","PDV"],
  "Alarm":["PEY","PDY"],
  "System":["PF"],
};

/* ── STATE ─────────────────────────────────────────────────── */
let device=null, server=null, cmdChar=null, txChar=null;
let connected=false, invPolling=true, bmsPolling=true;
let rxBuffer="", pollTimer=null, deferredInstallPrompt=null;
let cmdHistory=[], bmsLogLines=[];
let lastInvData=null, lastBmsData=null;
let activeFlowNode="inverter";

/* ── DOM ────────────────────────────────────────────────────── */
const connectBtn = document.getElementById("connectBtn");
const installBtn = document.getElementById("installBtn");
const statusDot  = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const clockEl    = document.getElementById("clock");
const liveLog    = document.getElementById("liveLog");
const bleLog     = document.getElementById("bleLog");
const invCmdResp = document.getElementById("invCmdResp");
const bmsCmdResponse = document.getElementById("bmsCmdResponse");

/* ── HELPERS ─────────────────────────────────────────────────── */
function now(){ return new Date().toLocaleTimeString("en-US",{hour12:false}); }

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function fmt(v, dec=null){
  if(v===null||v===undefined||v===""||Number.isNaN(Number(v))) return PLACEHOLDER;
  return dec===null ? String(v) : Number(v).toFixed(dec);
}

function setEl(id,html){ const e=document.getElementById(id); if(e) e.innerHTML=html; }
function setText(id,v,dec=null){ setEl(id,fmt(v,dec)); }

function appendLine(container, text, cls=""){
  if(!container) return;
  const d=document.createElement("div");
  d.className=`line ${cls}`.trim();
  d.innerHTML=`<span class="ts">${now()}</span>${escapeHtml(text)}`;
  container.appendChild(d);
  container.scrollTop=container.scrollHeight;
  while(container.children.length>500) container.removeChild(container.firstChild);
}

function log(text,cls=""){ appendLine(liveLog,text,cls); }
function bleLog_(text,cls=""){ appendLine(bleLog,text,cls); log(text,cls); }
function clearLog(){ liveLog.innerHTML=""; }

/* ── CLOCK ──────────────────────────────────────────────────── */
setInterval(()=>{ if(clockEl) clockEl.textContent=new Date().toLocaleTimeString("en-US",{hour12:false}); },1000);

/* ── TABS ───────────────────────────────────────────────────── */
document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c=>c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add("active");
  });
});

/* ── BLE WRITE ──────────────────────────────────────────────── */
async function writeLine(line){
  if(!cmdChar) throw new Error("BLE not connected");
  const data=new TextEncoder().encode(`${line}\n`);
  for(let i=0;i<data.length;i+=18){
    const chunk=data.slice(i,i+18);
    if(cmdChar.writeValueWithoutResponse) await cmdChar.writeValueWithoutResponse(chunk);
    else await cmdChar.writeValue(chunk);
  }
}

/* ── AUTO POLL ──────────────────────────────────────────────── */
function startAutoPolling(){
  stopAutoPolling();
  pollTimer=setInterval(async()=>{
    if(!connected) return;
    try{ await writeLine("STATUS"); await writeLine("TEL"); await writeLine("BMS"); }
    catch(e){ log(`Poll error: ${e.message}`,"err"); }
  },POLL_MS);
}
function stopAutoPolling(){ if(pollTimer) clearInterval(pollTimer); pollTimer=null; }

/* ── CONNECTION STATE ───────────────────────────────────────── */
function setConnectedState(c){
  connected=c;
  connectBtn.textContent=c?"Disconnect BLE":"Connect BLE";
  const cb2=document.getElementById("connectBtn2");
  if(cb2) cb2.textContent=c?"Disconnect":"Connect BLE";
  if(statusDot){ statusDot.className="status-dot"+(c?" connected":""); }
  if(statusText) statusText.textContent=c?"Connected":"Disconnected";
  const cb=document.getElementById("connBadge");
  if(cb){ cb.textContent=c?"ONLINE":"OFFLINE"; cb.className="badge "+(c?"ok":"offline"); }
}

/* ── CONNECT / DISCONNECT ───────────────────────────────────── */
async function connectBle(){
  if(connected&&device?.gatt?.connected){ device.gatt.disconnect(); return; }
  if(!navigator.bluetooth){ alert("Web Bluetooth not available. Use Chrome/Edge on Android."); return; }
  connectBtn.disabled=true;
  try{
    bleLog_("Scanning for BLE devices...","info");
    device=await navigator.bluetooth.requestDevice({ acceptAllDevices:true, optionalServices:[SERVICE_UUID] });
    device.addEventListener("gattserverdisconnected",onDisconnected);
    server=await device.gatt.connect();
    const svc=await server.getPrimaryService(SERVICE_UUID);
    cmdChar=await svc.getCharacteristic(CMD_CHAR_UUID);
    txChar=await svc.getCharacteristic(TX_CHAR_UUID);
    await txChar.startNotifications();
    txChar.addEventListener("characteristicvaluechanged",onTxChanged);
    setConnectedState(true);
    bleLog_(`Connected to ${device.name||"BLE device"}`,"ok");
    await refreshNow();
    startAutoPolling();
    document.querySelector('.tab-btn[data-tab="dashboard"]')?.click();
  }catch(e){
    bleLog_(`Connect failed: ${e.message}`,"err");
    onDisconnected();
  }finally{ connectBtn.disabled=false; }
}

function onDisconnected(){
  bleLog_("BLE disconnected","warn");
  setConnectedState(false); stopAutoPolling();
  device=null; server=null; cmdChar=null; txChar=null;
}

/* ── RX ─────────────────────────────────────────────────────── */
function onTxChanged(event){
  const bytes=new Uint8Array(event.target.value.buffer,event.target.value.byteOffset,event.target.value.byteLength);
  rxBuffer+=new TextDecoder().decode(bytes);
  let idx=rxBuffer.indexOf("\n");
  while(idx>=0){ handleLine(rxBuffer.slice(0,idx)); rxBuffer=rxBuffer.slice(idx+1); idx=rxBuffer.indexOf("\n"); }
}

function handleLine(line){
  if(!line.trim()) return;
  let obj;
  try{ obj=JSON.parse(line); }catch{ log(`RX: ${line}`); return; }
  switch(obj.type){
    case "status":       return handleStatus(obj);
    case "telemetry_inv":return handleInvTel(obj);
    case "telemetry_bms":return handleBmsTel(obj);
    case "inv_resp":     return handleInvResp(obj);
    case "bms_resp":     return handleBmsResp(obj);
    case "error":  log(`ERR: ${obj.message}`,"err"); return;
    case "pong":   log("PONG","ok"); return;
    default: log(`RX: ${line}`);
  }
}

/* ── STATUS ─────────────────────────────────────────────────── */
function handleStatus(obj){
  invPolling=!!obj.polling; bmsPolling=!!obj.bms_polling;
  const bpb=document.getElementById("bmsPollBtn");
  if(bpb){ bpb.textContent=bmsPolling?"⏸ Auto-Poll ON":"▶ Auto-Poll OFF"; bpb.className="btn btn-"+(bmsPolling?"primary":"outline")+" btn-sm"; }
  const ps=document.getElementById("bmsPollStatus");
  if(ps) ps.textContent=bmsPolling?"Polling every 2s":"Polling stopped";
  const bb=document.getElementById("bmsBadge");
  if(bb){ bb.textContent=obj.bms_connected?"ONLINE":"OFFLINE"; bb.className="badge "+(obj.bms_connected?"ok":"offline"); }
}

/* ── INV TELEMETRY ──────────────────────────────────────────── */
function handleInvTel(o){
  lastInvData=o;
  showDash(true);

  /* flow nodes */
  setText("flow_pv_w",    o.pv_w,0);   setText("flow_pv_v",   o.pv_v,1);  setText("flow_pv_a",  o.pv_a,1);
  setText("flow_grid_v",  o.grid_v,1); setText("flow_grid_hz",o.grid_hz,1);
  setText("flow_mode",    o.mode_name);
  setText("flow_load",    o.load_pct,0);
  const bmsPack=lastBmsData?.pack_v;
  setText("flow_bat_v",   bmsPack!=null?bmsPack:o.bat_v,1);
  const bmsSoc=lastBmsData?.soc;
  setText("flow_bat_soc", bmsSoc!=null?bmsSoc:o.bat_soc,0);
  setText("flow_out_w",   o.out_w,0);

  /* metrics */
  setText("m_grid_v",o.grid_v,1);  setText("m_grid_hz",o.grid_hz,1);
  setText("m_out_v", o.out_v,1);   setText("m_out_hz", o.out_hz,1);
  setText("m_out_w", o.out_w,0);   setText("m_out_va", o.out_va,0);
  setText("m_load_pct",o.load_pct,0); setText("m_bus_v",o.bus_v,1);
  setText("m_bat_v", o.bat_v,1);   setText("m_bat_scc",o.bat_scc_v,1);
  setText("m_bat_soc",o.bat_soc,0);
  setText("m_chg_a", o.bat_chg_a,1); setText("m_dis_a",o.bat_dis_a,1);
  setText("m_inv_temp",o.inv_temp,1);
  setText("m_pv_v",o.pv_v,1); setText("m_pv_a",o.pv_a,1); setText("m_pv_w",o.pv_w,0);
  setText("m_ts",now());

  /* mode badge */
  const mc=String(o.mode_code||"S").toUpperCase();
  const mb=document.getElementById("modeBadge");
  if(mb) mb.className=`mode-badge mode-${mc}`;
  const icons={P:"☀️",S:"🔋",L:"🔌",B:"⚡",F:"⚠️",H:"🌙",D:"❌"};
  setEl("modeIcon",icons[mc]||"⚙️");
  setText("modeText",o.mode_name);
  setEl("flowBadge",`<span style="font-size:10px;">${o.mode_name||"LIVE"}</span>`);

  /* flags */
  const flagsEl=document.getElementById("statusFlags");
  if(flagsEl&&o.flags){
    const f=o.flags;
    flagsEl.innerHTML=[
      chip("Load",f.load_on),chip("Charging",f.charging),chip("SCC Chg",f.scc_charging),
      chip("AC Chg",f.ac_charging),chip("Bat Steady",f.battery_steady),chip("SBU Prio",f.sbu_priority)
    ].join("");
  }

  /* warnings */
  const wl=document.getElementById("warningList"), wc=document.getElementById("warningCount");
  if(wl){
    const ws=Array.isArray(o.warnings)?o.warnings:[];
    if(wc){ wc.textContent=ws.length; wc.className="badge "+(ws.length?"warn":"ok"); }
    wl.innerHTML=ws.length
      ?ws.map(w=>`<div class="warning-item">⚠ ${escapeHtml(w)}</div>`).join("")
      :`<div class="warning-item ok">✓ No active warnings</div>`;
  }

  updateFlowLines(o);
  if(activeFlowNode) renderFlowDetails();
}

/* ── BMS TELEMETRY ──────────────────────────────────────────── */
function handleBmsTel(o){
  lastBmsData=o;
  showBms(true);

  setText("b_pack_v",    o.pack_v,2); setText("b_current",   o.current,2);
  setText("b_soc",       o.soc,0);    setText("b_soh",       o.soh,0);
  setText("b_cap_left",  o.cap_left,1); setText("b_energy_left",o.energy_left,2);
  setText("b_cycles",    o.cycles);
  setText("b_min_cv",    o.min_cell_v,3); setText("b_max_cv",o.max_cell_v,3);
  setText("b_min_t",     o.min_temp,1);   setText("b_max_t", o.max_temp,1);
  setText("b_mos_t",     o.mos_temp,1);   setText("b_amb_t", o.amb_temp,1);
  setText("b_cell_count",o.cell_count);

  if(o.min_cell_v!=null&&o.max_cell_v!=null)
    setText("b_delta",((o.max_cell_v-o.min_cell_v)*1000).toFixed(0));

  if(o.flags){
    const f=o.flags;
    const parts=[];
    if(f.ca_on) parts.push("Charging"); if(f.load) parts.push("Load");
    if(f.balancing) parts.push("Balancing");
    setEl("b_state",parts.length?parts.join(" | "):"Idle");
    const bfl=document.getElementById("bmsFlags");
    if(bfl) bfl.innerHTML=[
      chip("CA",f.ca_on),chip("Load",f.load),chip("Bal",f.balancing),chip("MOSFET",!f.mosfet_fail)
    ].join("");
    const bd=document.getElementById("bmsDot");
    if(bd) bd.className="status-dot connected";
    setText("bmsStatusText","Receiving BMS Frames");
  }

  const ts=document.getElementById("bmsTimestamp");
  if(ts) ts.textContent=now();
  const fc=document.getElementById("bmsFrameCount");
  if(fc) fc.textContent=String(parseInt(fc.textContent||"0")+1);

  /* cell voltages */
  const bCells=document.getElementById("bCells");
  if(bCells&&Array.isArray(o.cell_v)&&o.cell_v.length){
    const mn=Math.min(...o.cell_v),mx=Math.max(...o.cell_v),rng=mx-mn||0.001;
    bCells.innerHTML=o.cell_v.map((v,i)=>{
      const pct=((v-mn)/rng*100).toFixed(0),warn=v<3.0||v>3.65;
      return `<div class="bms-cell"><span class="cnum">C${i+1}</span><span class="cval">${v.toFixed(3)} V</span><div class="cbar"><div class="cbar-fill ${warn?"warn":""}" style="width:${pct}%"></div></div></div>`;
    }).join("");
  }

  /* cell temps */
  const bTemps=document.getElementById("bTemps");
  if(bTemps&&Array.isArray(o.cell_t)&&o.cell_t.length){
    const mn=Math.min(...o.cell_t),mx=Math.max(...o.cell_t),rng=mx-mn||1;
    bTemps.innerHTML=o.cell_t.map((t,i)=>{
      const pct=((t-mn)/rng*100).toFixed(0),hot=t>45;
      return `<div class="bms-cell"><span class="cnum">T${i+1}</span><span class="cval">${t.toFixed(1)} °C</span><div class="cbar"><div class="cbar-fill ${hot?"hot":""}" style="width:${Math.max(pct,5)}%"></div></div></div>`;
    }).join("");
  }

  /* bms frame log */
  addBmsLog(`Pack:${fmt(o.pack_v,2)}V SOC:${fmt(o.soc,0)}% Cur:${fmt(o.current,2)}A`);

  /* update flow battery node with BMS data */
  if(lastInvData) handleInvTel(lastInvData);
}

/* ── INV RESPONSE ───────────────────────────────────────────── */
function handleInvResp(obj){
  const text=obj.success?obj.raw:`ERROR ${obj.raw}`;
  log(`INV ${obj.cmd} => ${text}`,obj.success?"ok":"err");

  /* clear placeholder */
  if(invCmdResp.querySelector('[style*="color:var(--text-muted)"]')) invCmdResp.innerHTML="";

  let html=`<div class="console-line"><span class="console-dir tx">TX</span><span class="console-data" style="color:var(--accent-cyan);">${escapeHtml(obj.cmd)}</span></div>`;
  html+=`<div class="console-line"><span class="console-dir rx">RX</span><span class="console-data">${escapeHtml(obj.raw||"")}</span></div>`;
  invCmdResp.innerHTML=html;
  invCmdResp.scrollTop=invCmdResp.scrollHeight;

  addCmdHistory(obj.cmd,obj.raw||"",obj.success);
}

/* ── BMS RESPONSE ───────────────────────────────────────────── */
function handleBmsResp(obj){
  const text=obj.success?obj.resp_hex:`ERROR ${obj.error||"failed"}`;
  log(`BMS ${obj.mode} => ${text}`,obj.success?"ok":"err");
  appendConsole(bmsCmdResponse,`[${obj.mode}] ${text}`,obj.success?"ok":"err");

  /* bms frame log */
  if(obj.success&&obj.resp_hex) addBmsLog(obj.resp_hex);
}

/* ── FLOW LINES ─────────────────────────────────────────────── */
function updateFlowLines(o){
  const pvLine  =document.getElementById("flowLinePv");
  const gridLine=document.getElementById("flowLineGrid");
  const batLine =document.getElementById("flowLineBat");
  const homeLine=document.getElementById("flowLineHome");
  const pvOn=(o.pv_w||0)>5;
  const gridOn=(o.grid_v||0)>50;
  const charging=o.flags?.charging||o.flags?.scc_charging||o.flags?.ac_charging;
  const outOn=(o.out_w||0)>5;
  if(pvLine)   pvLine.className  =`flow-line green${pvOn?" active":""}`;
  if(gridLine) gridLine.className=`flow-line blue${gridOn?" active":""}`;
  if(batLine)  batLine.className =`flow-line${charging?" green active":o.bat_dis_a>0?" amber active":""}`;
  if(homeLine) homeLine.className=`flow-line${outOn?" active":""}`;
}

/* ── FLOW DETAIL PANEL ──────────────────────────────────────── */
function selectFlowNode(node){
  activeFlowNode=node;
  document.querySelectorAll(".flow-node").forEach(el=>el.classList.toggle("active",el.dataset.node===node));
  renderFlowDetails();
}

function renderFlowDetails(){
  const titleEl=document.getElementById("flowDetailsTitle");
  const gridEl =document.getElementById("flowDetailsGrid");
  if(!titleEl||!gridEl) return;
  const q=lastInvData, b=lastBmsData;
  if(!q){ gridEl.innerHTML=`<div class="detail-item"><div class="dl">No data</div><div class="dv">Connect BLE</div></div>`; return; }
  const add=(l,v)=>`<div class="detail-item"><div class="dl">${l}</div><div class="dv">${v}</div></div>`;
  let title="Inverter", items=[];
  if(activeFlowNode==="pv"){
    title="Solar Array";
    items=[add("PV Voltage",fmt(q.pv_v,1)+" V"),add("PV Current",fmt(q.pv_a,1)+" A"),add("PV Power",fmt(q.pv_w,0)+" W")];
  } else if(activeFlowNode==="grid"){
    title="Grid";
    items=[add("Grid Voltage",fmt(q.grid_v,1)+" V"),add("Grid Freq",fmt(q.grid_hz,1)+" Hz"),add("Mode",q.mode_name||PLACEHOLDER)];
  } else if(activeFlowNode==="battery"){
    title="Battery";
    items=[add("Inverter V",fmt(q.bat_v,1)+" V"),add("Charge",fmt(q.bat_chg_a,1)+" A"),add("Discharge",fmt(q.bat_dis_a,1)+" A"),add("Inv SOC",fmt(q.bat_soc,0)+"%"),add("SCC V",fmt(q.bat_scc_v,1)+" V")];
    if(b) items.push(add("BMS Pack",fmt(b.pack_v,2)+" V"),add("BMS SOC",fmt(b.soc,0)+"%"),add("BMS SOH",fmt(b.soh,0)+"%"));
  } else if(activeFlowNode==="home"){
    title="Home Load";
    items=[add("Output W",fmt(q.out_w,0)+" W"),add("Apparent",fmt(q.out_va,0)+" VA"),add("Load",fmt(q.load_pct,0)+"%"),add("Out V",fmt(q.out_v,1)+" V"),add("Out Hz",fmt(q.out_hz,1)+" Hz")];
  } else {
    title="Inverter";
    items=[add("Mode",q.mode_name||PLACEHOLDER),add("Bus V",fmt(q.bus_v,1)+" V"),add("Bat V",fmt(q.bat_v,1)+" V"),add("Temp",fmt(q.inv_temp,1)+" °C")];
  }
  titleEl.textContent=title;
  gridEl.innerHTML=items.join("");
}

/* ── SHOW / HIDE ────────────────────────────────────────────── */
function showDash(v){
  const o=document.getElementById("dashNoData"),d=document.getElementById("dashData");
  if(o) o.style.display=v?"none":""; if(d) d.style.display=v?"":"none";
}
function showBms(v){
  const o=document.getElementById("bmsNoData"),d=document.getElementById("bmsData");
  if(o) o.style.display=v?"none":""; if(d) d.style.display=v?"":"none";
}

/* ── CONSOLE HELPER ─────────────────────────────────────────── */
function appendConsole(el,text,cls=""){
  if(!el) return;
  const d=document.createElement("div");
  d.className=`console-line line ${cls}`.trim();
  d.innerHTML=`<span class="console-ts">${now()}</span><span class="console-dir ${cls}">${cls.toUpperCase()||"RX"}</span><span class="console-data">${escapeHtml(text)}</span>`;
  el.appendChild(d); el.scrollTop=el.scrollHeight;
}

function addBmsLog(text){
  bmsLogLines.push({ts:now(),text});
  if(bmsLogLines.length>300) bmsLogLines.shift();
  const el=document.getElementById("bmsLog"); if(!el) return;
  const d=document.createElement("div"); d.className="console-line";
  d.innerHTML=`<span class="console-ts">${now()}</span><span class="console-dir rx">RX</span><span class="console-data">${escapeHtml(text)}</span>`;
  el.appendChild(d); el.scrollTop=el.scrollHeight;
}
function clearBmsLog(){ bmsLogLines=[]; const e=document.getElementById("bmsLog"); if(e) e.innerHTML=""; }

function addCmdHistory(cmd,resp,ok){
  cmdHistory.unshift({cmd,resp,ok,ts:now()});
  if(cmdHistory.length>50) cmdHistory.pop();
  const el=document.getElementById("cmdHistory"); if(!el) return;
  const d=document.createElement("div"); d.className="console-line";
  d.innerHTML=`<span class="console-ts">${now()}</span><span class="console-dir tx">TX</span><span class="console-data" style="color:var(--accent-cyan);">${escapeHtml(cmd)}</span><span style="margin:0 6px;color:var(--text-muted);">→</span><span class="console-data ${ok?"ok":"err"}">${ok?"✓":"✗"} ${escapeHtml(String(resp).substring(0,80))}</span>`;
  el.prepend(d);
}

function chip(l,a){ return `<span class="status-chip ${a?"active":""}">${a?"●":"○"} ${l}</span>`; }

/* ── REFRESH ────────────────────────────────────────────────── */
async function refreshNow(){
  try{ await writeLine("PING"); await writeLine("STATUS"); await writeLine("TEL"); await writeLine("BMS"); }
  catch(e){ log(`Refresh failed: ${e.message}`,"err"); }
}

/* ── INV COMMANDS ───────────────────────────────────────────── */
async function sendInvCmd(cmd){
  if(!cmd) return;
  try{ log(`TX: INV ${cmd}`); await writeLine(`INV ${cmd}`); }
  catch(e){ log(`Send failed: ${e.message}`,"err"); }
}
async function sendInvCustom(){
  const cmd=(document.getElementById("invCmdInput")?.value||"").trim();
  if(!cmd) return;
  await sendInvCmd(cmd);
}

/* ── BMS COMMANDS ───────────────────────────────────────────── */
async function sendBmsAsciiCmd(){
  const cmd=(document.getElementById("bmsAsciiInput")?.value||"#H0").trim();
  if(!cmd) return;
  try{ log(`TX: BMSASCII ${cmd}`); await writeLine(`BMSASCII ${cmd}`); }
  catch(e){ log(`BMS ASCII failed: ${e.message}`,"err"); appendConsole(bmsCmdResponse,`Error: ${e.message}`,"err"); }
}
async function sendBmsHexCmd(){
  const cmd=(document.getElementById("bmsHexInput")?.value||"").trim();
  if(!cmd) return;
  try{ log(`TX: BMSHEX ${cmd}`); await writeLine(`BMSHEX ${cmd}`); }
  catch(e){ log(`BMS HEX failed: ${e.message}`,"err"); appendConsole(bmsCmdResponse,`Error: ${e.message}`,"err"); }
}
async function manualBmsQuery(){
  const btn=document.getElementById("bmsManualBtn");
  if(btn){ btn.disabled=true; btn.textContent="Querying..."; }
  try{ await writeLine("BMSASCII #H0"); }
  catch(e){ log(`BMS query failed: ${e.message}`,"err"); }
  finally{ if(btn){ btn.disabled=false; btn.textContent="Query Now (#H0)"; } }
}

/* ── BMS PRESET COMMANDS ────────────────────────────────────── */
function initBmsCommands(){
  const sel=document.getElementById("bmsCmdSelect"); if(!sel) return;
  sel.innerHTML=`<option value="">— Select preset —</option>`;
  BMS_CMDS.forEach((cmd,idx)=>{
    const o=document.createElement("option"); o.value=idx; o.textContent=cmd.label; sel.appendChild(o);
  });
}
function onBmsCmdSelect(){
  const sel=document.getElementById("bmsCmdSelect");
  const desc=document.getElementById("bmsCmdDesc");
  const valEl=document.getElementById("bmsCmdValue");
  const hexEl=document.getElementById("bmsCmdHex");
  const idx=parseInt(sel.value,10);
  if(Number.isNaN(idx)){ if(desc) desc.textContent=""; if(valEl){ valEl.value=""; valEl.disabled=false; } if(hexEl) hexEl.value=""; return; }
  const cmd=BMS_CMDS[idx];
  if(desc) desc.textContent=cmd.desc||"";
  if(valEl){
    if(cmd.fixed!==undefined){ valEl.value="0x"+cmd.fixed.toString(16).padStart(4,"0").toUpperCase(); valEl.disabled=true; }
    else{ valEl.value=""; valEl.disabled=false; }
  }
  buildBmsHex();
}
function parseBmsVal(s){
  s=(s||"").trim(); if(!s) return null;
  const v=parseInt(s.startsWith("0x")||/[a-f]/i.test(s)?s:parseInt(s,10),s.startsWith("0x")?16:10);
  return Number.isNaN(v)?null:v&0xFFFF;
}
function buildBmsHex(){
  const sel=document.getElementById("bmsCmdSelect");
  const hexEl=document.getElementById("bmsCmdHex");
  const valEl=document.getElementById("bmsCmdValue");
  if(!sel||!hexEl) return;
  const idx=parseInt(sel.value,10); if(Number.isNaN(idx)){ hexEl.value=""; return; }
  const cmd=BMS_CMDS[idx];
  const value=cmd.fixed!==undefined?cmd.fixed:parseBmsVal(valEl?.value);
  if(value==null){ hexEl.value=""; return; }
  const bytes=[...cmd.base,(value>>8)&0xFF,value&0xFF];
  hexEl.value=bytes.map(b=>b.toString(16).padStart(2,"0").toUpperCase()).join(" ");
}
async function sendBmsPreset(){
  const hexEl=document.getElementById("bmsCmdHex");
  const hex=(hexEl?.value||"").trim();
  if(!hex){ alert("Select a preset command first."); return; }
  try{ log(`TX: BMSHEX ${hex}`); await writeLine(`BMSHEX ${hex}`); }
  catch(e){ log(`BMS preset failed: ${e.message}`,"err"); appendConsole(bmsCmdResponse,`Error: ${e.message}`,"err"); }
}

/* ── POLL TOGGLES ───────────────────────────────────────────── */
async function toggleInvPoll(){
  invPolling=!invPolling;
  try{ await writeLine(`SET POLL ${invPolling?1:0}`); }
  catch(e){ log(e.message,"err"); }
}
async function toggleBmsPoll(){
  bmsPolling=!bmsPolling;
  try{
    await writeLine(`SET BMSPOLL ${bmsPolling?1:0}`);
    const btn=document.getElementById("bmsPollBtn");
    if(btn){ btn.textContent=bmsPolling?"⏸ Auto-Poll ON":"▶ Auto-Poll OFF"; btn.className="btn btn-"+(bmsPolling?"primary":"outline")+" btn-sm"; }
    const ps=document.getElementById("bmsPollStatus");
    if(ps) ps.textContent=bmsPolling?"Polling every 2s":"Polling stopped";
  }catch(e){ log(e.message,"err"); }
}

/* ── INV QUICK SETTINGS (Commands tab) ──────────────────────── */
function buildInvQuickSettings(){
  const el=document.getElementById("invQuickSettings"); if(!el) return;
  let h="";
  INV_QUICK.forEach((s,i)=>{
    let ctrl="";
    if(s.opts){
      const opts=s.opts.map(o=>{const p=o.split(":");return `<option value="${p[0]}">${p[0]} — ${p.slice(1).join(":")}</option>`;}).join("");
      ctrl=`<select id="iqp_${i}" style="min-width:140px;">${opts}</select><button class="btn btn-primary btn-sm" style="margin-left:6px;" onclick="sendInvQuick('${s.cmd}',document.getElementById('iqp_${i}').value)">Set</button>`;
    } else if(s.input){
      ctrl=`<input type="text" id="iqp_${i}" placeholder="${s.ph||s.input}" style="width:90px;"><button class="btn btn-primary btn-sm" style="margin-left:6px;" onclick="sendInvQuick('${s.cmd}',document.getElementById('iqp_${i}').value)">Set</button>`;
    } else if(s.danger){
      ctrl=`<button class="btn btn-danger btn-sm" onclick="if(!confirm('Factory reset ALL parameters?'))return;sendInvQuick('${s.cmd}','')">RESET</button>`;
    } else {
      ctrl=`<button class="btn btn-primary btn-sm" onclick="sendInvQuick('${s.cmd}','')">Execute</button>`;
    }
    h+=`<div class="setting-row" style="flex-direction:column;align-items:stretch;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;"><div class="setting-info"><div class="setting-cmd">${escapeHtml(s.cmd)}</div><div class="setting-desc">${escapeHtml(s.desc)}</div></div><div class="setting-controls">${ctrl}</div></div><div id="iqr_${i}" style="display:none;margin-top:8px;padding:8px;background:#050a14;border-radius:var(--radius-sm);border:1px solid var(--border);font-family:var(--mono);font-size:11px;"></div></div>`;
  });
  el.innerHTML=h;
}
async function sendInvQuick(cmd,param){
  const full=cmd+param;
  const idx=INV_QUICK.findIndex(s=>s.cmd===cmd);
  try{
    log(`TX: INV ${full}`); await writeLine(`INV ${full}`);
    if(idx>=0){ const e=document.getElementById(`iqr_${idx}`); if(e){ e.style.display="block"; e.innerHTML=`<span style="color:var(--accent-cyan);">Sent: ${escapeHtml(full)}</span> — awaiting response...`; } }
  }catch(e){ log(`Send failed: ${e.message}`,"err"); }
}

/* ── SETTINGS TAB ───────────────────────────────────────────── */
function buildSettingsTab(){
  const nav=document.getElementById("settingsNav");
  const content=document.getElementById("settingsContent");
  if(!nav||!content) return;
  nav.innerHTML=""; content.innerHTML="";

  Object.entries(SETTINGS_GROUPS).forEach(([grp,cmds],gi)=>{
    const btn=document.createElement("button");
    btn.className="settings-nav-btn"+(gi===0?" active":"");
    btn.textContent=grp;
    btn.onclick=()=>{
      document.querySelectorAll(".settings-nav-btn").forEach(b=>b.classList.remove("active"));
      document.querySelectorAll(".setting-group").forEach(g=>g.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`sg-${gi}`)?.classList.add("active");
    };
    nav.appendChild(btn);

    const div=document.createElement("div");
    div.className="setting-group"+(gi===0?" active":"");
    div.id=`sg-${gi}`;

    cmds.forEach(cmdKey=>{
      const s=INV_QUICK.find(x=>x.cmd===cmdKey); if(!s) return;
      let ctrl="";
      if(s.opts){
        const opts=s.opts.map(o=>{const p=o.split(":");return `<option value="${p[0]}">${p[0]} — ${p.slice(1).join(":")}</option>`;}).join("");
        ctrl=`<select id="sp_${s.cmd}" style="min-width:140px;">${opts}</select><button class="btn btn-primary btn-sm" style="margin-left:6px;" onclick="sendSettingCmd('${s.cmd}',document.getElementById('sp_${s.cmd}').value)">Set</button>`;
      } else if(s.input){
        ctrl=`<input type="text" id="sp_${s.cmd}" placeholder="${s.ph||s.input}" style="width:90px;"><button class="btn btn-primary btn-sm" style="margin-left:6px;" onclick="sendSettingCmd('${s.cmd}',document.getElementById('sp_${s.cmd}').value)">Set</button>`;
      } else if(s.danger){
        ctrl=`<button class="btn btn-danger btn-sm" onclick="if(!confirm('Factory reset ALL parameters?'))return;sendSettingCmd('${s.cmd}','')">RESET</button>`;
      } else {
        ctrl=`<button class="btn btn-primary btn-sm" onclick="sendSettingCmd('${s.cmd}','')">Execute</button>`;
      }
      div.innerHTML+=`<div class="setting-row" style="flex-direction:column;align-items:stretch;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;"><div class="setting-info"><div class="setting-cmd">${escapeHtml(s.cmd)}</div><div class="setting-desc">${escapeHtml(s.desc)}</div></div><div class="setting-controls">${ctrl}</div></div><div id="sr_${s.cmd}" style="display:none;margin-top:8px;padding:8px;background:#050a14;border-radius:var(--radius-sm);border:1px solid var(--border);font-family:var(--mono);font-size:11px;"></div></div>`;
    });
    content.appendChild(div);
  });
}
async function sendSettingCmd(cmd,param){
  if(cmd==="PF"&&!confirm("Factory reset ALL parameters?")) return;
  const full=cmd+param;
  try{
    log(`TX: INV ${full}`); await writeLine(`INV ${full}`);
    const e=document.getElementById(`sr_${cmd}`);
    if(e){ e.style.display="block"; e.innerHTML=`<span style="color:var(--accent-cyan);">Sent: ${escapeHtml(full)}</span> — awaiting response...`; }
  }catch(e){ log(`Send failed: ${e.message}`,"err"); }
}

/* ── PWA INSTALL ────────────────────────────────────────────── */
function setupPwa(){
  window.addEventListener("beforeinstallprompt",e=>{
    e.preventDefault(); deferredInstallPrompt=e;
    if(installBtn) installBtn.hidden=false;
  });
  if(installBtn){
    installBtn.addEventListener("click",async()=>{
      if(!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt=null; installBtn.hidden=true;
    });
  }
  if("serviceWorker" in navigator)
    navigator.serviceWorker.register("./sw.js").catch(e=>log(`SW: ${e.message}`,"warn"));
}

/* ── WIRE UP BUTTONS ────────────────────────────────────────── */
connectBtn?.addEventListener("click",connectBle);
document.getElementById("connectBtn2")?.addEventListener("click",connectBle);
document.getElementById("softapBtn")?.addEventListener("click",()=>window.open(SOFTAP_URL,"_blank"));
document.getElementById("refreshBtn")?.addEventListener("click",()=>refreshNow());

document.querySelectorAll(".flow-node").forEach(n=>{
  n.addEventListener("click",()=>selectFlowNode(n.dataset.node));
});

/* ── INIT ───────────────────────────────────────────────────── */
setConnectedState(false);
showDash(false);
showBms(false);
initBmsCommands();
buildInvQuickSettings();
buildSettingsTab();
selectFlowNode("inverter");
setupPwa();
log("Open this page on HTTPS (GitHub Pages) and click Connect BLE.","info");
log("No internet? Connect to ESP Wi-Fi then open http://192.168.4.1","info");
