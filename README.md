# QRForge

Free QR code and barcode generator — URL, plain text, WiFi, email, SMS, vCard (contact), phone number QR codes, plus CODE128/EAN-13/UPC-A/CODE39 barcodes. Customizable colors, size, and error-correction level; download as PNG or SVG.

Every code is generated **entirely client-side** — no backend, no account, no expiring links, no watermark.

## Stack

React + Vite + Tailwind CSS, [`qrcode`](https://www.npmjs.com/package/qrcode) for QR encoding and [`jsbarcode`](https://www.npmjs.com/package/jsbarcode) for barcodes. No database, no API.

## Local setup

```bash
npm install
npm run dev
```

## Adding a new QR type

1. Add an entry to `src/lib/tools.js`.
2. Create `src/tools/YourType.jsx` — build the payload string for that QR type (see `WifiQrCode.jsx` for the most involved example, the `WIFI:` URI spec) and render `<QRPreviewPanel value={payload} />`, which owns rendering, color/size controls, and PNG/SVG export.
3. Register it in `src/pages/ToolPage.jsx`'s `COMPONENTS` map.

## Deploying

Static export — `npm run build` produces `dist/`, deployable to any static host with zero configuration.
