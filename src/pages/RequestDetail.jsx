import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import PersonCard from '@/components/PersonCard';

export default function RequestDetail() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [matches, setMatches] = useState([]);
  const [myMatch, setMyMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const isRequester = request?.requester_id === user?.id;

  const load = useCallback(async () => {
    setLoading(true);
    const { data: requestData, error: requestError } = await supabase
      .from('requests').select('*, categories(label)').eq('id', id).single();
    if (requestError) { setError(requestError.message); setLoading(false); return; }
    setRequest(requestData);

    if (requestData.requester_id === user?.id) {
      const { data: matchData } = await supabase
        .from('matches').select('*, profiles!candidate_id(username, display_name, city)')
        .eq('request_id', id).order('score', { ascending: false });
      setMatches(matchData ?? []);
    } else if (user?.id) {
      const { data: mine } = await supabase.from('matches').select('*').eq('request_id', id).eq('candidate_id', user.id).maybeSingle();
      setMyMatch(mine ?? null);
    }
    setLoading(false);
  }, [id, user?.id]);

  // Wait for auth to settle before deciding the requester/candidate/anon
  // branch above — this route has no RequireAuth gate (viewing a public
  // request doesn't require an account), so `user` legitimately starts
  // null and briefly stays null while the session restores.
  useEffect(() => { if (!authLoading) load(); }, [load, authLoading]);

  async function respond(accept) {
    setBusy(true);
    const { error: respondError } = await supabase.rpc('respond_to_match', { p_match_id: myMatch.id, p_accept: accept });
    setBusy(false);
    if (respondError) setError(respondError.message);
    else load();
  }

  async function handleConvert() {
    setBusy(true);
    const { data, error: convertError } = await supabase.rpc('convert_request_to_mission', { p_request_id: id });
    setBusy(false);
    if (convertError) setError(convertError.message);
    else navigate(`/missions/${data.id}`);
  }

  if (loading) return <LoadingSpinner className="py-24" />;
  if (error && !request) return <p className="section-pad text-center text-sm text-danger">{error}</p>;
  if (!request) return null;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-2xl">
        <span className="badge bg-accent/10 text-accent">{request.categories?.label ?? 'Request'}</span>
        <h1 className="mt-3 font-display text-2xl font-bold">{request.title}</h1>
        <p className="mt-3 whitespace-pre-wrap text-foreground/90">{request.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">Status: {request.status}{request.city ? ` · ${request.city}` : ''}</p>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        {isRequester ? (
          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold">People HUMAN found for this</h2>
            {matches.length === 0 ? (
              <EmptyState icon={Sparkles} title="Still searching" description="No matches yet — check back shortly, or try rephrasing your request with more detail." />
            ) : (
              <ul className="mt-4 space-y-2">
                {matches.map((m) => (
                  <li key={m.id}>
                    <PersonCard
                      profile={m.profiles}
                      trailing={<span className="badge bg-muted text-muted-foreground flex-none">{m.status}</span>}
                    />
                  </li>
                ))}
              </ul>
            )}
            {request.status !== 'closed' && (
              <button type="button" disabled={busy} onClick={handleConvert} className="btn-outline mt-6 w-full">
                This needs ongoing help — turn it into a Mission
              </button>
            )}
          </section>
        ) : myMatch ? (
          <section className="mt-8 card-soft p-5">
            <p className="text-sm">HUMAN thinks you might be able to help with this.</p>
            {myMatch.status === 'suggested' ? (
              <div className="mt-4 flex gap-2">
                <button type="button" disabled={busy} onClick={() => respond(true)} className="btn-primary flex-1">I can help</button>
                <button type="button" disabled={busy} onClick={() => respond(false)} className="btn-outline flex-1">Not for me</button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">You already responded: {myMatch.status}.</p>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
