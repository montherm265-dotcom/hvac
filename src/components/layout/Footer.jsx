import React from 'react';
import Logo from '@/components/Logo';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-content flex-col items-center gap-3 px-4 py-10 text-center sm:px-6">
        <Logo size={18} />
        <p className="max-w-sm text-sm text-muted-foreground">Free QR codes and barcodes, generated entirely in your browser. No sign-up, no watermark, no expiring codes.</p>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} QRForge. All rights reserved.</p>
      </div>
    </footer>
  );
}
