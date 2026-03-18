const SERVICE_UUID = 0xFFF0;
const CMD_CHAR_UUID = 0xFFF1;
const TX_CHAR_UUID = 0xFFF2;
const DEVICE_NAME_PREFIX = "SOLAR_ESP";
const SOFTAP_URL = "http://192.168.4.1";

let device = null;
let server = null;
let cmdChar = null;
let txChar = null;
let connected = false;
let invPolling = true;
let bmsPolling = true;
let rxBuffer = "";
let pollTimer = null;
let deferredInstallPrompt = null;

const logEl = document.getElementById("log");
const connectBtn = document.getElementById("connectBtn");
const installBtn = document.getElementById("installBtn");
const softapBtn = document.getElementById("softapBtn");

const ui = {
  chipBle: document.getElementById("chipBle"),
  chipInv: document.getElementById("chipInv"),
  chipBms: document.getElementById("chipBms"),
  chipPoll: document.getElementById("chipPoll"),
  modeName: document.getElementById("modeName"),
  modeCode: document.getElementById("modeCode"),
  outW: document.getElementById("outW"),
  loadPct: document.getElementById("loadPct"),
  batV: document.getElementById("batV"),
  batSoc: document.getElementById("batSoc"),
  pvW: document.getElementById("pvW"),
  pvV: document.getElementById("pvV"),
  pvA: document.getElementById("pvA"),
  gridV: document.getElementById("gridV"),
  gridHz: document.getElementById("gridHz"),
  bmsPackV: document.getElementById("bmsPackV"),
  bmsSoc: document.getElementById("bmsSoc"),
  bmsCurrent: document.getElementById("bmsCurrent"),
};

function now() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[s]));
}

