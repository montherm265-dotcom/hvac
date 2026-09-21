import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Download } from 'lucide-react';

const FORMATS = [
  { value: 'CODE128', label: 'CODE128 (any text)' },
  { value: 'EAN13', label: 'EAN-13 (13 digits)' },
  { value: 'UPC', label: 'UPC-A (12 digits)' },
  { value: 'CODE39', label: 'CODE39' },
];

export default function BarcodeGenerator() {
  const canvasRef = useRef(null);
  const [value, setValue] = useState('123456789012');
  const [format, setFormat] = useState('CODE128');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!value) {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      return;
    }
    try {
      JsBarcode(canvasRef.current, value, { format, lineColor: '#1b2333', width: 2, height: 100, displayValue: true, margin: 12 });
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [value, format]);

  const downloadPng = () => {
    if (!value || error) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'barcode.png';
    a.click();
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="input-soft">
            {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Value</label>
          <input value={value} onChange={(e) => setValue(e.target.value)} className="input-soft" autoFocus />
        </div>
      </div>
      <div className="card-soft flex flex-col items-center p-5">
        <div className="flex min-h-[160px] w-full items-center justify-center overflow-x-auto rounded-xl border border-border bg-white p-3">
          {error ? <p className="px-4 text-center text-sm text-destructive">{error}</p> : <canvas ref={canvasRef} />}
        </div>
        <button onClick={downloadPng} disabled={!value || !!error} className="btn-primary mt-4 w-full"><Download className="h-4 w-4" /> Download PNG</button>
      </div>
    </div>
  );
}
