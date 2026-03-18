/* ── BLE CONSTANTS ────────────────────────────────────────── */
const SERVICE_UUID    = 0xFFF0;
const CMD_CHAR_UUID   = 0xFFF1;
const TX_CHAR_UUID    = 0xFFF2;
const SOFTAP_URL      = "http://192.168.4.1";
const POLL_INTERVAL   = 1500; /* ms between auto-poll cycles */

/* ── STATE ────────────────────────────────────────────────── */
let device = null, server = null, cmdChar = null, txChar = null;
let connected = false;
let invPolling = true, bmsPolling = true;
let rxBuffer = "";
let pollTimer = null;
let deferredInstallPrompt = null;
let activeTab = "connection";
let cmdHistory = [];
let bmsHasData = false, invHasData = false;
let lastSelectedNode = null;

/* ── DOM REFS ─────────────────────────────────────────────── */
const connectBtn   = document.getElementById("connectBtn");
const installBtn   = document.getElementById("installBtn");
const statusDot    = document.getElementById("statusDot");
const statusText   = document.getElementById("statusText");
const clockEl      = document.getElementById("clock");
const liveLog      = document.getElementById("liveLog");
const bleLog       = document.getElementById("bleLog");
const invCmdResp   = document.getElementById("invCmdResp");
const bmsCmdResp   = document.getElementById("bmsCmdResp");
const cmdHistoryEl = document.getElementById("cmdHistory");

/* ── HELPERS ──────────────────────────────────────────────── */
function now() { return new Date().toLocaleTimeString("en-US", { hour12: false }); }

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]));
}

function fmt(v, dec = null) {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return "&#8212;";
  return dec === null ? String(v) : Number(v).toFixed(dec);
}

function setEl(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setText(id, v, dec = null) { setEl(id, fmt(v, dec)); }

function appendLine(container, text, cls = "") {
  const d = document.createElement("div");
  d.className = `line ${cls}`.trim();
  d.innerHTML = `<span class="ts">${now()}</span>${escapeHtml(text)}`;
  container.appendChild(d);
  container.scrollTop = container.scrollHeight;
  /* keep log bounded */
  while (container.children.length > 400) container.removeChild(container.firstChild);
}

function log(text, cls = "") {
  appendLine(liveLog, text, cls);
}

function bleLogLine(text, cls = "") {
  appendLine(bleLog, text, cls);
  log(text, cls);
}

function clearLog() {
  liveLog.innerHTML = "";
}

/* ── CLOCK ────────────────────────────────────────────────── */
function updateClock() {
  if (clockEl) clockEl.textContent = new Date().toLocaleTimeString("en-US", { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

/* ── TABS ─────────────────────────────────────────────────── */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add("active");
    activeTab = btn.dataset.tab;
  });
});

/* ── BLE WRITE ────────────────────────────────────────────── */
async function writeLine(line) {
  if (!cmdChar) throw new Error("BLE not connected");
  const data = new TextEncoder().encode(`${line}\n`);
  const chunkSize = 18;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (cmdChar.writeValueWithoutResponse) await cmdChar.writeValueWithoutResponse(chunk);
    else await cmdChar.writeValue(chunk);
  }
}

/* ── AUTO POLLING ─────────────────────────────────────────── */
function startAutoPolling() {
  stopAutoPolling();
  pollTimer = setInterval(async () => {
    if (!connected) return;
    try {
      await writeLine("STATUS");
      await writeLine("TEL");
      await writeLine("BMS");
    } catch (e) {
      log(`Poll error: ${e.message}`, "err");
    }
  }, POLL_INTERVAL);
}

function stopAutoPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

/* ── CONNECTION STATE ─────────────────────────────────────── */
function setConnectedState(isConnected) {
  connected = isConnected;
  connectBtn.textContent = connected ? "Disconnect BLE" : "Connect BLE";
  const cb2 = document.getElementById("connectBtn2");
  if (cb2) cb2.textContent = connected ? "Disconnect" : "Connect BLE";

  if (statusDot) {
    statusDot.className = "status-dot" + (connected ? " connected" : "");
  }
  if (statusText) statusText.textContent = connected ? "Connected" : "Disconnected";

  const connBadge = document.getElementById("connBadge");
  if (connBadge) {
    connBadge.textContent = connected ? "ONLINE" : "OFFLINE";
    connBadge.className   = "badge " + (connected ? "ok" : "offline");
  }
}

