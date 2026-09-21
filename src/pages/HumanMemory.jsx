import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';

// A real personal timeline, built from the same rows that drive the rest of
// the product (reputation_events, relationships, mission_events) — not a
// separate "memories" feature with its own fake data.
export default function HumanMemory() {
  const { user } = useAuth();
  const { formatRelativeTime } = useI18n();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [reputationRes, relationshipsRes, momentsRes] = await Promise.all([
        supabase.from('reputation_events').select('*, missions(id, title)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('relationships').select('*, a:profiles!user_a_id(display_name), b:profiles!user_b_id(display_name)')
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(50),
        supabase.from('moments').select('id, body, created_at, mission_id, missions(title)').eq('author_id', user.id).order('created_at', { ascending: false }).limit(50),
      ]);
      if (!active) return;

      const combined = [
        ...(reputationRes.data ?? []).map((r) => ({
          type: 'reputation', at: r.created_at,
          label: reputationLabel(r), missionId: r.mission_id, missionTitle: r.missions?.title,
        })),
        ...(relationshipsRes.data ?? []).map((r) => ({
          type: 'relationship', at: r.created_at,
          label: `You connected with ${(r.user_a_id === user.id ? r.b : r.a)?.display_name ?? 'someone'}`,
        })),
        ...(momentsRes.data ?? []).map((m) => ({
          type: 'moment', at: m.created_at, label: `You posted: "${m.body}"`, missionId: m.mission_id, missionTitle: m.missions?.title,
        })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at));

      setEntries(combined);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [user.id]);

  if (loading) return <LoadingSpinner className="py-24" />;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-bold">Human Memory</h1>
        <p className="mt-2 text-muted-foreground">Everything you've actually done on HUMAN, in order.</p>

        {entries.length === 0 ? (
          <EmptyState icon={Clock} title="Nothing yet" description="Join a Mission or help someone, and it shows up here." />
        ) : (
          <ul className="mt-8 space-y-4">
            {entries.map((entry, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <div>
                  <p className="text-sm">
                    {entry.label}
                    {entry.missionId && <> · <Link to={`/missions/${entry.missionId}`} className="text-accent">{entry.missionTitle}</Link></>}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(entry.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function reputationLabel(event) {
  switch (event.event_type) {
    case 'mission_completed': return 'You completed a Mission';
    case 'milestone_completed': return 'You completed a milestone';
    case 'help_given': return 'You helped someone';
    case 'help_received': return 'Someone helped you';
    case 'peer_skill_verified': return 'A crewmate verified one of your skills';
    default: return event.event_type.replace(/_/g, ' ');
  }
}
