/* INVISOL BLE Web App — full feature parity with SoftAP page */
'use strict';

/* ── BLE CONFIG ──────────────────────────────────────────── */
const SVC_UUID = 0xFFF0, CMD_UUID = 0xFFF1, TX_UUID = 0xFFF2;
const POLL_MS  = 1500;
const PH       = '&#8212;';

/* ── COMMAND DATABASE (replaces commands.csv) ──────────────── */
const COMMANDS = [
  {command:'QPIGS', description:'General Status Parameters',          type:'inquiry',  group:'Status',               has_params:false},
  {command:'QMOD',  description:'Device Mode Inquiry',               type:'inquiry',  group:'Status',               has_params:false},
  {command:'QPIWS', description:'Warning Status Inquiry',            type:'inquiry',  group:'Status',               has_params:false},
  {command:'QPIRI', description:'Device Rating Information',         type:'inquiry',  group:'Rating Information',   has_params:false},
  {command:'QDI',   description:'Default Setting Values',            type:'inquiry',  group:'Others',               has_params:false},
  {command:'QFLAG', description:'Device Flag Status',               type:'inquiry',  group:'Others',               has_params:false},
  {command:'QID',   description:'Device Serial Number',             type:'inquiry',  group:'Product Information',  has_params:false},
  {command:'QVFW',  description:'Firmware Version',                 type:'inquiry',  group:'Product Information',  has_params:false},
  {command:'QOPM',  description:'Output Mode Inquiry',              type:'inquiry',  group:'Output',               has_params:false},
  {command:'QMCHGCR', description:'Max Charging Current Options',   type:'inquiry',  group:'Battery',              has_params:false},
  {command:'QMUCHGCR',description:'Max Utility Charging Current Options', type:'inquiry', group:'Battery',         has_params:false},
  {command:'POP',   description:'Set Output Source Priority',       type:'setting',  group:'Output',               has_params:true,  param_description:'Priority',    param_options:'00:Utility First|01:Solar First|02:SBU Priority'},
  {command:'PCP',   description:'Set Charger Source Priority',      type:'setting',  group:'Battery',              has_params:true,  param_description:'Priority',    param_options:'00:Utility First|01:Solar First|02:Solar+Utility|03:Only Solar'},
  {command:'PGR',   description:'Set Grid Working Range',           type:'setting',  group:'Grid',                 has_params:true,  param_description:'Range',       param_options:'00:Appliance|01:UPS'},
  {command:'PBT',   description:'Set Battery Type',                 type:'setting',  group:'Battery',              has_params:true,  param_description:'Type',        param_options:'00:AGM|01:Flooded|02:User|08:LiFePO4'},
  {command:'PBCV',  description:'Set Battery Re-Charge Voltage',    type:'setting',  group:'Battery',              has_params:true,  param_description:'Voltage (V)', param_format:'nn.n'},
  {command:'PBDV',  description:'Set Battery Re-Discharge Voltage', type:'setting',  group:'Battery',              has_params:true,  param_description:'Voltage (V)', param_format:'nn.n'},
  {command:'PSDV',  description:'Set Battery Cut-Off Voltage',      type:'setting',  group:'Battery',              has_params:true,  param_description:'Voltage (V)', param_format:'nn.n'},
  {command:'PCVV',  description:'Set Battery C.V. Charge Voltage',  type:'setting',  group:'Battery',              has_params:true,  param_description:'Voltage (V)', param_format:'nn.n'},
  {command:'PBFT',  description:'Set Battery Float Charge Voltage', type:'setting',  group:'Battery',              has_params:true,  param_description:'Voltage (V)', param_format:'nn.n'},
  {command:'MCHGC', description:'Set Max Charging Current',         type:'setting',  group:'Battery',              has_params:true,  param_description:'Current (A)', param_format:'nnn'},
  {command:'MUCHGC',description:'Set Utility Max Charging Current', type:'setting',  group:'Battery',              has_params:true,  param_description:'Current (A)', param_format:'nnn'},
  {command:'F',     description:'Set Output Frequency',             type:'setting',  group:'Output',               has_params:true,  param_description:'Frequency',   param_options:'50:50 Hz|60:60 Hz'},
  {command:'POPM',  description:'Set Output Mode',                  type:'setting',  group:'Output',               has_params:true,  param_description:'Mode',        param_options:'00:Single|01:Parallel|02:Phase1/3|03:Phase2/3|04:Phase3/3'},
  {command:'PEA',   description:'Enable Buzzer',                    type:'setting',  group:'Buzzer',               has_params:false},
  {command:'PDA',   description:'Disable Buzzer',                   type:'setting',  group:'Buzzer',               has_params:false},
  {command:'PEB',   description:'Enable Overload Bypass',           type:'setting',  group:'Others',               has_params:false},
  {command:'PDB',   description:'Disable Overload Bypass',          type:'setting',  group:'Others',               has_params:false},
  {command:'PEJ',   description:'Enable Power Saving',              type:'setting',  group:'Others',               has_params:false},
  {command:'PDJ',   description:'Disable Power Saving',             type:'setting',  group:'Others',               has_params:false},
  {command:'PEU',   description:'Enable Overload Restart',          type:'setting',  group:'Others',               has_params:false},
  {command:'PDU',   description:'Disable Overload Restart',         type:'setting',  group:'Others',               has_params:false},
  {command:'PEV',   description:'Enable Over-Temp Restart',         type:'setting',  group:'Others',               has_params:false},
  {command:'PDV',   description:'Disable Over-Temp Restart',        type:'setting',  group:'Others',               has_params:false},
  {command:'PEY',   description:'Enable Alarm on Primary Interrupt',type:'setting',  group:'Others',               has_params:false},
  {command:'PDY',   description:'Disable Alarm on Primary Interrupt',type:'setting', group:'Others',               has_params:false},
  {command:'PF',    description:'Factory Reset All Parameters',     type:'setting',  group:'Factory Reset',        has_params:false},
];