/* ── CONNECT / DISCONNECT ─────────────────────────────────── */
async function connectBle() {
  if (connected && device?.gatt?.connected) {
    device.gatt.disconnect();
    return;
  }
  if (!navigator.bluetooth) {
    alert("Web Bluetooth is not available. Use Chrome or Edge on Android.");
    return;
  }
  connectBtn.disabled = true;
  try {
    bleLogLine("Scanning for BLE devices...", "info");
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });
    device.addEventListener("gattserverdisconnected", onDisconnected);

    server  = await device.gatt.connect();
    const svc = await server.getPrimaryService(SERVICE_UUID);
    cmdChar = await svc.getCharacteristic(CMD_CHAR_UUID);
    txChar  = await svc.getCharacteristic(TX_CHAR_UUID);
    await txChar.startNotifications();
    txChar.addEventListener("characteristicvaluechanged", onTxChanged);

    setConnectedState(true);
    bleLogLine(`Connected to ${device.name || "BLE device"}`, "ok");
    await refreshNow();
    startAutoPolling();

    /* switch to dashboard */
    document.querySelector('.tab-btn[data-tab="dashboard"]')?.click();
  } catch (e) {
    bleLogLine(`Connect failed: ${e.message}`, "err");
    onDisconnected();
  } finally {
    connectBtn.disabled = false;
  }
}

function onDisconnected() {
  bleLogLine("BLE disconnected", "warn");
  setConnectedState(false);
  stopAutoPolling();
  device = null; server = null; cmdChar = null; txChar = null;
}

/* ── RX HANDLER ───────────────────────────────────────────── */
function onTxChanged(event) {
  const bytes = new Uint8Array(event.target.value.buffer,
    event.target.value.byteOffset, event.target.value.byteLength);
  rxBuffer += new TextDecoder().decode(bytes);
  let idx = rxBuffer.indexOf("\n");
  while (idx >= 0) {
    handleLine(rxBuffer.slice(0, idx));
    rxBuffer = rxBuffer.slice(idx + 1);
    idx = rxBuffer.indexOf("\n");
  }
}

function handleLine(line) {
  if (!line.trim()) return;
  let obj;
  try { obj = JSON.parse(line); } catch {
    log(`RX: ${line}`);
    return;
  }

  switch (obj.type) {
    case "status":       return handleStatus(obj);
    case "telemetry_inv":return handleInvTel(obj);
    case "telemetry_bms":return handleBmsTel(obj);
    case "inv_resp":
      const ir = `INV ${obj.cmd} => ${obj.success ? obj.raw : `ERROR ${obj.raw}`}`;
      log(ir, obj.success ? "ok" : "err");
      appendConsole(invCmdResp, ir, obj.success ? "ok" : "err");
      addCmdHistory(obj.cmd, obj.success ? obj.raw : `ERROR ${obj.raw}`, obj.success);
      return;
    case "bms_resp":
      const br = `BMS ${obj.mode} => ${obj.success ? obj.resp_hex : `ERROR ${obj.error || "failed"}`}`;
      log(br, obj.success ? "ok" : "err");
      appendConsole(bmsCmdResp, br, obj.success ? "ok" : "err");
      return;
    case "error":
      log(`ERR: ${obj.message}`, "err");
      return;
    case "pong":
      log("PONG", "ok");
      return;
    default:
      log(`RX: ${line}`);
  }
}

/* ── STATUS ───────────────────────────────────────────────── */
function handleStatus(obj) {
  invPolling  = !!obj.polling;
  bmsPolling  = !!obj.bms_polling;

  const invOnline = obj.connected;
  const bmsOnline = obj.bms_connected;

  /* BMS poll button */
  const bpb = document.getElementById("bmsPollBtn");
  if (bpb) bpb.textContent = bmsPolling ? "⏸ Auto-Poll ON" : "▶ Auto-Poll OFF";

  /* bmsBadge */
  const bb = document.getElementById("bmsBadge");
  if (bb) { bb.textContent = bmsOnline ? "ONLINE" : "OFFLINE"; bb.className = "badge " + (bmsOnline ? "ok" : "offline"); }

  log(`Status — INV:${invOnline?"ON":"OFF"} BMS:${bmsOnline?"ON":"OFF"} poll:${invPolling} bms_poll:${bmsPolling}`);
}

