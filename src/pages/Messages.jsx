import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('conversation_participants')
        .select('conversation_id, conversations(id, is_group, mission_id, missions(title)), last_read_at')
        .eq('user_id', user.id);

      const conversationIds = (data ?? []).map((row) => row.conversation_id);
      let others = {};
      if (conversationIds.length > 0) {
        const { data: otherRows } = await supabase
          .from('conversation_participants')
          .select('conversation_id, profiles(username, display_name)')
          .in('conversation_id', conversationIds)
          .neq('user_id', user.id);
        others = Object.fromEntries((otherRows ?? []).map((r) => [r.conversation_id, r.profiles]));
      }

      if (!active) return;
      setConversations((data ?? []).map((row) => ({ ...row, other: others[row.conversation_id] })));
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [user.id]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-2xl font-bold">Messages</h1>
        <ul className="mt-6 space-y-2">
          {conversations.map((c) => (
            <li key={c.conversation_id}>
              <Link to={`/messages/${c.conversation_id}`} className="card-soft flex items-center gap-3 p-4 hover:border-accent/40">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                  {(c.other?.display_name || c.conversations?.missions?.title || '?').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="font-medium">{c.other?.display_name || c.conversations?.missions?.title || 'Mission chat'}</p>
                  {c.conversations?.missions?.title && c.other && (
                    <p className="text-xs text-muted-foreground">re: {c.conversations.missions.title}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
          {conversations.length === 0 && (
            <p className="text-sm text-muted-foreground">No conversations yet. Message a mission creator to start one.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
