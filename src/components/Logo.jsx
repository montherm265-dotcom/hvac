import React from 'react';

export default function Logo({ size = 22, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-bold ${className}`} style={{ fontSize: size }}>
      <span
        className="flex items-center justify-center rounded-lg bg-accent text-white"
        style={{ width: size * 1.3, height: size * 1.3 }}
      >
        <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.65, height: size * 0.65 }}>
          <circle cx="12" cy="7" r="3.4" fill="currentColor" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      </span>
      HUMAN
    </span>
  );
}