/* ── INV TELEMETRY ────────────────────────────────────────── */
function handleInvTel(o) {
  invHasData = true;
  showDashData(true);

  /* flow panel nodes */
  setText("fp_pv_w",    o.pv_w, 0);
  setText("fp_pv_v",    o.pv_v, 1);
  setText("fp_pv_a",    o.pv_a, 1);
  setText("fp_grid_v",  o.grid_v, 1);
  setText("fp_grid_hz", o.grid_hz, 1);
  setText("fp_mode",    o.mode_name);
  setText("fp_load",    o.load_pct, 0);
  setText("fp_bat_v",   o.bat_v, 1);
  setText("fp_bat_soc", o.bat_soc, 0);
  setText("fp_out_w",   o.out_w, 0);

  /* metrics */
  setText("m_grid_v",   o.grid_v, 1);
  setText("m_grid_hz",  o.grid_hz, 1);
  setText("m_out_v",    o.out_v, 1);
  setText("m_out_hz",   o.out_hz, 1);
  setText("m_out_w",    o.out_w, 0);
  setText("m_out_va",   o.out_va, 0);
  setText("m_load_pct", o.load_pct, 0);
  setText("m_bus_v",    o.bus_v, 1);
  setText("m_bat_v",    o.bat_v, 1);
  setText("m_bat_scc",  o.bat_scc_v, 1);
  setText("m_bat_soc",  o.bat_soc, 0);
  setText("m_chg_a",    o.bat_chg_a, 1);
  setText("m_dis_a",    o.bat_dis_a, 1);
  setText("m_inv_temp", o.inv_temp, 1);
  setText("m_pv_v",     o.pv_v, 1);
  setText("m_pv_a",     o.pv_a, 1);
  setText("m_pv_w",     o.pv_w, 0);
  setText("m_ts", now());

  /* mode badge */
  const mb = document.getElementById("modeBadge");
  const mi = document.getElementById("modeIcon");
  const mt = document.getElementById("modeText");
  if (mb && o.mode_name !== undefined) {
    const mc = String(o.mode_code || "S").toUpperCase();
    mb.className = `mode-badge mode-${mc}`;
    const icons = { P:"☀️", S:"🔋", B:"⚡", F:"⚠️", H:"🔌", L:"💡", D:"❌" };
    if (mi) mi.textContent = icons[mc] || "⚙";
    if (mt) mt.textContent = o.mode_name || mc;
  }

  /* flags */
  const flagsEl = document.getElementById("statusFlags");
  if (flagsEl && o.flags) {
    const f = o.flags;
    const items = [
      ["Load", f.load_on], ["Charging", f.charging], ["SCC Chg", f.scc_charging],
      ["AC Chg", f.ac_charging], ["Bat Steady", f.battery_steady], ["SBU Prio", f.sbu_priority],
    ];
    flagsEl.innerHTML = items.map(([n, v]) =>
      `<span class="flag-pill ${v ? "on" : "off"}">${n}</span>`).join("");
  }

  /* warnings */
  const wl = document.getElementById("warnList");
  const wc = document.getElementById("warnCount");
  if (wl) {
    const ws = Array.isArray(o.warnings) ? o.warnings : [];
    if (wc) { wc.textContent = ws.length; wc.className = "badge " + (ws.length ? "warn" : "ok"); }
    wl.innerHTML = ws.length
      ? ws.map(w => `<div class="warning-item">⚠ ${escapeHtml(w)}</div>`).join("")
      : `<div class="warning-item ok">✓ No active warnings</div>`;
  }

  /* update flow lines */
  updateFlowLines(o);

  /* refresh detail panel if node is selected */
  if (lastSelectedNode) showNodeDetail(lastSelectedNode, o, null);
}