const INV_QUICK_SETTINGS = [
  {cmd:'POP',   desc:'Output Source Priority',    opts:['00:Utility First','01:Solar First','02:SBU Priority']},
  {cmd:'PCP',   desc:'Charger Source Priority',   opts:['00:Utility First','01:Solar First','02:Solar+Utility','03:Only Solar']},
  {cmd:'PGR',   desc:'Grid Working Range',         opts:['00:Appliance','01:UPS']},
  {cmd:'PBT',   desc:'Battery Type',               opts:['00:AGM','01:Flooded','02:User','08:LiFePO4']},
  {cmd:'PBCV',  desc:'Battery Re-charge Voltage',  input:'nn.n', ph:'e.g. 48.0'},
  {cmd:'PBDV',  desc:'Battery Re-discharge Voltage',input:'nn.n',ph:'e.g. 48.0'},
  {cmd:'PSDV',  desc:'Battery Cut-off Voltage',    input:'nn.n', ph:'e.g. 42.0'},
  {cmd:'PCVV',  desc:'Battery C.V. Charging Voltage',input:'nn.n',ph:'e.g. 56.4'},
  {cmd:'PBFT',  desc:'Battery Float Voltage',      input:'nn.n', ph:'e.g. 54.0'},
  {cmd:'MCHGC', desc:'Max Charging Current',       input:'nnn',  ph:'e.g. 060'},
  {cmd:'MUCHGC',desc:'Utility Max Charging Current',input:'nnn', ph:'e.g. 030'},
  {cmd:'F',     desc:'Output Frequency',           opts:['50:50 Hz','60:60 Hz']},
  {cmd:'POPM',  desc:'Output Mode',                opts:['00:Single','01:Parallel','02:Phase1/3','03:Phase2/3','04:Phase3/3']},
  {cmd:'PEA',   desc:'Enable Buzzer'},
  {cmd:'PDA',   desc:'Disable Buzzer'},
  {cmd:'PEB',   desc:'Enable Overload Bypass'},
  {cmd:'PDB',   desc:'Disable Overload Bypass'},
  {cmd:'PEJ',   desc:'Enable Power Saving'},
  {cmd:'PDJ',   desc:'Disable Power Saving'},
  {cmd:'PEU',   desc:'Enable Overload Restart'},
  {cmd:'PDU',   desc:'Disable Overload Restart'},
  {cmd:'PEV',   desc:'Enable Over-Temp Restart'},
  {cmd:'PDV',   desc:'Disable Over-Temp Restart'},
  {cmd:'PEY',   desc:'Enable Alarm on Primary Interrupt'},
  {cmd:'PDY',   desc:'Disable Alarm on Primary Interrupt'},
  {cmd:'PF',    desc:'FACTORY RESET ALL PARAMETERS', danger:true},
];

const BMS_COMMANDS = [
  {label:'Get Thresholds',          base:[0x02,0x06,0x9B,0x7C], fixed:0x0001, desc:'Read all parameters at once'},
  {label:'Cell Count',              base:[0x02,0x06,0x9B,0xC5],               desc:'3-24 cells'},
  {label:'Factory Capacity',        base:[0x02,0x06,0x9B,0xC7],               desc:'5-250 Ah'},
  {label:'Balance Trigger Voltage', base:[0x02,0x06,0x9B,0xBF],               desc:'Balance start voltage'},
  {label:'Cell OVP',                base:[0x02,0x06,0x9B,0xAF],               desc:'Cell over-voltage protection'},
  {label:'Cell OVPR',               base:[0x02,0x06,0x9B,0xF2],               desc:'Cell OVP recovery voltage'},
  {label:'Charge Over Current',     base:[0x02,0x06,0x9B,0xB3],               desc:'Charge over-current limit'},
  {label:'Charge OTP',              base:[0x02,0x06,0x9B,0xC1],               desc:'Charge over-temperature protection'},
  {label:'Charge OTPR',             base:[0x02,0x06,0x9B,0xA2],               desc:'Charge OTP recovery temperature'},
  {label:'Cell UVP',                base:[0x02,0x06,0x9B,0xAD],               desc:'Cell under-voltage protection'},
  {label:'Cell UVPR',               base:[0x02,0x06,0x9B,0xF4],               desc:'Cell UVP recovery voltage'},
  {label:'Discharge Over Current',  base:[0x02,0x06,0x9B,0xD6],               desc:'Discharge over-current limit'},
  {label:'Discharge OTP',           base:[0x02,0x06,0x9B,0xB9],               desc:'Discharge over-temperature protection'},
  {label:'Discharge OTPR',          base:[0x02,0x06,0x9B,0xE3],               desc:'Discharge OTP recovery temperature'},
  {label:'Sleep Hour',              base:[0x02,0x06,0x9B,0x3E],               desc:'Sleep hour (0-23)'},
  {label:'Sleep Minute',            base:[0x02,0x06,0x9B,0x3D],               desc:'Sleep minute (0-59)'},
  {label:'Sleep Enable',            base:[0x02,0x06,0x9B,0x4C], fixed:0x0001, desc:'Enable sleep mode'},
  {label:'Sleep Disable',           base:[0x02,0x06,0x9B,0x4C], fixed:0x0000, desc:'Disable sleep mode'},
];

/* ── STATE ───────────────────────────────────────────────── */
let bleDevice=null, bleServer=null, cmdChar=null, txChar=null;
let connected=false, invPolling=true, bmsPolling=true;
let rxBuffer='', pollTimer=null, deferredInstall=null;
let commandHistory=[], rawLogLines=[], bmsLogLines=[];
let lastTelemetry=null, lastBmsTelemetry=null;
let activeFlowNode='inverter';

/* ── DOM ─────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ── UTILITIES ───────────────────────────────────────────── */
function tsNow(){ return new Date().toLocaleTimeString('en-US',{hour12:false}); }

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function fmtNum(v,dec){ if(v==null||v===''||isNaN(+v))return'&#8212;'; return dec==null?String(v):(+v).toFixed(dec); }

function setM(id,v,dec){
  const el=$(id); if(!el)return;
  el.innerHTML=fmtNum(v,dec);
  el.classList.remove('value-update'); void el.offsetWidth; el.classList.add('value-update');
}

function chip(label,active){
  return `<span class="status-chip ${active?'active':''}">${active?'&#9679;':'&#9675;'} ${label}</span>`;
}

/* ── CLOCK ───────────────────────────────────────────────── */
setInterval(()=>{ const e=$('clock'); if(e) e.textContent=tsNow(); },1000);

/* ── TABS ────────────────────────────────────────────────── */
function initTabs(){
  const btns=Array.from(document.querySelectorAll('.tab-btn'));
  const show=name=>{
    btns.forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.toggle('active',c.id==='tab-'+name));
  };
  btns.forEach(b=>b.addEventListener('click',()=>show(b.dataset.tab)));
  show(btns.find(b=>b.classList.contains('active'))?.dataset?.tab||'connection');
}

