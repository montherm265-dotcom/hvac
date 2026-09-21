import React, { useState } from 'react';
import QRPreviewPanel from '@/components/QRPreviewPanel';

export default function TextQrCode() {
  const [text, setText] = useState('');
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Text</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Any text — a note, a code, a quote…" className="input-soft" autoFocus />
      </div>
      <QRPreviewPanel value={text} />
    </div>
  );
}