/* ── BMS TELEMETRY ────────────────────────────────────────── */
function handleBmsTel(o) {
  bmsHasData = true;
  showBmsData(true);

  setText("b_pack_v",    o.pack_v, 2);
  setText("b_current",   o.current, 2);
  setText("b_soc",       o.soc, 0);
  setText("b_soh",       o.soh, 0);
  setText("b_cap_left",  o.cap_left, 1);
  setText("b_energy_left", o.energy_left, 2);
  setText("b_cycles",    o.cycles);
  setText("b_min_cv",    o.min_cell_v, 3);
  setText("b_max_cv",    o.max_cell_v, 3);
  setText("b_min_t",     o.min_temp, 1);
  setText("b_max_t",     o.max_temp, 1);
  setText("b_mos_t",     o.mos_temp, 1);
  setText("b_amb_t",     o.amb_temp, 1);
  setText("b_cell_count", o.cell_count);

  /* delta */
  if (o.min_cell_v != null && o.max_cell_v != null) {
    setText("b_delta", ((o.max_cell_v - o.min_cell_v) * 1000).toFixed(0));
  }

  /* state */
  if (o.flags) {
    const f = o.flags;
    const stParts = [];
    if (f.ca_on) stParts.push("Charging");
    if (f.load)  stParts.push("Load");
    if (f.balancing) stParts.push("Balancing");
    setEl("b_state", stParts.length ? stParts.join(" | ") : "Idle");

    /* flags bar */
    const bfl = document.getElementById("bmsFlags");
    if (bfl) {
      const items = [
        ["CA", f.ca_on], ["Load", f.load], ["Bal", f.balancing], ["MOSFET", !f.mosfet_fail]
      ];
      bfl.innerHTML = items.map(([n, v]) =>
        `<span class="flag-pill ${v ? "on" : "off"}">${n}</span>`).join("");
    }
  }

  /* cell voltages */
  const bCells = document.getElementById("bCells");
  if (bCells && Array.isArray(o.cell_v) && o.cell_v.length) {
    const min = Math.min(...o.cell_v), max = Math.max(...o.cell_v);
    const rng = max - min || 0.001;
    bCells.innerHTML = o.cell_v.map((v, i) => {
      const pct  = ((v - min) / rng * 100).toFixed(0);
      const warn = v < 3.0 || v > 3.65;
      return `<div class="bms-cell">
        <span class="cnum">C${i + 1}</span>
        <span class="cval">${v.toFixed(3)} V</span>
        <div class="cbar"><div class="cbar-fill ${warn ? "warn" : ""}" style="width:${pct}%"></div></div>
      </div>`;
    }).join("");
  }

  /* cell temperatures */
  const bTemps = document.getElementById("bTemps");
  if (bTemps && Array.isArray(o.cell_t) && o.cell_t.length) {
    const min = Math.min(...o.cell_t), max = Math.max(...o.cell_t);
    const rng = max - min || 1;
    bTemps.innerHTML = o.cell_t.map((t, i) => {
      const pct  = ((t - min) / rng * 100).toFixed(0);
      const hot  = t > 45;
      return `<div class="bms-cell">
        <span class="cnum">T${i + 1}</span>
        <span class="cval">${t.toFixed(1)} °C</span>
        <div class="cbar"><div class="cbar-fill ${hot ? "hot" : ""}" style="width:${Math.max(pct, 5)}%"></div></div>
      </div>`;
    }).join("");
  }

  /* frame count */
  const fc = document.getElementById("bmsFrameCount");
  if (fc) fc.textContent = String(parseInt(fc.textContent || "0") + 1);
}

/* ── DASHBOARD SHOW/HIDE ──────────────────────────────────── */
function showDashData(show) {
  const overlay = document.getElementById("dashNoData");
  const data    = document.getElementById("dashData");
  if (overlay) overlay.style.display = show ? "none" : "";
  if (data)    data.style.display    = show ? "" : "none";
}

function showBmsData(show) {
  const overlay = document.getElementById("bmsNoData");
  const data    = document.getElementById("bmsData");
  if (overlay) overlay.style.display = show ? "none" : "";
  if (data)    data.style.display    = show ? "" : "none";
}