/* ── BLE WRITE ───────────────────────────────────────────── */
async function writeLine(line){
  if(!cmdChar) throw new Error('BLE not connected');
  const data=new TextEncoder().encode(line+'\n');
  for(let i=0;i<data.length;i+=18){
    const chunk=data.slice(i,i+18);
    if(cmdChar.writeValueWithoutResponse) await cmdChar.writeValueWithoutResponse(chunk);
    else await cmdChar.writeValue(chunk);
  }
}

/* ── AUTO POLL ───────────────────────────────────────────── */
function startPoll(){
  stopPoll();
  pollTimer=setInterval(async()=>{
    if(!connected)return;
    try{ await writeLine('STATUS'); await writeLine('TEL'); await writeLine('BMS'); }
    catch(e){ addRawLog('ERR','Poll: '+e.message); }
  },POLL_MS);
}
function stopPoll(){ clearInterval(pollTimer); pollTimer=null; }

/* ── CONNECTION STATE ────────────────────────────────────── */
function setConnState(c){
  connected=c;
  const btn=$('connectBtn');
  if(btn){ btn.textContent=c?'Disconnect BLE':'Connect BLE'; btn.classList.toggle('btn-danger',c); btn.classList.toggle('btn-primary',!c); }
  const b2=$('connectBtn2'); if(b2) b2.textContent=c?'Disconnect':'Connect BLE';
  const dot=$('statusDot'); if(dot) dot.classList.toggle('connected',c);
  const st=$('statusText'); if(st) st.textContent=c?'Connected':'Disconnected';
  const cb=$('connBadge');
  if(cb){ cb.textContent=c?'ONLINE':'OFFLINE'; cb.style.background=c?'var(--accent-green)':'var(--accent-red)'; }
}

/* ── BLE CONNECT ─────────────────────────────────────────── */
async function connectBle(){
  if(connected&&bleDevice?.gatt?.connected){ bleDevice.gatt.disconnect(); return; }
  if(!navigator.bluetooth){ alert('Web Bluetooth not available. Use Chrome or Edge on Android/Desktop.'); return; }
  const btn=$('connectBtn'); if(btn) btn.disabled=true;
  try{
    addBleLog('Scanning...');
    bleDevice=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:[SVC_UUID]});
    bleDevice.addEventListener('gattserverdisconnected',onDisconnected);
    bleServer=await bleDevice.gatt.connect();
    const svc=await bleServer.getPrimaryService(SVC_UUID);
    cmdChar=await svc.getCharacteristic(CMD_UUID);
    txChar=await svc.getCharacteristic(TX_UUID);
    await txChar.startNotifications();
    txChar.addEventListener('characteristicvaluechanged',onRx);
    setConnState(true);
    addBleLog('Connected to '+(bleDevice.name||'BLE device'),'rx');
    await refreshNow();
    startPoll();
    document.querySelector('.tab-btn[data-tab="dashboard"]')?.click();
  }catch(e){
    addBleLog('Connect failed: '+e.message,'err');
    onDisconnected();
  }finally{ if(btn) btn.disabled=false; }
}

function onDisconnected(){
  addBleLog('Disconnected','err');
  setConnState(false); stopPoll();
  bleDevice=null; bleServer=null; cmdChar=null; txChar=null;
}

/* ── RX ──────────────────────────────────────────────────── */
function onRx(event){
  const bytes=new Uint8Array(event.target.value.buffer,event.target.value.byteOffset,event.target.value.byteLength);
  rxBuffer+=new TextDecoder().decode(bytes);
  let idx=rxBuffer.indexOf('\n');
  while(idx>=0){ handleLine(rxBuffer.slice(0,idx)); rxBuffer=rxBuffer.slice(idx+1); idx=rxBuffer.indexOf('\n'); }
}

function handleLine(line){
  if(!line.trim()) return;
  let obj;
  try{ obj=JSON.parse(line); }catch{ addRawLog('RX',line); return; }
  switch(obj.type){
    case 'status':        return handleStatus(obj);
    case 'telemetry_inv': return applyTelemetry(obj);
    case 'telemetry_bms': return applyBmsTelemetry(obj);
    case 'inv_resp':      return handleInvResp(obj);
    case 'bms_resp':      return handleBmsResp(obj);
    case 'error':         addRawLog('ERR',obj.message||'unknown error'); break;
    case 'pong':          addRawLog('RX','PONG'); break;
    default:              addRawLog('RX',line);
  }
}

/* ── STATUS ──────────────────────────────────────────────── */
function handleStatus(obj){
  invPolling=!!obj.polling; bmsPolling=!!obj.bms_polling;
  const pt=$('bmsPollToggle');
  if(pt){ pt.textContent=bmsPolling?'\u25b6 Auto-Poll ON':'\u25a0 Auto-Poll OFF'; pt.classList.toggle('btn-primary',bmsPolling); pt.classList.toggle('btn-danger',!bmsPolling); }
  const ps=$('bmsPollStatus'); if(ps) ps.textContent=bmsPolling?'Polling every 2s':'Polling stopped';
  const bb=$('bmsBadge');
  if(bb){ bb.textContent=obj.bms_connected?'ONLINE':'OFFLINE'; bb.style.background=obj.bms_connected?'var(--accent-green)':'var(--accent-red)'; }
}

