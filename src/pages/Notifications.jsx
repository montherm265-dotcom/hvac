import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

const LABELS = {
  mission_joined: (p) => `Someone joined your mission "${p.title}"`,
  mission_state_changed: (p) => `"${p.title}" moved to ${p.state.replace('_', ' ')}`,
  new_moment: () => 'New moment posted on a mission you\'re part of',
  new_message: () => 'New message',
  milestone_completed: (p) => `Milestone completed: ${p.title}`,
  need_matched: () => 'A mission matches your skills',
};

function linkFor(n) {
  if (n.payload?.mission_id) return `/missions/${n.payload.mission_id}`;
  if (n.payload?.conversation_id) return `/messages/${n.payload.conversation_id}`;
  return '#';
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!active) return;
      setNotifications(data ?? []);
      setLoading(false);
      const unreadIds = (data ?? []).filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length > 0) {
        await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
      }
    }
    load();
    return () => { active = false; };
  }, [user.id]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
        <ul className="mt-6 space-y-2">
          {notifications.map((n) => (
            <li key={n.id}>
              <Link
                to={linkFor(n)}
                className={`card-soft block p-4 text-sm hover:border-accent/40 ${n.is_read ? '' : 'bg-accent/5 font-medium'}`}
              >
                {(LABELS[n.type]?.(n.payload)) ?? n.type}
                <span className="mt-1 block text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
              </Link>
            </li>
          ))}
          {notifications.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
        </ul>
      </div>
    </div>
  );
}
