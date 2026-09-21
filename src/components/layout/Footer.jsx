import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-content flex-col items-center gap-3 px-4 py-10 text-center sm:px-6">
        <Logo size={18} />
        <p className="max-w-sm text-sm text-muted-foreground">
          Find the humans who make life happen. HUMAN is built around Missions — real things, done with real people — not feeds, likes, or followers.
        </p>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <Link to="/safety" className="hover:text-foreground">Trust &amp; Safety</Link>
          <Link to="/about" className="hover:text-foreground">About</Link>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} HUMAN. All rights reserved.</p>
      </div>
    </footer>
  );
}
