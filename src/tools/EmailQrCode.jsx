import React, { useState } from 'react';
import QRPreviewPanel from '@/components/QRPreviewPanel';

export default function EmailQrCode() {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const qs = params.toString();
  const value = to ? `mailto:${to}${qs ? `?${qs}` : ''}` : '';

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Recipient email</label>
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="hello@example.com" className="input-soft" autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Subject (optional)</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input-soft" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Message (optional)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="input-soft" />
        </div>
      </div>
      <QRPreviewPanel value={value} />
    </div>
  );
}
