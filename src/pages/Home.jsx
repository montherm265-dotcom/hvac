import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import MissionCard from '@/components/MissionCard';
import BackendNotice from '@/components/BackendNotice';

const CATEGORIES = ['All', 'Community', 'Creative', 'Outdoors', 'Learning', 'Building', 'Sports', 'Volunteering'];

export default function Home() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      let query = supabase
        .from('missions')
        .select('*, mission_participants(count)')
        .eq('is_private', false)
        .in('state', ['planning', 'active', 'progress', 'near_completion'])
        .order('created_at', { ascending: false })
        .limit(30);

      if (category !== 'All') query = query.eq('category', category);

      const { data, error: queryError } = await query;
      if (!active) return;
      if (queryError) {
        setError(queryError.message);
      } else {
        setMissions((data ?? []).map((m) => ({ ...m, crew_count: m.mission_participants?.[0]?.count ?? 0 })));
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [category]);

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content">
        <div className="text-center">
          <span className="inline-block rounded-full bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent">Human Now</span>
          <h1 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Find the humans who make life happen
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Not a feed of posts — a live map of Missions people are running right now, and the humans still needed to make them happen.
          </p>
        </div>

        {!isSupabaseConfigured && <BackendNotice className="mx-auto mt-8 max-w-2xl" />}

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
          ) : error ? (
            <p className="mx-auto max-w-md text-center text-sm text-danger">{error}</p>
          ) : missions.length === 0 ? (
            <p className="mx-auto max-w-md text-center text-sm text-muted-foreground">No active missions yet in this category. Be the first — Ask Human.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {missions.map((mission) => <MissionCard key={mission.id} mission={mission} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
