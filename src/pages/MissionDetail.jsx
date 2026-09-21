import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, MapPin, CheckCircle2, Circle, Users, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import StateBadge from '@/components/StateBadge';
import { nextStates, stateMeta } from '@/lib/missionState';

export default function MissionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mission, setMission] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMilestone, setNewMilestone] = useState('');
  const [newNeed, setNewNeed] = useState('');
  const [newMoment, setNewMoment] = useState('');
  const [busy, setBusy] = useState(false);

  const isParticipant = participants.some((p) => p.user_id === user?.id);
  const isCreator = mission?.creator_id === user?.id;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [missionRes, participantsRes, milestonesRes, needsRes, momentsRes] = await Promise.all([
      supabase.from('missions').select('*').eq('id', id).single(),
      supabase.from('mission_participants').select('*, profiles(username, display_name, avatar_url)').eq('mission_id', id),
      supabase.from('mission_milestones').select('*').eq('mission_id', id).order('position'),
      supabase.from('mission_needs').select('*').eq('mission_id', id).order('created_at'),
      supabase.from('moments').select('*, profiles(username, display_name)').eq('mission_id', id).order('created_at', { ascending: false }),
    ]);

    if (missionRes.error) {
      setError(missionRes.error.message);
      setLoading(false);
      return;
    }
    setMission(missionRes.data);
    setParticipants(participantsRes.data ?? []);
    setMilestones(milestonesRes.data ?? []);
    setNeeds(needsRes.data ?? []);
    setMoments(momentsRes.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleJoin() {
    setBusy(true);
    const { error: joinError } = await supabase.rpc('join_mission', { p_mission_id: id });
    setBusy(false);
    if (joinError) setError(joinError.message);
    else load();
  }

  async function handleLeave() {
    setBusy(true);
    await supabase.rpc('leave_mission', { p_mission_id: id });
    setBusy(false);
    load();
  }

  async function handleStateChange(newState) {
    setBusy(true);
    const { error: stateError } = await supabase.rpc('set_mission_state', { p_mission_id: id, p_new_state: newState });
    setBusy(false);
    if (stateError) setError(stateError.message);
    else load();
  }

  async function handleAddMilestone(e) {
    e.preventDefault();
    if (!newMilestone.trim()) return;
    await supabase.from('mission_milestones').insert({
      mission_id: id, title: newMilestone.trim(), position: milestones.length,
    });
    setNewMilestone('');
    load();
  }

  async function handleCompleteMilestone(milestoneId) {
    await supabase.rpc('complete_milestone', { p_milestone_id: milestoneId });
    load();
  }

  async function handleAddNeed(e) {
    e.preventDefault();
    if (!newNeed.trim()) return;
    await supabase.from('mission_needs').insert({ mission_id: id, skill_needed: newNeed.trim() });
    setNewNeed('');
    load();
  }

  async function handleAddMoment(e) {
    e.preventDefault();
    if (!newMoment.trim()) return;
    await supabase.from('moments').insert({ mission_id: id, author_id: user.id, body: newMoment.trim() });
    setNewMoment('');
    load();
  }

  async function handleMessageCreator() {
    const { data, error: convError } = await supabase.rpc('get_or_create_direct_conversation', { p_other_user_id: mission.creator_id });
    if (convError) { setError(convError.message); return; }
    navigate(`/messages/${data}`);
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;
  if (error && !mission) return <p className="section-pad text-center text-sm text-danger">{error}</p>;
  if (!mission) return null;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content grid gap-8 lg:grid-cols-[2fr,1fr]">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-3xl font-bold">{mission.title}</h1>
            <StateBadge state={mission.state} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="badge bg-muted text-muted-foreground">{mission.category}</span>
            {mission.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{mission.city}</span>}
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{participants.length} crew</span>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-foreground/90">{mission.description}</p>

          {isCreator && nextStates(mission.state).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {nextStates(mission.state).map((s) => (
                <button key={s} type="button" disabled={busy} onClick={() => handleStateChange(s)} className="btn-outline text-xs">
                  Move to {stateMeta(s).label}
                </button>
              ))}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          {/* Milestones */}
          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold">Milestones</h2>
            <ul className="mt-3 space-y-2">
              {milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                  <button
                    type="button"
                    disabled={m.is_done || !isParticipant}
                    onClick={() => handleCompleteMilestone(m.id)}
                    aria-label="Complete milestone"
                  >
                    {m.is_done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  <span className={m.is_done ? 'text-muted-foreground line-through' : ''}>{m.title}</span>
                </li>
              ))}
              {milestones.length === 0 && <p className="text-sm text-muted-foreground">No milestones yet.</p>}
            </ul>
            {isParticipant && (
              <form onSubmit={handleAddMilestone} className="mt-3 flex gap-2">
                <input className="input-soft" placeholder="Add a milestone" value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} />
                <button type="submit" className="btn-outline">Add</button>
              </form>
            )}
          </section>

          {/* Moments */}
          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold">Moments</h2>
            {isParticipant && (
              <form onSubmit={handleAddMoment} className="mt-3 flex gap-2">
                <input className="input-soft" placeholder="Share a progress update" value={newMoment} onChange={(e) => setNewMoment(e.target.value)} />
                <button type="submit" className="btn-outline">Post</button>
              </form>
            )}
            <ul className="mt-4 space-y-3">
              {moments.map((m) => (
                <li key={m.id} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-sm">{m.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.profiles?.display_name ?? 'Someone'} · {new Date(m.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
              {moments.length === 0 && <p className="text-sm text-muted-foreground">No moments yet — the first update starts the story.</p>}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="card-soft p-5">
            {!isParticipant ? (
              <button type="button" disabled={busy} onClick={handleJoin} className="btn-primary w-full">Join this Mission</button>
            ) : !isCreator ? (
              <button type="button" disabled={busy} onClick={handleLeave} className="btn-outline w-full">Leave Mission</button>
            ) : (
              <p className="text-center text-sm text-muted-foreground">You created this mission</p>
            )}
            {!isCreator && (
              <button type="button" onClick={handleMessageCreator} className="btn-outline mt-2 w-full">
                <MessageCircle className="h-4 w-4" /> Message creator
              </button>
            )}
          </div>

          <div className="card-soft p-5">
            <h3 className="font-display text-sm font-semibold">Crew ({participants.length})</h3>
            <ul className="mt-3 space-y-2">
              {participants.map((p) => (
                <li key={p.user_id}>
                  <Link to={`/profile/${p.profiles?.username}`} className="flex items-center gap-2 text-sm hover:text-accent">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                      {(p.profiles?.display_name || '?').slice(0, 1).toUpperCase()}
                    </span>
                    {p.profiles?.display_name} {p.role === 'creator' && <span className="text-xs text-muted-foreground">(creator)</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-soft p-5">
            <h3 className="font-display text-sm font-semibold">Needs You</h3>
            <ul className="mt-3 space-y-1.5">
              {needs.map((n) => (
                <li key={n.id} className={`text-sm ${n.is_filled ? 'text-muted-foreground line-through' : ''}`}>{n.skill_needed}</li>
              ))}
              {needs.length === 0 && <p className="text-sm text-muted-foreground">No open needs.</p>}
            </ul>
            {isCreator && (
              <form onSubmit={handleAddNeed} className="mt-3 flex gap-2">
                <input className="input-soft" placeholder="Skill needed" value={newNeed} onChange={(e) => setNewNeed(e.target.value)} />
                <button type="submit" className="btn-outline">Add</button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
