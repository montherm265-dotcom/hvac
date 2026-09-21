import React, { useState } from 'react';
import QRPreviewPanel from '@/components/QRPreviewPanel';

export default function PhoneQrCode() {
  const [number, setNumber] = useState('');
  const value = number ? `tel:${number.replace(/[^\d+]/g, '')}` : '';

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Phone number</label>
        <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+1 555 123 4567" className="input-soft" autoFocus />
        <p className="mt-2 text-xs text-muted-foreground">Scanning this prompts the phone to call the number.</p>
      </div>
      <QRPreviewPanel value={value} />
    </div>
  );
}
