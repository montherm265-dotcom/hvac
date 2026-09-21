// Creates the real Cloudflare Stream live input for a Mission's live
// session, then calls public.mark_live_session_live() with the resulting
// ids. HUMAN's product layer (viewers, chat, "I CAN HELP", mission
// timeline) is built against live_sessions/live_session_hosts/etc — this
// function is the one place that talks to the streaming provider, so
// swapping providers later means rewriting this file, not the product.
//
// Real when CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_STREAM_API_TOKEN are set as
// Edge Function secrets. Returns 501 with an honest "not configured" body
// otherwise — the frontend disables "Go Live" and says why, rather than
// showing a button that does nothing.
//
// Deploy: `supabase functions deploy create-live-stream`

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const CF_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const CF_API_TOKEN = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN');
const CF_CUSTOMER_CODE = Deno.env.get('CLOUDFLARE_STREAM_CUSTOMER_CODE'); // subdomain code for playback URLs
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    return new Response(
      JSON.stringify({
        error: 'not_configured',
        message: 'Live Missions require CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN as Edge Function secrets.',
      }),
      { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });

  const { mission_id } = await req.json();
  if (!mission_id) return new Response(JSON.stringify({ error: 'mission_id is required' }), { status: 400, headers: corsHeaders });

  // Runs as the caller so start_live_session() enforces "creator or co_host only".
  const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: liveSession, error: sessionError } = await callerClient.rpc('start_live_session', { p_mission_id: mission_id });
  if (sessionError) return new Response(JSON.stringify({ error: sessionError.message }), { status: 403, headers: corsHeaders });

  const cfResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/live_inputs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      meta: { name: `mission-${mission_id}` },
      recording: { mode: 'automatic', timeoutSeconds: 60 },
    }),
  });

  if (!cfResponse.ok) {
    const body = await cfResponse.text();
    return new Response(JSON.stringify({ error: 'stream_provider_error', detail: body }), { status: 502, headers: corsHeaders });
  }

  const cfJson = await cfResponse.json();
  const liveInput = cfJson.result;

  const playbackUrl = CF_CUSTOMER_CODE ? `https://customer-${CF_CUSTOMER_CODE}.cloudflarestream.com/${liveInput.uid}/manifest/video.m3u8` : null;

  // Service-role client to write provider ids back regardless of who's calling.
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: updated, error: markError } = await serviceClient.rpc('mark_live_session_live', {
    p_live_session_id: liveSession.id,
    p_provider_stream_id: liveInput.uid,
    p_provider_playback_id: liveInput.uid,
    p_playback_url: playbackUrl,
  });
  if (markError) return new Response(JSON.stringify({ error: markError.message }), { status: 500, headers: corsHeaders });

  return new Response(
    JSON.stringify({
      live_session: updated,
      ingest: { rtmps_url: liveInput.rtmps?.url, rtmps_stream_key: liveInput.rtmps?.streamKey, webrtc_url: liveInput.webRTC?.url },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