/* ── INV TELEMETRY → same structure as SoftAP applyTelemetry ── */
function applyTelemetry(o){
  lastTelemetry=o;
  $('dashNoData').style.display='none'; $('dashData').style.display='block';

  const invOnline = o.connected !== false; // true when inverter UART has data

  /* inverter online/offline badge */
  const ib=$('invBadge');
  if(ib){
    ib.textContent = invOnline ? 'INV: ONLINE' : 'INV: OFFLINE';
    ib.style.background = invOnline ? 'var(--accent-green)' : 'var(--accent-red)';
  }

  if(!invOnline){
    /* inverter UART has no data — clear all metrics to dashes */
    const dash=()=>null;
    ['m_grid_v','m_grid_f','m_out_v','m_out_f','m_out_w','m_out_va',
     'm_load_pct','m_bus_v','m_bat_v','m_bat_scc','m_bat_cap',
     'm_chg_a','m_dis_a','m_temp','m_pv_v','m_pv_a','m_pv_w'
    ].forEach(id=>{ const el=$(id); if(el) el.innerHTML='&#8212;'; });

    $('statusFlags').innerHTML='<span style="color:var(--accent-amber)">&#9888; Inverter UART offline — no data</span>';
    $('modeBadge').className='mode-badge mode-S';
    $('modeIcon').innerHTML='&#9888;';
    $('modeText').textContent='OFFLINE';
    $('warningList').innerHTML='<div class="warning-item active">&#9888; Inverter not responding</div>';
    const wc=$('warningCount'); if(wc){wc.textContent='1'; wc.style.background='var(--accent-amber)';}
    const fb=$('flowStatus'); if(fb) fb.textContent='OFFLINE';
    updateFlow({...o, pv_w:0, pv_v:0, pv_a:0, grid_v:0, grid_hz:0, out_w:0, load_pct:0, bat_v:0, bat_chg_a:0, bat_dis_a:0, bat_soc:0, mode_code:'S', mode_name:'OFFLINE'});
    addRawLog('RX','TEL inv OFFLINE (UART not connected)');
    return;
  }

  /* map BLE fields to SoftAP metric IDs */
  setM('m_grid_v',  o.grid_v,  1); setM('m_grid_f',  o.grid_hz, 1);
  setM('m_out_v',   o.out_v,   1); setM('m_out_f',   o.out_hz,  1);
  setM('m_out_w',   o.out_w,   0); setM('m_out_va',  o.out_va,  0);
  setM('m_load_pct',o.load_pct,0); setM('m_bus_v',   o.bus_v,   1);
  setM('m_bat_v',   o.bat_v,   1); setM('m_bat_scc', o.bat_scc_v,1);
  setM('m_bat_cap', o.bat_soc, 0);
  setM('m_chg_a',   o.bat_chg_a,1); setM('m_dis_a', o.bat_dis_a,1);
  setM('m_temp',    o.inv_temp, 1);
  setM('m_pv_v',    o.pv_v,    1); setM('m_pv_a',   o.pv_a,    1); setM('m_pv_w',o.pv_w,0);

  const ts=$('m_timestamp'); if(ts) ts.textContent=tsNow();

  /* status flags */
  if(o.flags){
    const f=o.flags;
    $('statusFlags').innerHTML=[
      chip('Load',f.load_on),chip('Charging',f.charging),chip('SCC',f.scc_charging),
      chip('AC Chg',f.ac_charging),chip('SBU',f.sbu_priority),chip('Bat Steady',f.battery_steady)
    ].join('');
  }

  /* mode badge */
  const mc=String(o.mode_code||'S').toUpperCase();
  const icons={P:'&#9211;',S:'&#128164;',L:'&#128268;',B:'&#128267;',F:'&#9888;',H:'&#127769;'};
  $('modeBadge').className='mode-badge mode-'+mc;
  $('modeIcon').innerHTML=icons[mc]||'?';
  $('modeText').textContent=o.mode_name||'--';

  /* warnings */
  const ws=Array.isArray(o.warnings)?o.warnings:[];
  const wc=$('warningCount'); if(wc){wc.textContent=ws.length; wc.style.background=ws.length?'var(--accent-red)':'var(--accent-green)';}
  $('warningList').innerHTML=ws.length?ws.map(w=>'<div class="warning-item active">&#9888; '+escapeHtml(w)+'</div>').join(''):'<div class="warning-item ok">&#10003; No active warnings</div>';

  /* flow badge */
  const fb=$('flowStatus'); if(fb) fb.textContent=(o.mode_name||'LIVE').toUpperCase();

  updateFlow(o);
  addRawLog('RX','TEL inv mode='+o.mode_name+' pv='+fmtNum(o.pv_w,0)+'W out='+fmtNum(o.out_w,0)+'W');
}

/* ── BMS TELEMETRY → same structure as SoftAP applyBmsTelemetry ── */
function applyBmsTelemetry(o){
  lastBmsTelemetry=o;
  $('bmsNoData').style.display='none'; $('bmsData').style.display='block';

  const dot=$('bmsDot'), badge=$('bmsBadge'), txt=$('bmsStatusText');
  if(dot) dot.classList.add('connected');
  if(badge){ badge.textContent='ONLINE'; badge.style.background='var(--accent-green)'; }
  if(txt) txt.textContent='Receiving BMS Frames';

  const ts=$('bmsTimestamp'); if(ts) ts.textContent=tsNow();
  const fc=$('bmsFrameCount'); if(fc) fc.textContent=String(parseInt(fc.textContent||'0')+1);

  /* map BLE field names to SoftAP IDs */
  setM('bms_pack_v',    o.pack_v,   2);
  setM('bms_current',   o.current,  2);
  setM('bms_soc',       o.soc,      0);
  setM('bms_soh',       o.soh,      0);
  setM('bms_cap_left',  o.cap_left, 1);
  setM('bms_energy_left',o.energy_left,2);
  setM('bms_cycles',    o.cycles,   0);
  setM('bms_min_cell_v',o.min_cell_v,3);
  setM('bms_max_cell_v',o.max_cell_v,3);
  setM('bms_min_temp',  o.min_temp, 1);
  setM('bms_max_temp',  o.max_temp, 1);
  setM('bms_mos_temp',  o.mos_temp, 1);
  setM('bms_amb_temp',  o.amb_temp, 1);
  setM('bms_cell_count',o.cell_count,0);

  /* cell delta */
  if(o.min_cell_v!=null&&o.max_cell_v!=null)
    setM('bms_delta',((o.max_cell_v-o.min_cell_v)*1000),0);

  /* state + flags */
  if(o.flags){
    const f=o.flags;
    const parts=[]; if(f.ca_on)parts.push('Charging'); if(f.load)parts.push('Load'); if(f.balancing)parts.push('Balancing');
    const se=$('bms_state'); if(se) se.textContent=parts.length?parts.join(' | '):'Idle';
    $('bmsFlags').innerHTML=[chip('Balancing',f.balancing),chip('MOSFET Fail',f.mosfet_fail),chip('CA ON',f.ca_on),chip('Load',f.load)].join('');
  }

  /* cell voltages — same bms-list grid as SoftAP */
  const cellsEl=$('bmsCells');
  if(cellsEl&&Array.isArray(o.cell_v)&&o.cell_v.length){
    cellsEl.innerHTML=o.cell_v.map((v,i)=>
      `<div class="bms-item"><div class="label">Cell ${i+1}</div><div class="value">${(+v).toFixed(3)} V</div></div>`
    ).join('');
  }

  /* cell temperatures */
  const tempsEl=$('bmsTemps');
  if(tempsEl&&Array.isArray(o.cell_t)&&o.cell_t.length){
    tempsEl.innerHTML=o.cell_t.map((t,i)=>
      `<div class="bms-item"><div class="label">Temp ${i+1}</div><div class="value">${(+t).toFixed(1)} °C</div></div>`
    ).join('');
  }

  /* raw frame */
  const rawEl=$('bmsRaw');
  if(rawEl) rawEl.innerHTML=`<div class="console-line"><span class="console-dir rx">RX</span><span class="console-data">Pack:${fmtNum(o.pack_v,2)}V SOC:${fmtNum(o.soc,0)}% Cur:${fmtNum(o.current,2)}A Cells:${o.cell_count||'?'}</span></div>`;

  /* bms frame log */
  addBmsLog(`Pack:${fmtNum(o.pack_v,2)}V SOC:${fmtNum(o.soc,0)}% Cur:${fmtNum(o.current,2)}A`);

  /* update flow battery node */
  if(lastTelemetry) updateFlow(lastTelemetry);
  if(lastTelemetry) renderFlowDetails();

  addRawLog('RX','BMS pack='+fmtNum(o.pack_v,2)+'V soc='+fmtNum(o.soc,0)+'%');
}

