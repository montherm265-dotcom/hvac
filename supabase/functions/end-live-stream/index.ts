// Stops the Cloudflare Stream live input and records the resulting playback
// URL against the live_sessions row via public.end_live_session().
//
// Deploy: `supabase functions deploy end-live-stream`

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const CF_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const CF_API_TOKEN = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN');
const CF_CUSTOMER_CODE = Deno.env.get('CLOUDFLARE_STREAM_CUSTOMER_CODE');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'not_configured', message: 'Live Missions require Cloudflare Stream secrets — see create-live-stream.' }),
      { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });

  const { live_session_id } = await req.json();
  if (!live_session_id) return new Response(JSON.stringify({ error: 'live_session_id is required' }), { status: 400, headers: corsHeaders });

  const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: session, error: fetchError } = await callerClient
    .from('live_sessions')
    .select('id, provider_stream_id')
    .eq('id', live_session_id)
    .single();
  if (fetchError || !session) return new Response(JSON.stringify({ error: 'live session not found or not visible' }), { status: 404, headers: corsHeaders });

  if (session.provider_stream_id) {
    await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/live_inputs/${session.provider_stream_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
    });
  }

  const recordingUrl = CF_CUSTOMER_CODE && session.provider_stream_id
    ? `https://customer-${CF_CUSTOMER_CODE}.cloudflarestream.com/${session.provider_stream_id}/manifest/video.m3u8`
    : null;

  // Runs as the caller — end_live_session() itself enforces "host only".
  const { data: ended, error: endError } = await callerClient.rpc('end_live_session', {
    p_live_session_id: live_session_id,
    p_recording_url: recordingUrl,
  });
  if (endError) return new Response(JSON.stringify({ error: endError.message }), { status: 403, headers: corsHeaders });

  return new Response(JSON.stringify({ live_session: ended }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
