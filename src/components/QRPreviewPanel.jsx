import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';

/**
 * Shared QR preview + customization + download panel. Every QR tool page
 * builds its own `value` string (the payload — a plain URL, a WIFI: URI, a
 * vCard blob, etc.) and hands it here; this component owns rendering and
 * exporting, so that logic exists exactly once.
 */
export default function QRPreviewPanel({ value }) {
  const canvasRef = useRef(null);
  const [fgColor, setFgColor] = useState('#1b2333');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [size, setSize] = useState(300);
  const [errorLevel, setErrorLevel] = useState('M');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!value) {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      return;
    }
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: errorLevel,
      color: { dark: fgColor, light: bgColor },
    }, (err) => setError(err ? err.message : ''));
  }, [value, fgColor, bgColor, size, errorLevel]);

  const download = (format) => {
    if (!value) return;
    if (format === 'png') {
      const url = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qr-code.png';
      a.click();
    } else {
      QRCode.toString(value, { type: 'svg', margin: 2, errorCorrectionLevel: errorLevel, color: { dark: fgColor, light: bgColor } }, (err, svg) => {
        if (err) return;
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'qr-code.svg';
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  };

  return (
    <div className="card-soft p-5">
      <div className="flex flex-col items-center">
        <div className="flex h-[240px] w-[240px] items-center justify-center rounded-xl border border-border bg-white p-3">
          {value ? <canvas ref={canvasRef} className="h-full w-full" /> : <p className="px-4 text-center text-sm text-muted-foreground">Fill in the fields to generate a QR code</p>}
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>

      <div className="mt-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Foreground</label>
            <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-lg border border-border" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Background</label>
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-lg border border-border" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Size: {size}px</label>
          <input type="range" min={150} max={600} step={10} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-accent" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Error correction</label>
          <select value={errorLevel} onChange={(e) => setErrorLevel(e.target.value)} className="input-soft">
            <option value="L">Low (~7%) — smallest code</option>
            <option value="M">Medium (~15%)</option>
            <option value="Q">Quartile (~25%)</option>
            <option value="H">High (~30%) — best if adding a logo</option>
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={() => download('png')} disabled={!value} className="btn-primary flex-1"><Download className="h-4 w-4" /> PNG</button>
          <button onClick={() => download('svg')} disabled={!value} className="btn-outline flex-1"><Download className="h-4 w-4" /> SVG</button>
        </div>
      </div>
    </div>
  );
}
