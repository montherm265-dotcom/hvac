import React from 'react';
import { QrCode } from 'lucide-react';

export default function Logo({ size = 22, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-bold ${className}`} style={{ fontSize: size }}>
      <span className="flex items-center justify-center rounded-lg bg-primary text-white" style={{ width: size * 1.3, height: size * 1.3 }}>
        <QrCode style={{ width: size * 0.68, height: size * 0.68 }} />
      </span>
      QRForge
    </span>
  );
}
