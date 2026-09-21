import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, MessageCircle, Plus, Menu, X } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`;

export default function Navbar() {
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!session || !isSupabaseConfigured) return;
    let active = true;

    async function loadUnread() {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false);
      if (active) setUnreadCount(count ?? 0);
    }
    loadUnread();

    const channel = supabase
      .channel(`notifications:${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, loadUnread)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [session]);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link to="/"><Logo /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/" className={navLinkClass} end>Human Now</NavLink>
            {session && <NavLink to="/needs-you" className={navLinkClass}>Needs You</NavLink>}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {session ? (
            <>
              <Link to="/missions/new" className="btn-primary hidden sm:inline-flex">
                <Plus className="h-4 w-4" /> Ask Human
              </Link>
              <Link to="/notifications" className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link to="/messages" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Messages">
                <MessageCircle className="h-5 w-5" />
              </Link>
              <Link to={profile ? `/profile/${profile.username}` : '/settings'} className="hidden items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted sm:flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                  {(profile?.display_name || '?').slice(0, 1).toUpperCase()}
                </span>
              </Link>
              <button type="button" onClick={handleSignOut} className="btn-ghost hidden sm:inline-flex">Sign out</button>
              <button type="button" className="rounded-lg p-2 md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <>
              <Link to="/auth" className="btn-outline hidden sm:inline-flex">Sign in</Link>
              <Link to="/auth?mode=signup" className="btn-primary">Join HUMAN</Link>
            </>
          )}
        </div>
      </div>

      {menuOpen && session && (
        <div className="flex flex-col gap-1 border-t border-border px-4 py-3 md:hidden">
          <NavLink to="/" onClick={() => setMenuOpen(false)} className={navLinkClass} end>Human Now</NavLink>
          <NavLink to="/needs-you" onClick={() => setMenuOpen(false)} className={navLinkClass}>Needs You</NavLink>
          <NavLink to="/missions/new" onClick={() => setMenuOpen(false)} className={navLinkClass}>Ask Human</NavLink>
          <NavLink to={profile ? `/profile/${profile.username}` : '/settings'} onClick={() => setMenuOpen(false)} className={navLinkClass}>Profile</NavLink>
          <button type="button" onClick={handleSignOut} className="btn-ghost mt-1 justify-start">Sign out</button>
        </div>
      )}
    </header>
  );
}
