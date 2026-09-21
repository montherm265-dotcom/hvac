import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HandHeart, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';

export default function NeedsYou() {
  const { profile, user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [matchesRes, needsRes] = await Promise.all([
        supabase.from('matches').select('*, requests(id, title, description)').eq('candidate_id', user.id).eq('status', 'suggested').order('score', { ascending: false }),
        supabase.rpc('get_matching_needs', { p_limit: 30 }),
      ]);
      if (!active) return;
      if (matchesRes.error || needsRes.error) setError(matchesRes.error?.message ?? needsRes.error?.message);
      setMatches(matchesRes.data ?? []);
      setNeeds(needsRes.data ?? []);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  if (loading) return <LoadingSpinner className="py-24" />;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content">
        <h1 className="font-display text-3xl font-bold">Needs You</h1>
        <p className="mt-2 text-muted-foreground">
          Real asks routed to you by HUMAN's matching engine, plus open Mission needs matching your skills
          {profile?.bio ? '' : ' — add skills in Settings to see more'}.
        </p>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Someone might need exactly you</h2>
          {matches.length === 0 ? (
            <EmptyState icon={Sparkles} title="No routed requests right now" description="When someone asks for help that fits your profile, it'll show up here." />
          ) : (
            <ul className="mt-4 space-y-2">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link to={`/requests/${m.requests.id}`} className="card-soft flex items-center justify-between gap-3 p-4 hover:border-accent/40">
                    <div>
                      <p className="font-semibold">{m.requests.title}</p>
                      <p className="line-clamp-1 text-sm text-muted-foreground">{m.requests.description}</p>
                    </div>
                    <span className="badge bg-accent/10 text-accent flex-none">{Math.round(m.score * 100)}% fit</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold">Missions with an open need matching your skills</h2>
          {needs.length === 0 ? (
            <EmptyState icon={HandHeart} title="No matching needs" description="List skills in Settings and this fills up as Missions post needs." />
          ) : (
            <ul className="mt-4 space-y-2">
              {needs.map((n) => (
                <li key={n.need_id}>
                  <Link to={`/missions/${n.mission_id}`} className="card-soft flex items-center justify-between gap-3 p-4 hover:border-accent/40">
                    <div>
                      <p className="font-semibold">{n.mission_title}</p>
                      <p className="text-sm text-muted-foreground">Needs: {n.skill_label}</p>
                    </div>
                    <HandHeart className="h-4 w-4 flex-none text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
