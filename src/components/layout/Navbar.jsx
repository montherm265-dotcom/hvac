import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-content items-center px-4 sm:px-6">
        <Link to="/"><Logo /></Link>
      </div>
    </header>
  );
}
