import { supabase } from '@/lib/supabaseClient';

// Live-streaming provider abstraction. HUMAN's own tables (live_sessions,
// live_session_hosts, live_chat_messages, live_join_requests — see
// supabase/migrations/0004_live_missions.sql) model the Mission-side state;
// the actual ingest/encode/deliver/record infrastructure is Cloudflare
// Stream, called only from the create-live-stream/end-live-stream Edge
// Functions (the API token never reaches the client). Both return HTTP 501
// with `error: 'not_configured'` when Cloudflare secrets aren't set — the
// UI surfaces that plainly rather than showing a "Go Live" button that
// silently does nothing.

export async function goLive(missionId) {
  const { data, error } = await supabase.functions.invoke('create-live-stream', { body: { mission_id: missionId } });
  if (error) {
    const body = await safeErrorBody(error);
    if (body?.error === 'not_configured') {
      return { ok: false, reason: 'not_configured', message: body.message };
    }
    return { ok: false, reason: 'error', message: body?.message ?? error.message };
  }
  return { ok: true, ...data };
}

export async function endLive(liveSessionId) {
  const { data, error } = await supabase.functions.invoke('end-live-stream', { body: { live_session_id: liveSessionId } });
  if (error) {
    const body = await safeErrorBody(error);
    return { ok: false, reason: body?.error === 'not_configured' ? 'not_configured' : 'error', message: body?.message ?? error.message };
  }
  return { ok: true, ...data };
}

async function safeErrorBody(error) {
  try {
    return await error.context.json();
  } catch {
    return null;
  }
}
