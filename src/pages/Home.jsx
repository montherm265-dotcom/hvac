import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n';
import MissionCard from '@/components/MissionCard';
import RequestCard from '@/components/RequestCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import BackendNotice from '@/components/BackendNotice';

export default function Home() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [missions, setMissions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [category, setCategory] = useState('All');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.from('categories').select('id, slug, label').order('label').then(({ data }) => setCategories(data ?? []));
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);

      let missionQuery = supabase
        .from('missions')
        .select('*, categories(label), mission_members(count)')
        .eq('visibility', 'public')
        .in('state', ['planning', 'active', 'progress', 'near_completion'])
        .order('created_at', { ascending: false })
        .limit(24);
      if (category !== 'All') missionQuery = missionQuery.eq('category_id', category);

      const [missionRes, requestRes] = await Promise.all([
        missionQuery,
        supabase.from('requests').select('*, categories(label)').eq('visibility', 'public').eq('status', 'open').order('created_at', { ascending: false }).limit(6),
      ]);
      if (!active) return;

      if (missionRes.error) {
        setError(missionRes.error.message);
        setLoading(false);
        return;
      }

      const missionIds = (missionRes.data ?? []).map((m) => m.id);
      const { data: liveRows } = missionIds.length
        ? await supabase.from('live_sessions').select('mission_id').eq('status', 'live').in('mission_id', missionIds)
        : { data: [] };
      const liveMissionIds = new Set((liveRows ?? []).map((r) => r.mission_id));

      setMissions((missionRes.data ?? []).map((m) => ({
        ...m, crew_count: m.mission_members?.[0]?.count ?? 0, is_live: liveMissionIds.has(m.id),
      })).sort((a, b) => (b.is_live ? 1 : 0) - (a.is_live ? 1 : 0)));
      setRequests(requestRes.data ?? []);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [category]);

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content text-center">
        <span className="inline-block rounded-full bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent">{t('home.tag')}</span>
        <h1 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">{t('home.title')}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{t('home.subtitle')}</p>
        {!user && (
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/ask" className="btn-primary">Ask Human</Link>
            <Link to="/auth?mode=signup" className="btn-outline">Join HUMAN</Link>
          </div>
        )}
      </div>

      {!isSupabaseConfigured && <BackendNotice className="mx-auto mt-8 max-w-2xl" />}

      {requests.length > 0 && (
        <div className="mx-auto mt-12 max-w-content">
          <h2 className="font-display text-lg font-semibold">Someone needs a human right now</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {requests.map((r) => <RequestCard key={r.id} request={r} />)}
          </div>
        </div>
      )}

      <div className="mx-auto mt-12 max-w-content">
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => setCategory('All')} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${category === 'All' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>All</button>
          {categories.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${category === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {loading ? <LoadingSpinner /> : error ? (
            <p className="mx-auto max-w-md text-center text-sm text-danger">{error}</p>
          ) : missions.length === 0 ? (
            <p className="mx-auto max-w-md text-center text-sm text-muted-foreground">No active missions yet in this category. Be the first — start one.</p>
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
