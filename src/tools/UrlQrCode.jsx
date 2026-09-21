import React, { useState } from 'react';
import QRPreviewPanel from '@/components/QRPreviewPanel';

export default function UrlQrCode() {
  const [url, setUrl] = useState('');
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Website URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="input-soft" autoFocus />
        <p className="mt-2 text-xs text-muted-foreground">The QR code updates live as you type.</p>
      </div>
      <QRPreviewPanel value={url.trim()} />
    </div>
  );
}