/* ── FLOW LINES ───────────────────────────────────────────── */
function updateFlowLines(o) {
  const pvLine   = document.getElementById("flowLinePv");
  const gridLine = document.getElementById("flowLineGrid");
  const batLine  = document.getElementById("flowLineBat");
  const homeLine = document.getElementById("flowLineHome");

  const pvActive   = (o.pv_w || 0) > 5;
  const gridActive = (o.grid_v || 0) > 50;
  const charging   = o.flags?.charging || o.flags?.scc_charging || o.flags?.ac_charging;
  const discharging= !charging;

  if (pvLine)   pvLine.className   = `flow-line ${pvActive ? "green active" : ""}`;
  if (gridLine) gridLine.className = `flow-line ${gridActive ? "blue active" : ""}`;
  if (batLine)  batLine.className  = `flow-line ${charging ? "green active" : discharging ? "amber active" : ""}`;
  if (homeLine) homeLine.className = `flow-line active`;
}

/* ── FLOW NODE DETAIL ─────────────────────────────────────── */
function showNodeDetail(node, inv, bms) {
  lastSelectedNode = node;
  const title = document.getElementById("flowDetailsTitle");
  const grid  = document.getElementById("flowDetailsGrid");
  if (!title || !grid) return;

  document.querySelectorAll(".flow-node").forEach(n =>
    n.classList.toggle("selected", n.dataset.node === node));

  let items = [];
  switch (node) {
    case "pv":
      title.textContent = "Solar PV";
      items = [["Power", fmt(inv?.pv_w, 0) + " W"], ["Voltage", fmt(inv?.pv_v, 1) + " V"], ["Current", fmt(inv?.pv_a, 1) + " A"]];
      break;
    case "grid":
      title.textContent = "Grid Input";
      items = [["Voltage", fmt(inv?.grid_v, 1) + " V"], ["Frequency", fmt(inv?.grid_hz, 1) + " Hz"]];
      break;
    case "inverter":
      title.textContent = "Inverter";
      items = [["Mode", inv?.mode_name || "—"], ["Load", fmt(inv?.load_pct, 0) + "%"],
               ["Output", fmt(inv?.out_w, 0) + " W / " + fmt(inv?.out_va, 0) + " VA"],
               ["Bus V", fmt(inv?.bus_v, 1) + " V"], ["Temp", fmt(inv?.inv_temp, 1) + " °C"]];
      break;
    case "battery":
      title.textContent = "Battery";
      items = [["Voltage", fmt(inv?.bat_v, 1) + " V"], ["SOC", fmt(inv?.bat_soc, 0) + "%"],
               ["Charge", fmt(inv?.bat_chg_a, 1) + " A"], ["Discharge", fmt(inv?.bat_dis_a, 1) + " A"],
               ["SCC V", fmt(inv?.bat_scc_v, 1) + " V"]];
      break;
    case "home":
      title.textContent = "Home Load";
      items = [["Output W", fmt(inv?.out_w, 0) + " W"], ["Output VA", fmt(inv?.out_va, 0) + " VA"],
               ["Load %", fmt(inv?.load_pct, 0) + "%"], ["Out V", fmt(inv?.out_v, 1) + " V"]];
      break;
  }
  grid.innerHTML = items.map(([l, v]) =>
    `<div class="detail-item"><div class="dl">${l}</div><div class="dv">${v}</div></div>`).join("");
}

/* ── CONSOLE HELPER ───────────────────────────────────────── */
function appendConsole(el, text, cls = "") {
  if (!el) return;
  if (el.querySelector('[style*="color:var(--text-muted)"]')) el.innerHTML = "";
  const d = document.createElement("div");
  d.className = `line ${cls}`.trim();
  d.innerHTML = `<span class="ts">${now()}</span>${escapeHtml(text)}`;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}

function addCmdHistory(cmd, resp, ok) {
  cmdHistory.unshift({ cmd, resp, ok, ts: now() });
  if (cmdHistory.length > 50) cmdHistory.pop();
  renderCmdHistory();
}

function renderCmdHistory() {
  if (!cmdHistoryEl) return;
  cmdHistoryEl.innerHTML = cmdHistory.map(h =>
    `<div class="line ${h.ok ? "ok" : "err"}"><span class="ts">${h.ts}</span>${escapeHtml(h.cmd)} => ${escapeHtml(h.resp)}</div>`
  ).join("");
}

