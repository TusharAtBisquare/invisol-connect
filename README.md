# INVISOL_app (Production Web Dashboard)

This app supports both:
- BLE cloud page mode (GitHub Pages / HTTPS)
- SoftAP local mode (`http://192.168.4.1`)

BLE mode supports:
- Auto live telemetry (`TEL`, `BMS`, `STATUS`)
- Inverter command send (`INV <command>`)
- BMS ASCII/HEX command send

## 1. Firmware prerequisites

The ESP firmware in `main/main.c` now includes a BLE GATT bridge with:
- Device name: `SOLAR_ESP`
- Service UUID: `0xFFF0`
- Command characteristic (write): `0xFFF1`
- Stream characteristic (notify): `0xFFF2`
- Static passkey: `123456` (BLE passkeys are 6 digits)

Build-time note:
- BLE code is compiled only when `CONFIG_BT_ENABLED=y`.
- If BLE is disabled, firmware logs: `BLE bridge disabled at build-time`.

## 2. Local run (PC)

Web Bluetooth needs secure context:
- `https://...` OR
- `http://localhost...`

From this folder:

```powershell
cd c:\Users\Aexzone\solar_esp\INVISOL_app
python -m http.server 5500
```

Then open:
- `http://localhost:5500` in Chrome/Edge

## 3. Hosted production run (GitHub Pages)

Use the workflow in `.github/workflows/pages.yml`.
After push to `main`, Pages will publish from `INVISOL_app`.

Final URL format:
- `https://<your-username>.github.io/<repo-name>/`

## 4. Connect and use

1. Click **Connect BLE**
2. Select `SOLAR_ESP`
3. Enter passkey `123456` when prompted
4. Live data starts automatically

Fallback without internet:
1. Connect phone/laptop to ESP Wi-Fi AP
2. Open `http://192.168.4.1`
3. Use the embedded dashboard over SoftAP

## 5. BLE text protocol used

App writes line-based commands:
- `PING`
- `STATUS`
- `TEL`
- `BMS`
- `INV QPIGS` (example)
- `BMSASCII #H0`
- `BMSHEX 02 06 9B C5 00 10`
- `SET POLL 1|0`
- `SET BMSPOLL 1|0`

ESP notifies JSON lines (`\n` delimited), e.g.:
- `{"type":"telemetry_inv",...}`
- `{"type":"telemetry_bms",...}`
- `{"type":"inv_resp",...}`
- `{"type":"bms_resp",...}`