/* ── FLOW DIAGRAM ────────────────────────────────────────── */
function updateFlow(o){
  const pvW   =+(o.pv_w||0),  pvV=+(o.pv_v||0), pvA=+(o.pv_a||0);
  const gridV =+(o.grid_v||0), gridF=+(o.grid_hz||0);
  const outW  =+(o.out_w||0), loadPct=+(o.load_pct||0);
  const batV  =+(o.bat_v||0), batChg=+(o.bat_chg_a||0), batDis=+(o.bat_dis_a||0);
  const bmsO  =lastBmsTelemetry;
  const bmsSoc=bmsO?.soc!=null?+bmsO.soc:+(o.bat_soc||0);
  const bmsV  =bmsO?.pack_v!=null?+bmsO.pack_v:batV;
  const mode  =o.mode_name||'--';

  const t=id=>{ const e=$(id); if(e) e.textContent=fmtNum(arguments[1],arguments[2]); };
  setText('flow_pv_w',   pvW,  0); setText('flow_pv_v', pvV,  1); setText('flow_pv_a',  pvA,  1);
  setText('flow_grid_v', gridV,1); setText('flow_grid_f',gridF,1);
  setText('flow_home_w', outW, 0); setText('flow_load_pct',loadPct,0);
  setText('flow_bat_v',  bmsV, 1); setText('flow_bat_soc',bmsSoc,0);
  setText('flow_mode',   null,null,$('flow_mode'),mode);

  const lPv  =$('flowLinePv');   if(lPv)   lPv.classList.toggle('active',pvW>10);
  const lHome=$('flowLineHome'); if(lHome)  lHome.classList.toggle('active',outW>10);
  const lGrid=$('flowLineGrid');
  if(lGrid){ const ga=(o.mode_code==='L')||(gridV>10&&outW>10); lGrid.classList.toggle('active',ga); }
  const lBat=$('flowLineBat');
  if(lBat){ lBat.classList.toggle('active',batDis>0||batChg>0); lBat.classList.toggle('blue',batDis>0); lBat.classList.toggle('green',batChg>0); }

  renderFlowDetails();
}

function setText(id,v,dec,el,raw){
  const e=el||$(id); if(!e) return;
  if(raw!=null){ e.textContent=raw; return; }
  e.innerHTML=fmtNum(v,dec);
}

function selectFlowNode(node){
  activeFlowNode=node;
  document.querySelectorAll('.flow-node').forEach(el=>el.classList.toggle('active',el.dataset.node===node));
  renderFlowDetails();
}

function renderFlowDetails(){
  const titleEl=$('flowDetailsTitle'), gridEl=$('flowDetailsGrid');
  if(!titleEl||!gridEl) return;
  const o=lastTelemetry, bms=lastBmsTelemetry;
  if(!o){ gridEl.innerHTML='<div class="detail-item"><div class="label">No data</div><div class="val">Connect BLE</div></div>'; return; }
  const add=(l,v)=>`<div class="detail-item"><div class="label">${l}</div><div class="val">${v}</div></div>`;
  let title='Inverter Details', items=[];
  if(activeFlowNode==='pv'){
    title='Solar Array';
    items=[add('PV Voltage',fmtNum(o.pv_v,1)+' V'),add('PV Current',fmtNum(o.pv_a,1)+' A'),add('PV Power',fmtNum(o.pv_w,0)+' W')];
  } else if(activeFlowNode==='grid'){
    title='Grid';
    items=[add('Grid Voltage',fmtNum(o.grid_v,1)+' V'),add('Grid Frequency',fmtNum(o.grid_hz,1)+' Hz'),add('Mode',o.mode_name||'--')];
  } else if(activeFlowNode==='battery'){
    title='Battery';
    items=[add('Inverter Bat V',fmtNum(o.bat_v,1)+' V'),add('Charge',fmtNum(o.bat_chg_a,1)+' A'),add('Discharge',fmtNum(o.bat_dis_a,1)+' A'),add('Inv SOC',fmtNum(o.bat_soc,0)+'%'),add('SCC Voltage',fmtNum(o.bat_scc_v,1)+' V')];
    if(bms) items.push(add('BMS Pack',fmtNum(bms.pack_v,2)+' V'),add('BMS SOC',fmtNum(bms.soc,0)+'%'),add('BMS SOH',fmtNum(bms.soh,0)+'%'),add('Current',fmtNum(bms.current,2)+' A'));
  } else if(activeFlowNode==='home'){
    title='Home Load';
    items=[add('Output Power',fmtNum(o.out_w,0)+' W'),add('Apparent',fmtNum(o.out_va,0)+' VA'),add('Output V',fmtNum(o.out_v,1)+' V'),add('Output Hz',fmtNum(o.out_hz,1)+' Hz'),add('Load',fmtNum(o.load_pct,0)+'%')];
  } else {
    title='Inverter';
    items=[add('Mode',o.mode_name||'--'),add('Bus Voltage',fmtNum(o.bus_v,1)+' V'),add('Bat Voltage',fmtNum(o.bat_v,1)+' V'),add('Inv Temp',fmtNum(o.inv_temp,1)+' °C'),add('Warnings',Array.isArray(o.warnings)?o.warnings.length:0)];
  }
  titleEl.textContent=title;
  gridEl.innerHTML=items.join('');
}

function initFlowNodes(){
  document.querySelectorAll('.flow-node').forEach(n=>n.addEventListener('click',()=>selectFlowNode(n.dataset.node)));
  selectFlowNode(activeFlowNode);
}