/* ── REFRESH / PING ───────────────────────────────────────── */
async function refreshNow() {
  try {
    await writeLine("PING");
    await writeLine("STATUS");
    await writeLine("TEL");
    await writeLine("BMS");
  } catch (e) {
    log(`Refresh failed: ${e.message}`, "err");
  }
}

/* ── INV COMMANDS ─────────────────────────────────────────── */
async function sendInvCmd(cmd) {
  if (!cmd) return;
  try {
    log(`TX: INV ${cmd}`);
    await writeLine(`INV ${cmd}`);
  } catch (e) {
    log(`Send failed: ${e.message}`, "err");
  }
}

async function sendInvCustom() {
  const input = document.getElementById("invCmdInput");
  const cmd = (input?.value || "").trim();
  if (!cmd) return;
  await sendInvCmd(cmd);
}

/* ── BMS COMMANDS ─────────────────────────────────────────── */
async function sendBmsAsciiCmd() {
  const input = document.getElementById("bmsAsciiInput");
  const cmd = (input?.value || "#H0").trim();
  if (!cmd) return;
  try {
    log(`TX: BMSASCII ${cmd}`);
    await writeLine(`BMSASCII ${cmd}`);
  } catch (e) {
    log(`BMS ASCII failed: ${e.message}`, "err");
    appendConsole(bmsCmdResp, `Error: ${e.message}`, "err");
  }
}

async function sendBmsHexCmd() {
  const input = document.getElementById("bmsHexInput");
  const cmd = (input?.value || "").trim();
  if (!cmd) return;
  try {
    log(`TX: BMSHEX ${cmd}`);
    await writeLine(`BMSHEX ${cmd}`);
  } catch (e) {
    log(`BMS HEX failed: ${e.message}`, "err");
    appendConsole(bmsCmdResp, `Error: ${e.message}`, "err");
  }
}

async function manualBmsQuery() {
  try {
    await writeLine("BMSASCII #H0");
  } catch (e) {
    log(`BMS query failed: ${e.message}`, "err");
  }
}

/* ── TOGGLE POLLING ───────────────────────────────────────── */
async function toggleInvPoll() {
  invPolling = !invPolling;
  try { await writeLine(`SET POLL ${invPolling ? 1 : 0}`); } catch (e) { log(e.message, "err"); }
}

async function toggleBmsPoll() {
  bmsPolling = !bmsPolling;
  try {
    await writeLine(`SET BMSPOLL ${bmsPolling ? 1 : 0}`);
    const btn = document.getElementById("bmsPollBtn");
    if (btn) btn.textContent = bmsPolling ? "⏸ Auto-Poll ON" : "▶ Auto-Poll OFF";
  } catch (e) { log(e.message, "err"); }
}

/* ── OPEN SOFTAP ──────────────────────────────────────────── */
function openSoftap() { window.open(SOFTAP_URL, "_blank"); }

/* ── PWA INSTALL ──────────────────────────────────────────── */
function setupPwaInstall() {
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBtn) installBtn.hidden = false;
  });
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installBtn.hidden = true;
    });
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(err =>
      log(`SW registration failed: ${err.message}`, "warn"));
  }
}

/* ── FLOW NODE CLICK ──────────────────────────────────────── */
document.querySelectorAll(".flow-node").forEach(node => {
  node.addEventListener("click", () => showNodeDetail(node.dataset.node, null, null));
});

/* ── WIRE UP BUTTONS ──────────────────────────────────────── */
connectBtn?.addEventListener("click", connectBle);
document.getElementById("connectBtn2")?.addEventListener("click", connectBle);
document.getElementById("softapBtn")?.addEventListener("click", openSoftap);
document.getElementById("refreshBtn")?.addEventListener("click", () => refreshNow());

/* ── INIT ─────────────────────────────────────────────────── */
setConnectedState(false);
showDashData(false);
showBmsData(false);
setupPwaInstall();
log("Open this page on HTTPS (GitHub Pages) and click Connect BLE.", "info");
log("No internet? Connect to ESP Wi-Fi then open http://192.168.4.1", "info");
