import React, { useState } from 'react';
import QRPreviewPanel from '@/components/QRPreviewPanel';

export default function SmsQrCode() {
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const value = number ? `SMSTO:${number}:${message}` : '';

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Phone number</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+1 555 123 4567" className="input-soft" autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Message (optional)</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="input-soft" />
        </div>
      </div>
      <QRPreviewPanel value={value} />
    </div>
  );
}
