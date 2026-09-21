import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-content items-center gap-6 px-4 sm:px-6">
        <Link to={user ? '/dashboard' : '/'}><Logo /></Link>
        {user && (
          <nav className="hidden items-center gap-1 sm:flex">
            <Link to="/dashboard" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Dashboard</Link>
            <Link to="/jobs" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Jobs</Link>
            <Link to="/customers" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Customers</Link>
            <Link to="/settings" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Settings</Link>
          </nav>
        )}
        <div className="ms-auto flex items-center gap-2">
          {user ? (
            <button onClick={logout} className="btn-ghost"><LogOut className="h-4 w-4" /> Sign out</button>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">Sign in</Link>
              <Link to="/register" className="btn-primary">Start free</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