/* ── INVERTER RESPONSE ───────────────────────────────────── */
function handleInvResp(obj){
  addRawLog(obj.success?'RX':'ERR','INV '+obj.cmd+' => '+(obj.raw||''));
  const el=$('cmdResponse'); if(!el) return;
  let html=`<div class="console-line"><span class="console-dir tx">TX</span><span class="console-data" style="color:var(--accent-cyan);">${escapeHtml(obj.cmd)}</span></div>`;
  html+=`<div class="console-line"><span class="console-dir ${obj.success?'rx':'err'}">${obj.success?'RX':'ERR'}</span><span class="console-data">${escapeHtml(obj.raw||'')}</span></div>`;
  el.innerHTML=html;
  addHistory({command:obj.cmd,raw_response:obj.raw||'',success:obj.success,timestamp:Date.now()});

  /* update quick setting response if applicable */
  INV_QUICK_SETTINGS.forEach((s,i)=>{
    if(obj.cmd&&obj.cmd.startsWith(s.cmd)){
      const re=$('iqr_'+i);
      if(re){ re.style.display='block'; re.innerHTML=`<span style="color:var(--accent-cyan);">TX: ${escapeHtml(obj.cmd)}</span> → <span style="color:var(--text-secondary);">RX: ${escapeHtml(obj.raw||'')}</span> ${obj.success&&!(obj.raw||'').includes('NAK')?'<span style="color:var(--accent-green);">✔ OK</span>':'<span style="color:var(--accent-red);">✘ Rejected</span>'}`; }
    }
  });
}

/* ── BMS RESPONSE ────────────────────────────────────────── */
function handleBmsResp(obj){
  const text=obj.success?obj.resp_hex:('ERROR: '+( obj.error||'failed'));
  addRawLog(obj.success?'RX':'ERR','BMS '+obj.mode+' => '+text);
  const el=$('bmsCmdResponse'); if(!el) return;
  if(el.querySelector('[style*="color:var(--text-muted)"]')) el.innerHTML='';
  el.innerHTML+=`<div class="console-line"><span class="console-dir rx">RX</span><span class="console-data">[${escapeHtml(obj.mode)}] ${escapeHtml(text)}</span></div>`;
  el.scrollTop=el.scrollHeight;
  if(obj.success&&obj.resp_hex) addBmsLog(obj.resp_hex);
}

/* ── SEND COMMAND (Commands tab) ─────────────────────────── */
async function sendCommand(){
  const raw=($('cmdRawInput')?.value||'').trim(); if(!raw) return;
  const btn=$('sendCmdBtn'); if(btn){btn.disabled=true;btn.textContent='Sending...';}
  try{
    addRawLog('TX',raw);
    await writeLine('INV '+raw);
  }catch(e){ addRawLog('ERR',e.message); }
  if(btn){btn.disabled=false;btn.textContent='Send ▶';}
}

function onCommandSelect(){
  const sel=$('cmdSelect'); const idx=sel?.selectedOptions[0]?.dataset?.idx;
  if(idx===undefined){ $('cmdDescription').textContent=''; $('cmdParamArea').style.display='none'; $('cmdRawInput').value=''; return; }
  const cmd=COMMANDS[parseInt(idx)];
  $('cmdDescription').textContent=(cmd.description||'')+' ['+cmd.group+']';
  $('cmdRawInput').value=cmd.command;
  if(cmd.has_params){ $('cmdParamArea').style.display='block'; $('cmdParamLabel').textContent=cmd.param_description||'Parameter'; buildParamInput(cmd); }
  else $('cmdParamArea').style.display='none';
}

function buildParamInput(cmd){
  const c=$('cmdParamInput'); c.innerHTML='';
  if(cmd.param_options){
    const sel=document.createElement('select'); sel.id='cmdParamValue';
    cmd.param_options.split('|').forEach(opt=>{ const[val,label]=opt.split(':'); const o=document.createElement('option'); o.value=val; o.textContent=val+' - '+label; sel.appendChild(o); });
    sel.addEventListener('change',()=>{ $('cmdRawInput').value=cmd.command+sel.value; });
    c.appendChild(sel); $('cmdRawInput').value=cmd.command+sel.value;
  } else {
    const inp=document.createElement('input'); inp.type='text'; inp.id='cmdParamValue'; inp.placeholder=cmd.param_format||'value'; inp.style.width='100%';
    inp.addEventListener('input',()=>{ $('cmdRawInput').value=cmd.command+inp.value; }); c.appendChild(inp);
  }
}

function populateCommandSelect(){
  const sel=$('cmdSelect'); sel.innerHTML='<option value="">-- Select --</option>';
  ['inquiry','setting'].forEach(type=>{
    const cmds=COMMANDS.filter(c=>c.type===type); if(!cmds.length) return;
    const grp=document.createElement('optgroup'); grp.label=type==='inquiry'?'Inquiry':'Setting';
    cmds.forEach(c=>{ const o=document.createElement('option'); o.value=c.command; o.textContent=c.command+' — '+c.description; o.dataset.idx=COMMANDS.indexOf(c); grp.appendChild(o); });
    sel.appendChild(grp);
  });
}

/* ── INV QUICK SETTINGS ──────────────────────────────────── */
function buildInvQuickSettings(){
  const el=$('invQuickSettings'); if(!el) return;
  let h='';
  INV_QUICK_SETTINGS.forEach((s,i)=>{
    let ctrl='';
    if(s.opts){
      const opts=s.opts.map(o=>{const p=o.split(':');return `<option value="${p[0]}">${p[0]} - ${p.slice(1).join(':')}</option>`;}).join('');
      ctrl=`<select id="iqp_${i}" style="min-width:140px;">${opts}</select><button class="btn btn-primary btn-sm" style="margin-left:8px;" onclick="sendInvQuick('${s.cmd}',document.getElementById('iqp_${i}').value,${i})">Set</button>`;
    } else if(s.input){
      ctrl=`<input type="text" id="iqp_${i}" placeholder="${s.ph||s.input}" style="width:90px;"><button class="btn btn-primary btn-sm" style="margin-left:8px;" onclick="sendInvQuick('${s.cmd}',document.getElementById('iqp_${i}').value,${i})">Set</button>`;
    } else if(s.danger){
      ctrl=`<button class="btn btn-danger btn-sm" onclick="if(!confirm('Factory reset ALL parameters?'))return;sendInvQuick('${s.cmd}','',${i})">RESET</button>`;
    } else {
      ctrl=`<button class="btn btn-primary btn-sm" onclick="sendInvQuick('${s.cmd}','',${i})">Execute</button>`;
    }
    h+=`<div class="setting-row"><div class="setting-info"><div class="setting-cmd">${escapeHtml(s.cmd)}</div><div class="setting-desc">${escapeHtml(s.desc)}</div></div><div class="setting-controls">${ctrl}</div></div><div id="iqr_${i}" style="display:none;margin:-6px 0 8px;padding:8px 14px;background:#050a14;border-radius:0 0 var(--radius-sm) var(--radius-sm);border:1px solid var(--border);border-top:none;font-family:var(--mono);font-size:11px;"></div>`;
  });
  el.innerHTML=h;
}

