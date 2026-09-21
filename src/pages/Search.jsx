import React, { useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { track } from '@/lib/analytics';
import PersonCard from '@/components/PersonCard';
import MissionCard from '@/components/MissionCard';
import RequestCard from '@/components/RequestCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';

const TABS = ['people', 'missions', 'requests'];

export default function Search() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('people');
  const [results, setResults] = useState({ people: [], missions: [], requests: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);

    const [people, missions, requests] = await Promise.all([
      supabase.from('profiles').select('id, username, display_name, city').textSearch('search_vector', q, { type: 'websearch' }).limit(20),
      supabase.from('missions').select('*, categories(label)').textSearch('search_vector', q, { type: 'websearch' }).eq('visibility', 'public').limit(20),
      supabase.from('requests').select('*, categories(label)').textSearch('search_vector', q, { type: 'websearch' }).eq('visibility', 'public').limit(20),
    ]);

    setResults({ people: people.data ?? [], missions: missions.data ?? [], requests: requests.data ?? [] });
    setLoading(false);
    track('search_performed', { query: q });
  }

  const activeResults = results[tab];

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content">
        <h1 className="font-display text-3xl font-bold">Search HUMAN</h1>
        <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
          <input className="input-soft" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="People, Missions, or requests…" />
          <button type="submit" className="btn-primary"><SearchIcon className="h-4 w-4" /></button>
        </form>

        {searched && (
          <>
            <div className="mt-6 flex gap-1 border-b border-border">
              {TABS.map((t) => (
                <button
                  key={t} type="button" onClick={() => setTab(t)}
                  className={`px-3 py-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-accent text-accent' : 'text-muted-foreground'}`}
                >
                  {t} ({results[t].length})
                </button>
              ))}
            </div>

            <div className="mt-6">
              {loading ? <LoadingSpinner /> : activeResults.length === 0 ? (
                <EmptyState icon={SearchIcon} title="No results" description="Try different words." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tab === 'people' && activeResults.map((p) => <PersonCard key={p.id} profile={p} />)}
                  {tab === 'missions' && activeResults.map((m) => <MissionCard key={m.id} mission={m} />)}
                  {tab === 'requests' && activeResults.map((r) => <RequestCard key={r.id} request={r} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
