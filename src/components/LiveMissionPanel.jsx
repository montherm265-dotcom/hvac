import React, { useEffect, useRef, useState } from 'react';
import { Radio, Send, HandHelping } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { goLive, endLive } from '@/lib/streamProvider';
import { track } from '@/lib/analytics';

// The livestream belongs to the Mission: this panel lives inside
// MissionDetail rather than a standalone "live" page, and every action here
// (Go Live, chat, "I CAN HELP") writes to Mission-scoped tables
// (live_sessions/live_chat_messages/live_join_requests — see
// supabase/migrations/0004_live_missions.sql), not a generic stream object.
//
// Viewer presence uses Supabase Realtime Presence directly (real today, no
// external provider needed). Playback and the RTMP ingest URL come from
// Cloudflare Stream via the create-live-stream Edge Function; if that isn't
// configured, "Go Live" says so plainly instead of pretending to start.
export default function LiveMissionPanel({ mission, liveSession, isHost, isMember, onChange }) {
  const { user } = useAuth();
  const [starting, setStarting] = useState(false);
  const [notConfiguredMessage, setNotConfiguredMessage] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [pendingHelpRequests, setPendingHelpRequests] = useState([]);
  const [helpMessage, setHelpMessage] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!liveSession) return;
    let active = true;

    supabase.from('live_chat_messages').select('*, profiles(display_name)').eq('live_session_id', liveSession.id).order('created_at')
      .then(({ data }) => { if (active) setChatMessages(data ?? []); });

    if (isHost) {
      supabase.from('live_join_requests').select('*, profiles(display_name, username)').eq('live_session_id', liveSession.id).eq('status', 'pending')
        .then(({ data }) => { if (active) setPendingHelpRequests(data ?? []); });
    }

    const presenceChannel = supabase.channel(`live_presence:${liveSession.id}`, { config: { presence: { key: user.id } } });
    presenceChannel
      .on('presence', { event: 'sync' }, () => setViewerCount(Object.keys(presenceChannel.presenceState()).length))
      .subscribe((status) => { if (status === 'SUBSCRIBED') presenceChannel.track({ user_id: user.id }); });

    const chatChannel = supabase.channel(`live_chat:${liveSession.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `live_session_id=eq.${liveSession.id}` }, (payload) => {
        setChatMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [liveSession?.id, isHost, user.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  async function handleGoLive() {
    setStarting(true);
    setNotConfiguredMessage(null);
    const result = await goLive(mission.id);
    setStarting(false);
    if (!result.ok) {
      if (result.reason === 'not_configured') setNotConfiguredMessage(result.message);
      else setNotConfiguredMessage(`Couldn't go live: ${result.message}`);
      return;
    }
    onChange();
  }

  async function handleEndLive() {
    await endLive(liveSession.id);
    onChange();
  }

  async function handleSendChat(e) {
    e.preventDefault();
    const body = chatDraft.trim();
    if (!body) return;
    setChatDraft('');
    const { data, error } = await supabase.from('live_chat_messages').insert({ live_session_id: liveSession.id, sender_id: user.id, body }).select().single();
    if (!error) setChatMessages((prev) => [...prev, data]);
  }

  async function handleRequestToHelp(e) {
    e.preventDefault();
    await supabase.rpc('request_to_help_live', { p_live_session_id: liveSession.id, p_message: helpMessage || null });
    setHelpMessage('');
    track('viewer_became_participant', { mission_id: mission.id, stage: 'requested' });
  }

  async function respondToHelp(requestId, accept) {
    await supabase.rpc('respond_to_live_join_request', { p_request_id: requestId, p_accept: accept });
    setPendingHelpRequests((prev) => prev.filter((r) => r.id !== requestId));
    onChange();
  }

  if (!liveSession) {
    if (!isHost) return null;
    return (
      <div className="card-soft mt-6 p-5">
        <p className="text-sm font-medium">Go live on this Mission</p>
        <p className="mt-1 text-sm text-muted-foreground">Viewers can watch, chat, and ask to help in real time.</p>
        {notConfiguredMessage && <p className="mt-2 text-sm text-amber-700">{notConfiguredMessage}</p>}
        <button type="button" disabled={starting} onClick={handleGoLive} className="btn-primary mt-3">
          <Radio className="h-4 w-4" /> {starting ? 'Starting…' : 'Go Live'}
        </button>
      </div>
    );
  }

  return (
    <div className="card-soft mt-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="badge bg-red-100 text-red-700"><Radio className="h-3 w-3 animate-pulse" /> LIVE · {viewerCount} watching</span>
        {isHost && <button type="button" onClick={handleEndLive} className="text-xs font-medium text-danger">End live</button>}
      </div>

      {liveSession.playback_url ? (
        <video controls autoPlay muted playsInline className="aspect-video w-full bg-black" src={liveSession.playback_url} />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-primary text-sm text-primary-foreground">
          {isHost ? 'Waiting for your stream to connect…' : 'Stream starting…'}
        </div>
      )}

      <div className="grid gap-0 border-t border-border sm:grid-cols-2">
        <div className="flex max-h-72 flex-col border-b border-border p-4 sm:border-b-0 sm:border-r">
          <div className="flex-1 space-y-2 overflow-y-auto">
            {chatMessages.map((m) => (
              <p key={m.id} className="text-sm"><strong>{m.profiles?.display_name ?? 'Someone'}:</strong> {m.body}</p>
            ))}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleSendChat} className="mt-2 flex gap-2">
            <input className="input-soft" placeholder="Say something…" value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} />
            <button type="submit" className="btn-outline" aria-label="Send"><Send className="h-4 w-4" /></button>
          </form>
        </div>

        <div className="p-4">
          {isHost ? (
            <>
              <p className="text-sm font-medium">People asking to help</p>
              <ul className="mt-2 space-y-2">
                {pendingHelpRequests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{r.profiles?.display_name}{r.message ? `: “${r.message}”` : ''}</span>
                    <span className="flex gap-1">
                      <button type="button" onClick={() => respondToHelp(r.id, true)} className="text-xs font-medium text-accent">Accept</button>
                      <button type="button" onClick={() => respondToHelp(r.id, false)} className="text-xs text-muted-foreground">Decline</button>
                    </span>
                  </li>
                ))}
                {pendingHelpRequests.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
              </ul>
            </>
          ) : !isMember ? (
            <form onSubmit={handleRequestToHelp}>
              <p className="text-sm font-medium">Can you help right now?</p>
              <input className="input-soft mt-2" placeholder="Optional note to the host" value={helpMessage} onChange={(e) => setHelpMessage(e.target.value)} />
              <button type="submit" className="btn-primary mt-2 w-full"><HandHelping className="h-4 w-4" /> I CAN HELP</button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">You're already part of this Mission's crew.</p>
          )}
        </div>
      </div>
    </div>
  );
}
