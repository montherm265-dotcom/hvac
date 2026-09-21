import React, { useState } from 'react';
import QRPreviewPanel from '@/components/QRPreviewPanel';

function buildVCard({ firstName, lastName, org, title, phone, email, website }) {
  if (!firstName && !lastName) return '';
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${lastName};${firstName};;;`,
    `FN:${firstName} ${lastName}`.trim(),
  ];
  if (org) lines.push(`ORG:${org}`);
  if (title) lines.push(`TITLE:${title}`);
  if (phone) lines.push(`TEL;TYPE=CELL:${phone}`);
  if (email) lines.push(`EMAIL:${email}`);
  if (website) lines.push(`URL:${website}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

export default function VcardQrCode() {
  const [form, setForm] = useState({ firstName: '', lastName: '', org: '', title: '', phone: '', email: '', website: '' });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const value = buildVCard(form);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        <input value={form.firstName} onChange={set('firstName')} placeholder="First name" className="input-soft" autoFocus />
        <input value={form.lastName} onChange={set('lastName')} placeholder="Last name" className="input-soft" />
        <input value={form.org} onChange={set('org')} placeholder="Company" className="input-soft col-span-2" />
        <input value={form.title} onChange={set('title')} placeholder="Job title" className="input-soft col-span-2" />
        <input value={form.phone} onChange={set('phone')} placeholder="Phone" className="input-soft col-span-2" />
        <input value={form.email} onChange={set('email')} type="email" placeholder="Email" className="input-soft col-span-2" />
        <input value={form.website} onChange={set('website')} placeholder="Website" className="input-soft col-span-2" />
      </div>
      <QRPreviewPanel value={value} />
    </div>
  );
}