async function sendInvQuick(cmd,param,idx){
  const full=cmd+param;
  try{ addRawLog('TX',full); await writeLine('INV '+full); }
  catch(e){ addRawLog('ERR',e.message); }
}

/* ── SETTINGS TAB ────────────────────────────────────────── */
const GROUPS_ORDER=['Battery','Output','Grid','Others','Buzzer','Rating Information','Product Information','Factory Reset'];
function buildSettingsUI(){
  const groups={};
  COMMANDS.forEach(c=>{ const g=c.group||'Others'; if(!groups[g])groups[g]=[]; groups[g].push(c); });
  const nav=$('settingsNav'), content=$('settingsContent');
  if(!nav||!content) return;
  nav.innerHTML=''; content.innerHTML='';
  const ordered=[...new Set([...GROUPS_ORDER,...Object.keys(groups)])].filter(g=>groups[g]);
  ordered.forEach((gn,idx)=>{
    const btn=document.createElement('button'); btn.className='settings-nav-btn'+(idx===0?' active':''); btn.textContent=gn;
    btn.onclick=()=>{ document.querySelectorAll('.settings-nav-btn').forEach(b=>b.classList.remove('active')); document.querySelectorAll('.setting-group').forEach(g=>g.classList.remove('active')); btn.classList.add('active'); $('sg-'+idx)?.classList.add('active'); };
    nav.appendChild(btn);
    const div=document.createElement('div'); div.className='setting-group'+(idx===0?' active':''); div.id='sg-'+idx;
    groups[gn].forEach(cmd=>{ div.innerHTML+=buildSettingRow(cmd); });
    content.appendChild(div);
  });
}

function buildSettingRow(cmd){
  let ctrl='';
  if(cmd.type==='inquiry'){
    ctrl=`<button class="btn btn-outline btn-sm" onclick="sendSettingCmd('${cmd.command}','',this)">Query</button>`;
  } else if(cmd.has_params&&cmd.param_options){
    const opts=cmd.param_options.split('|').map(o=>{const[v,l]=o.split(':');return `<option value="${v}">${v} - ${l}</option>`;}).join('');
    ctrl=`<select id="sp-${cmd.command}">${opts}</select><button class="btn btn-primary btn-sm" onclick="sendSettingCmd('${cmd.command}',document.getElementById('sp-${cmd.command}').value,this)" style="margin-left:8px;">Set</button>`;
  } else if(cmd.has_params){
    ctrl=`<input type="text" id="sp-${cmd.command}" placeholder="${cmd.param_format||'value'}" style="width:100px;"><button class="btn btn-primary btn-sm" onclick="sendSettingCmd('${cmd.command}',document.getElementById('sp-${cmd.command}').value,this)" style="margin-left:8px;">Set</button>`;
  } else {
    const danger=cmd.command==='PF';
    ctrl=`<button class="btn ${danger?'btn-danger':'btn-primary'} btn-sm" onclick="${danger?"if(!confirm('Factory reset?'))return;":""}sendSettingCmd('${cmd.command}','',this)">${cmd.type==='setting'?'Execute':'Query'}</button>`;
  }
  return `<div class="setting-row"><div class="setting-info"><div class="setting-cmd">${escapeHtml(cmd.command)}</div><div class="setting-desc">${escapeHtml(cmd.description)}</div></div><div class="setting-controls">${ctrl}</div></div><div id="sr-${cmd.command}" style="display:none;margin:-6px 0 8px;padding:8px 14px;background:#050a14;border-radius:0 0 var(--radius-sm) var(--radius-sm);border:1px solid var(--border);border-top:none;font-family:var(--mono);font-size:11px;"></div>`;
}

async function sendSettingCmd(cmd,param,btn){
  if(cmd==='PF'&&!confirm('Factory reset ALL parameters?')) return;
  const full=cmd+param;
  const orig=btn?.textContent||'';
  if(btn){btn.disabled=true;btn.textContent='...';}
  try{ addRawLog('TX',full); await writeLine('INV '+full); }
  catch(e){ addRawLog('ERR',e.message); }
  if(btn){btn.disabled=false;btn.textContent=orig;}
}

/* ── BMS COMMANDS ────────────────────────────────────────── */
function initBmsCommands(){
  const sel=$('bmsCmdSelect'); if(!sel) return;
  BMS_COMMANDS.forEach((cmd,idx)=>{ const o=document.createElement('option'); o.value=idx; o.textContent=cmd.label; sel.appendChild(o); });
}

function onBmsCommandSelect(){
  const sel=$('bmsCmdSelect'), valEl=$('bmsCmdValue'), hexEl=$('bmsCmdHex'), desc=$('bmsCmdDesc');
  const idx=parseInt(sel.value,10);
  if(isNaN(idx)){ if(desc)desc.textContent=''; if(valEl){valEl.value='';valEl.disabled=false;} if(hexEl)hexEl.value=''; return; }
  const cmd=BMS_COMMANDS[idx];
  if(desc) desc.textContent=cmd.desc||'';
  if(valEl){ if(cmd.fixed!==undefined){valEl.value='0x'+cmd.fixed.toString(16).padStart(4,'0').toUpperCase();valEl.disabled=true;}else{valEl.disabled=false;valEl.value='';} }
  buildBmsHex();
}