function log(text, cls = "") {
  const line = document.createElement("div");
  line.className = `line ${cls}`.trim();
  line.innerHTML = `<span class="ts">${now()}</span>${escapeHtml(text)}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function setConnectedState(isConnected) {
  connected = isConnected;
  connectBtn.textContent = connected ? "Disconnect BLE" : "Connect BLE";
  ui.chipBle.textContent = connected ? "BLE: Connected" : "BLE: Disconnected";
  ui.chipBle.style.color = connected ? "#22c55e" : "#a7b6d4";
}

function setText(el, val, decimals = null) {
  if (!el) return;
  if (val === null || val === undefined || Number.isNaN(Number(val))) {
    el.textContent = "--";
    return;
  }
  if (decimals === null) el.textContent = String(val);
  else el.textContent = Number(val).toFixed(decimals);
}

async function writeLine(line) {
  if (!cmdChar) throw new Error("BLE not connected");
  const data = new TextEncoder().encode(`${line}\n`);
  const chunkSize = 18; /* safe for low-MTU links */
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (cmdChar.writeValueWithoutResponse) await cmdChar.writeValueWithoutResponse(chunk);
    else await cmdChar.writeValue(chunk);
  }
}

function startAutoPolling() {
  stopAutoPolling();
  pollTimer = setInterval(async () => {
    if (!connected) return;
    try {
      await writeLine("STATUS");
      await writeLine("TEL");
      await writeLine("BMS");
    } catch (e) {
      log(`Poll failed: ${e.message}`, "err");
    }
  }, 1200);
}

function stopAutoPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function handleLine(line) {
  if (!line.trim()) return;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    log(`RX: ${line}`);
    return;
  }

  switch (obj.type) {
    case "status":
      ui.chipInv.textContent = `Inverter: ${obj.connected ? "Online" : "Offline"}`;
      ui.chipBms.textContent = `BMS: ${obj.bms_connected ? "Online" : "Offline"}`;
      invPolling = !!obj.polling;
      bmsPolling = !!obj.bms_polling;
      ui.chipPoll.textContent = `Auto Poll: INV ${invPolling ? "ON" : "OFF"} | BMS ${bmsPolling ? "ON" : "OFF"}`;
      break;
    case "telemetry_inv":
      setText(ui.modeName, obj.mode_name);
      setText(ui.modeCode, obj.mode_code);
      setText(ui.outW, obj.out_w, 0);
      setText(ui.loadPct, obj.load_pct, 0);
      setText(ui.batV, obj.bat_v, 1);
      setText(ui.batSoc, obj.bat_soc, 0);
      setText(ui.pvW, obj.pv_w, 0);
      setText(ui.pvV, obj.pv_v, 1);
      setText(ui.pvA, obj.pv_a, 1);
      setText(ui.gridV, obj.grid_v, 1);
      setText(ui.gridHz, obj.grid_hz, 1);
      break;
    case "telemetry_bms":
      setText(ui.bmsPackV, obj.pack_v, 2);
      setText(ui.bmsSoc, obj.soc, 0);
      setText(ui.bmsCurrent, obj.current, 2);
      break;
    case "inv_resp":
      log(`INV ${obj.cmd} => ${obj.success ? obj.raw : `ERROR ${obj.raw}`}`, obj.success ? "ok" : "err");
      break;
    case "bms_resp":
      log(`BMS ${obj.mode} => ${obj.success ? obj.resp_hex : `ERROR ${obj.error || "failed"}`}`, obj.success ? "ok" : "err");
      break;
    case "error":
      log(`ERR: ${obj.message}`, "err");
      break;
    case "pong":
      log("PONG", "ok");
      break;
    default:
      log(`RX JSON: ${line}`);
      break;
  }
}

function onTxChanged(event) {
  const dv = event.target.value;
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  const chunk = new TextDecoder().decode(bytes);
  rxBuffer += chunk;
  let idx = rxBuffer.indexOf("\n");
  while (idx >= 0) {
    const line = rxBuffer.slice(0, idx);
    rxBuffer = rxBuffer.slice(idx + 1);
    handleLine(line);
    idx = rxBuffer.indexOf("\n");
  }
}

function onDisconnected() {
  log("BLE disconnected", "warn");
  setConnectedState(false);
  stopAutoPolling();
  device = null;
  server = null;
  cmdChar = null;
  txChar = null;
}

async function connectBle() {
  if (connected && device?.gatt?.connected) {
    device.gatt.disconnect();
    return;
  }
  if (!navigator.bluetooth) {
    alert("Web Bluetooth is not available in this browser. Use Chrome/Edge.");
    return;
  }

  connectBtn.disabled = true;
  try {
    log("Searching BLE devices...");
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });
    device.addEventListener("gattserverdisconnected", onDisconnected);

    server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    cmdChar = await service.getCharacteristic(CMD_CHAR_UUID);
    txChar = await service.getCharacteristic(TX_CHAR_UUID);
    await txChar.startNotifications();
    txChar.addEventListener("characteristicvaluechanged", onTxChanged);

    setConnectedState(true);
    log(`Connected to ${device.name || "BLE device"} (passkey may be requested)`, "ok");
    await refreshNow();
    startAutoPolling();
  } catch (e) {
    log(`Connect failed: ${e.message}`, "err");
    onDisconnected();
  } finally {
    connectBtn.disabled = false;
  }
}

async function sendInv(rawOverride = null) {
  const input = document.getElementById("invInput");
  const cmd = (rawOverride || input.value || "").trim();
  if (!cmd) return;
  try {
    await writeLine(`INV ${cmd}`);
  } catch (e) {
    log(`Send INV failed: ${e.message}`, "err");
  }
}

async function sendBmsAscii(rawOverride = null) {
  const input = document.getElementById("bmsAsciiInput");
  const cmd = (rawOverride || input.value || "").trim();
  if (!cmd) return;
  try {
    await writeLine(`BMSASCII ${cmd}`);
  } catch (e) {
    log(`Send BMS ASCII failed: ${e.message}`, "err");
  }
}

async function sendBmsHex() {
  const input = document.getElementById("bmsHexInput");
  const cmd = input.value.trim();
  if (!cmd) return;
  try {
    await writeLine(`BMSHEX ${cmd}`);
  } catch (e) {
    log(`Send BMS HEX failed: ${e.message}`, "err");
  }
}

async function toggleInvPoll() {
  invPolling = !invPolling;
  await writeLine(`SET POLL ${invPolling ? 1 : 0}`);
}

async function toggleBmsPoll() {
  bmsPolling = !bmsPolling;
  await writeLine(`SET BMSPOLL ${bmsPolling ? 1 : 0}`);
}

async function refreshNow() {
  await writeLine("PING");
  await writeLine("STATUS");
  await writeLine("TEL");
  await writeLine("BMS");
}

function openSoftap() {
  window.open(SOFTAP_URL, "_blank");
}

function setupPwaInstall() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      log(`Service worker registration failed: ${err.message}`, "warn");
    });
  }
}

document.getElementById("connectBtn").addEventListener("click", connectBle);
document.getElementById("invSendBtn").addEventListener("click", () => sendInv().catch((e) => log(e.message, "err")));
document.getElementById("bmsAsciiBtn").addEventListener("click", () => sendBmsAscii().catch((e) => log(e.message, "err")));
document.getElementById("bmsHexBtn").addEventListener("click", () => sendBmsHex().catch((e) => log(e.message, "err")));
document.getElementById("toggleInvPollBtn").addEventListener("click", () => toggleInvPoll().catch((e) => log(e.message, "err")));
document.getElementById("toggleBmsPollBtn").addEventListener("click", () => toggleBmsPoll().catch((e) => log(e.message, "err")));
document.getElementById("refreshBtn").addEventListener("click", () => refreshNow().catch((e) => log(e.message, "err")));
document.getElementById("quickQpigsBtn").addEventListener("click", () => sendInv("QPIGS").catch((e) => log(e.message, "err")));
document.getElementById("quickQmodBtn").addEventListener("click", () => sendInv("QMOD").catch((e) => log(e.message, "err")));
document.getElementById("quickBmsBtn").addEventListener("click", () => sendBmsAscii("#H0").catch((e) => log(e.message, "err")));
softapBtn.addEventListener("click", openSoftap);

setConnectedState(false);
setupPwaInstall();
log("Open this page on HTTPS (GitHub Pages) and click Connect BLE.");
log("No internet fallback: connect to ESP Wi-Fi and open http://192.168.4.1");
