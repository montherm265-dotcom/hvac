import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapPin, CheckCircle2, Circle, Users, MessageCircle, Radio, HandHelping } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { track } from '@/lib/analytics';
import StateBadge from '@/components/StateBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import TaxonomyPicker from '@/components/TaxonomyPicker';
import LiveMissionPanel from '@/components/LiveMissionPanel';
import { nextStates, stateMeta } from '@/lib/missionState';

export default function MissionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mission, setMission] = useState(null);
  const [members, setMembers] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [moments, setMoments] = useState([]);
  const [events, setEvents] = useState([]);
  const [liveSession, setLiveSession] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMilestone, setNewMilestone] = useState('');
  const [newNeedSkill, setNewNeedSkill] = useState([]);
  const [newMoment, setNewMoment] = useState('');
  const [busy, setBusy] = useState(false);

  const isMember = members.some((m) => m.user_id === user?.id);
  const isCreator = mission?.creator_id === user?.id;
  const isHost = ['creator', 'co_host'].includes(members.find((m) => m.user_id === user?.id)?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [missionRes, membersRes, milestonesRes, needsRes, momentsRes, eventsRes, liveRes] = await Promise.all([
      supabase.from('missions').select('*, categories(label)').eq('id', id).single(),
      supabase.from('mission_members').select('*, profiles(username, display_name)').eq('mission_id', id).is('left_at', null),
      supabase.from('mission_milestones').select('*').eq('mission_id', id).order('position'),
      supabase.from('mission_needs').select('*, skills(id, label)').eq('mission_id', id).order('created_at'),
      supabase.from('moments').select('*, profiles(username, display_name)').eq('mission_id', id).order('created_at', { ascending: false }),
      supabase.from('mission_events').select('*, profiles(display_name)').eq('mission_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('live_sessions').select('*').eq('mission_id', id).in('status', ['idle', 'live']).maybeSingle(),
    ]);

    if (missionRes.error) { setError(missionRes.error.message); setLoading(false); return; }
    setMission(missionRes.data);
    setMembers(membersRes.data ?? []);
    setMilestones(milestonesRes.data ?? []);
    setNeeds(needsRes.data ?? []);
    setMoments(momentsRes.data ?? []);
    setEvents(eventsRes.data ?? []);
    setLiveSession(liveRes.data ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleJoin() {
    setBusy(true);
    const { error: joinError } = await supabase.rpc('join_mission', { p_mission_id: id });
    setBusy(false);
    if (joinError) setError(joinError.message);
    else { track('mission_joined', { mission_id: id }); load(); }
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
    await supabase.from('mission_milestones').insert({ mission_id: id, title: newMilestone.trim(), position: milestones.length });
    setNewMilestone('');
    load();
  }

  async function handleCompleteMilestone(milestoneId) {
    await supabase.rpc('complete_milestone', { p_milestone_id: milestoneId });
    track('milestone_completed', { mission_id: id, milestone_id: milestoneId });
    load();
  }

  async function handleAddNeed(e) {
    e.preventDefault();
    if (newNeedSkill.length === 0) return;
    await supabase.from('mission_needs').insert({ mission_id: id, skill_id: newNeedSkill[0].id });
    setNewNeedSkill([]);
    load();
  }

  async function handleClaimNeed(needId) {
    await supabase.from('mission_needs').update({ is_filled: true, filled_by: user.id }).eq('id', needId);
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

  if (loading) return <LoadingSpinner className="py-24" />;
  if (error && !mission) return <p className="section-pad text-center text-sm text-danger">{error}</p>;
  if (!mission) return null;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content grid gap-8 lg:grid-cols-[2fr,1fr]">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-3xl font-bold">{mission.title}</h1>
            <div className="flex flex-none flex-col items-end gap-1.5">
              {liveSession?.status === 'live' && <span className="badge bg-red-100 text-red-700"><Radio className="h-3 w-3 animate-pulse" /> LIVE</span>}
              <StateBadge state={mission.state} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {mission.categories?.label && <span className="badge bg-muted text-muted-foreground">{mission.categories.label}</span>}
            {mission.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{mission.city}</span>}
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{members.length} crew</span>
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

          <div className="mt-6 flex gap-1 border-b border-border">
            {['overview', 'timeline'].map((t) => (
              <button
                key={t} type="button" onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-accent text-accent' : 'text-muted-foreground'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            <>
              <LiveMissionPanel
                mission={mission} liveSession={liveSession} isHost={isHost} isMember={isMember}
                onChange={load}
              />

              <section className="mt-8">
                <h2 className="font-display text-lg font-semibold">Milestones</h2>
                <ul className="mt-3 space-y-2">
                  {milestones.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                      <button type="button" disabled={m.is_done || !isMember} onClick={() => handleCompleteMilestone(m.id)} aria-label="Complete milestone">
                        {m.is_done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <span className={m.is_done ? 'text-muted-foreground line-through' : ''}>{m.title}</span>
                    </li>
                  ))}
                  {milestones.length === 0 && <p className="text-sm text-muted-foreground">No milestones yet.</p>}
                </ul>
                {isMember && (
                  <form onSubmit={handleAddMilestone} className="mt-3 flex gap-2">
                    <input className="input-soft" placeholder="Add a milestone" value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} />
                    <button type="submit" className="btn-outline">Add</button>
                  </form>
                )}
              </section>

              <section className="mt-8">
                <h2 className="font-display text-lg font-semibold">Moments</h2>
                {isMember && (
                  <form onSubmit={handleAddMoment} className="mt-3 flex gap-2">
                    <input className="input-soft" placeholder="Share a progress update" value={newMoment} onChange={(e) => setNewMoment(e.target.value)} />
                    <button type="submit" className="btn-outline">Post</button>
                  </form>
                )}
                <ul className="mt-4 space-y-3">
                  {moments.map((m) => (
                    <li key={m.id} className="rounded-lg border border-border bg-card p-3">
                      <p className="text-sm">{m.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{m.profiles?.display_name ?? 'Someone'} · {new Date(m.created_at).toLocaleString()}</p>
                    </li>
                  ))}
                  {moments.length === 0 && <p className="text-sm text-muted-foreground">No moments yet — the first update starts the story.</p>}
                </ul>
              </section>
            </>
          ) : (
            <ul className="mt-6 space-y-3">
              {events.map((ev) => (
                <li key={ev.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                  <div>
                    <p><strong>{ev.profiles?.display_name ?? 'HUMAN'}</strong> · {ev.event_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
              {events.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
            </ul>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card-soft p-5">
            {!isMember ? (
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
            <h3 className="font-display text-sm font-semibold">Crew ({members.length})</h3>
            <ul className="mt-3 space-y-2">
              {members.map((m) => (
                <li key={m.user_id}>
                  <Link to={`/profile/${m.profiles?.username}`} className="flex items-center gap-2 text-sm hover:text-accent">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                      {(m.profiles?.display_name || '?').slice(0, 1).toUpperCase()}
                    </span>
                    {m.profiles?.display_name} {m.role !== 'crew' && <span className="text-xs text-muted-foreground">({m.role})</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-soft p-5">
            <h3 className="font-display text-sm font-semibold">Needs You</h3>
            <ul className="mt-3 space-y-1.5">
              {needs.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className={n.is_filled ? 'text-muted-foreground line-through' : ''}>{n.skills?.label}</span>
                  {!n.is_filled && isMember && !isCreator && (
                    <button type="button" onClick={() => handleClaimNeed(n.id)} className="text-xs font-medium text-accent">
                      <HandHelping className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {needs.length === 0 && <p className="text-sm text-muted-foreground">No open needs.</p>}
            </ul>
            {isCreator && (
              <form onSubmit={handleAddNeed} className="mt-3">
                <TaxonomyPicker table="skills" selected={newNeedSkill} onChange={(v) => setNewNeedSkill(v.slice(-1))} placeholder="Skill needed" />
                <button type="submit" className="btn-outline mt-2 w-full">Post need</button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