function buildBmsHex(){
  const sel=$('bmsCmdSelect'), hexEl=$('bmsCmdHex'), valEl=$('bmsCmdValue');
  if(!sel||!hexEl) return;
  const idx=parseInt(sel.value,10); if(isNaN(idx)){hexEl.value='';return;}
  const cmd=BMS_COMMANDS[idx];
  const s=(valEl?.value||'').trim();
  const value=cmd.fixed!==undefined?cmd.fixed:(s?parseInt(s.startsWith('0x')?s:s,s.startsWith('0x')?16:10)&0xFFFF:null);
  if(value==null){hexEl.value='';return;}
  hexEl.value=[...cmd.base,(value>>8)&0xFF,value&0xFF].map(b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ');
}

async function sendBmsCommand(){
  const hex=($('bmsCmdHex')?.value||'').trim();
  if(!hex){alert('Select a BMS command first.');return;}
  try{ addRawLog('TX','BMSHEX '+hex); await writeLine('BMSHEX '+hex); }
  catch(e){ addRawLog('ERR',e.message); }
}

async function sendBmsAscii(ascii,btnId){
  if(!ascii) ascii=($('bmsCustomInput')?.value||'').trim();
  const btn=btnId?$(btnId):null; const orig=btn?.textContent||'';
  if(btn){btn.disabled=true;btn.textContent='...';}
  try{ addRawLog('TX','BMSASCII '+ascii); await writeLine('BMSASCII '+ascii); }
  catch(e){ addRawLog('ERR',e.message); }
  if(btn){btn.disabled=false;btn.textContent=orig;}
}

async function sendBmsCustom(){
  const input=($('bmsCustomInput')?.value||'').trim(); if(!input) return;
  const mode=$('bmsCustomMode')?.value||'HEX';
  if(mode==='ASCII'){
    const cr=$('bmsCustomCr')?.checked;
    try{ await writeLine('BMSASCII '+(cr?input+'\r':input)); addRawLog('TX','BMSASCII '+input); }
    catch(e){ addRawLog('ERR',e.message); }
  } else {
    try{ await writeLine('BMSHEX '+input); addRawLog('TX','BMSHEX '+input); }
    catch(e){ addRawLog('ERR',e.message); }
  }
}

async function manualBmsQuery(){
  const btn=$('bmsManualQueryBtn'); const orig=btn?.textContent||'';
  if(btn){btn.disabled=true;btn.textContent='Querying...';}
  try{ addRawLog('TX','BMSASCII #H0'); await writeLine('BMSASCII #H0'); }
  catch(e){ addRawLog('ERR',e.message); }
  if(btn){btn.disabled=false;btn.textContent=orig;}
}

async function toggleBmsPoll(){
  const btn=$('bmsPollToggle'); const newState=!bmsPolling;
  if(btn) btn.disabled=true;
  try{
    await writeLine('SET BMSPOLL '+(newState?1:0));
    bmsPolling=newState;
    if(btn){btn.textContent=bmsPolling?'\u25b6 Auto-Poll ON':'\u25a0 Auto-Poll OFF';btn.classList.toggle('btn-primary',bmsPolling);btn.classList.toggle('btn-danger',!bmsPolling);}
    const ps=$('bmsPollStatus'); if(ps) ps.textContent=bmsPolling?'Polling every 2s':'Polling stopped';
    addRawLog(bmsPolling?'TX':'ERR','BMS poll '+(bmsPolling?'enabled':'disabled'));
  }catch(e){addRawLog('ERR',e.message);}
  if(btn) btn.disabled=false;
}

/* ── LOGGING ─────────────────────────────────────────────── */
function addRawLog(dir,text){
  rawLogLines.push({ts:tsNow(),dir,text});
  if(rawLogLines.length>500) rawLogLines.shift();
  const el=$('rawLog'); if(!el) return;
  const d=document.createElement('div'); d.className='console-line';
  d.innerHTML=`<span class="console-ts">${tsNow()}</span><span class="console-dir ${dir.toLowerCase()}">${dir}</span><span class="console-data">${escapeHtml(text)}</span>`;
  el.appendChild(d); el.scrollTop=el.scrollHeight;
}

function addBleLog(text,dir='tx'){
  const el=$('bleLog'); if(!el) return;
  const d=document.createElement('div'); d.className='console-line';
  d.innerHTML=`<span class="console-ts">${tsNow()}</span><span class="console-dir ${dir}">${dir.toUpperCase()}</span><span class="console-data">${escapeHtml(text)}</span>`;
  el.appendChild(d); el.scrollTop=el.scrollHeight;
  addRawLog(dir.toUpperCase(),text);
}

function addBmsLog(text){
  bmsLogLines.push({ts:tsNow(),text});
  if(bmsLogLines.length>300) bmsLogLines.shift();
  const el=$('bmsLog'); if(!el) return;
  const d=document.createElement('div'); d.className='console-line';
  d.innerHTML=`<span class="console-ts">${tsNow()}</span><span class="console-dir rx">RX</span><span class="console-data">${escapeHtml(text)}</span>`;
  el.appendChild(d); el.scrollTop=el.scrollHeight;
}

function clearBmsLog(){ bmsLogLines=[]; const e=$('bmsLog'); if(e) e.innerHTML=''; }
function clearConsole(){ rawLogLines=[]; const e=$('rawLog'); if(e) e.innerHTML=''; }

function addHistory(data){
  const el=$('cmdHistory'); if(!el) return;
  commandHistory.unshift(data); if(commandHistory.length>50) commandHistory.pop();
  const line=document.createElement('div'); line.className='console-line';
  const ts=data.timestamp?new Date(data.timestamp).toLocaleTimeString('en-US',{hour12:false}):tsNow();
  line.innerHTML=`<span class="console-ts">${ts}</span><span class="console-dir tx">TX</span><span class="console-data" style="color:var(--accent-cyan);">${escapeHtml(data.command)}</span><span style="margin:0 8px;color:var(--text-muted);">→</span><span class="console-data">${data.success?'✓':'✗'} ${escapeHtml(String(data.raw_response||'').substring(0,80))}</span>`;
  el.prepend(line);
}

/* ── REFRESH ─────────────────────────────────────────────── */
async function refreshNow(){
  try{ await writeLine('PING'); await writeLine('STATUS'); await writeLine('TEL'); await writeLine('BMS'); }
  catch(e){ addRawLog('ERR','Refresh: '+e.message); }
}

/* ── PWA ─────────────────────────────────────────────────── */
function setupPwa(){
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); deferredInstall=e;
    const btn=$('installBtn'); if(btn) btn.hidden=false;
  });
  $('installBtn')?.addEventListener('click',async()=>{
    if(!deferredInstall) return; deferredInstall.prompt();
    await deferredInstall.userChoice; deferredInstall=null;
    const btn=$('installBtn'); if(btn) btn.hidden=true;
  });
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

/* ── INIT ────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded',()=>{
  initTabs();
  initFlowNodes();
  populateCommandSelect();
  initBmsCommands();
  buildInvQuickSettings();
  buildSettingsUI();
  $('bmsCmdValue')?.addEventListener('input',buildBmsHex);
  $('connectBtn')?.addEventListener('click',connectBle);
  $('connectBtn2')?.addEventListener('click',connectBle);
  $('refreshBtn')?.addEventListener('click',()=>refreshNow());
  setConnState(false);
  setupPwa();
  addRawLog('TX','Page loaded — click Connect BLE');
});
