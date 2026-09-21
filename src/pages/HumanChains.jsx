import React, { useEffect, useState } from 'react';
import { Link2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import PersonCard from '@/components/PersonCard';

export default function HumanChains() {
  const { user } = useAuth();
  const [connections, setConnections] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [relRes, suggestRes] = await Promise.all([
        supabase.from('relationships').select('*, a:profiles!user_a_id(id, username, display_name, city), b:profiles!user_b_id(id, username, display_name, city)')
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`).order('strength', { ascending: false }),
        supabase.rpc('get_human_chain_suggestions', { p_limit: 12 }),
      ]);
      if (!active) return;
      setConnections((relRes.data ?? []).map((r) => (r.user_a_id === user.id ? r.b : r.a)));
      setSuggestions(suggestRes.data ?? []);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [user.id]);

  if (loading) return <LoadingSpinner className="py-24" />;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content">
        <h1 className="font-display text-3xl font-bold">Human Chains</h1>
        <p className="mt-2 text-muted-foreground">
          HUMAN doesn't have "followers" — this is who you're actually connected to, formed by doing real things together.
        </p>

        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold"><Link2 className="mr-1.5 inline h-4 w-4" />Your connections ({connections.length})</h2>
          {connections.length === 0 ? (
            <EmptyState icon={Users} title="No connections yet" description="Join a Mission or accept a match and this fills in automatically." />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {connections.map((c) => <PersonCard key={c.id} profile={c} />)}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold">People you should meet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Connected through people you already know.</p>
          {suggestions.length === 0 ? (
            <EmptyState icon={Users} title="No suggestions yet" description="These appear once your network has a few shared connections." />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {suggestions.map((s) => (
                <PersonCard
                  key={s.candidate_id}
                  profile={{ username: s.username, display_name: s.display_name }}
                  trailing={<span className="badge bg-muted text-muted-foreground flex-none">{s.shared_connections} shared</span>}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
