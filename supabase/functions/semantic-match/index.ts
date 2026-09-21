// Semantic matching for Ask Human requests. Upgrades on
// public.run_matching_for_request()'s rule-based (keyword/skill overlap)
// scoring by asking a real LLM to reason about fit — lived experience,
// phrasing, implicit intent — across the candidate pool.
//
// Real when ANTHROPIC_API_KEY is set as a Supabase Edge Function secret
// (`supabase secrets set ANTHROPIC_API_KEY=...`); the key never reaches the
// client. Returns 501 with a clear, honest "not configured" body otherwise
// — the frontend (src/lib/matchingProvider.js) falls back to the rule-based
// RPC and labels the result as such rather than pretending this ran.
//
// Deploy: `supabase functions deploy semantic-match`

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CandidateSummary {
  candidate_id: string;
  display_name: string;
  bio: string | null;
  city: string | null;
  skills: string[];
  interests: string[];
  lived_experiences: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        error: 'not_configured',
        message: 'Semantic matching requires ANTHROPIC_API_KEY to be set as an Edge Function secret. Falling back to rule-based matching.',
      }),
      { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const { request_id } = await req.json();
  if (!request_id) {
    return new Response(JSON.stringify({ error: 'request_id is required' }), { status: 400, headers: corsHeaders });
  }

  // A client-scoped client (caller's own JWT) to verify they own the request —
  // RLS still applies to this client, so it can only see what they can see.
  const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: request, error: requestError } = await callerClient
    .from('requests')
    .select('id, requester_id, title, description, city, location_scope, category_id, categories(label)')
    .eq('id', request_id)
    .single();

  if (requestError || !request) {
    return new Response(JSON.stringify({ error: 'request not found or not visible to caller' }), { status: 404, headers: corsHeaders });
  }

  const { data: authResult } = await callerClient.auth.getUser();
  if (!authResult?.user || authResult.user.id !== request.requester_id) {
    return new Response(JSON.stringify({ error: 'only the requester can trigger matching' }), { status: 403, headers: corsHeaders });
  }

  // Service-role client for the privileged, cross-user reads/writes below —
  // this function is the trust boundary, not RLS, for this one operation.
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: candidates, error: candidatesError } = await serviceClient
    .from('profiles')
    .select(`
      id, display_name, bio, city,
      privacy_settings!inner(allow_matching),
      profile_skills(mode, skills(label)),
      profile_interests(interests(label)),
      lived_experiences(category, title, is_public)
    `)
    .eq('privacy_settings.allow_matching', true)
    .eq('status', 'active')
    .neq('id', request.requester_id)
    .limit(50);

  if (candidatesError) {
    return new Response(JSON.stringify({ error: candidatesError.message }), { status: 500, headers: corsHeaders });
  }

  const summaries: CandidateSummary[] = (candidates ?? []).map((c: any) => ({
    candidate_id: c.id,
    display_name: c.display_name,
    bio: c.bio,
    city: c.city,
    skills: (c.profile_skills ?? []).filter((ps: any) => ps.mode !== 'want_to_learn').map((ps: any) => ps.skills?.label).filter(Boolean),
    interests: (c.profile_interests ?? []).map((pi: any) => pi.interests?.label).filter(Boolean),
    lived_experiences: (c.lived_experiences ?? []).filter((le: any) => le.is_public).map((le: any) => `${le.category}: ${le.title}`),
  }));

  if (summaries.length === 0) {
    return new Response(JSON.stringify({ matches: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const prompt = `You are HUMAN's matching engine. A person asked for help:

Title: ${request.title}
Description: ${request.description}
Location: ${request.city ?? 'unspecified'} (scope: ${request.location_scope})
Category: ${(request as any).categories?.label ?? 'uncategorized'}

Here are candidate humans who might be able to help, as JSON:
${JSON.stringify(summaries, null, 2)}

Return ONLY a JSON array (no prose, no markdown fences) of the best matches, each shaped as:
{"candidate_id": "...", "score": 0.0-1.0, "reason": "one short sentence explaining the fit"}

Include at most 8 candidates, only those genuinely relevant (score >= 0.3), ordered best first.`;

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!anthropicResponse.ok) {
    const body = await anthropicResponse.text();
    return new Response(JSON.stringify({ error: 'llm_provider_error', detail: body }), { status: 502, headers: corsHeaders });
  }

  const anthropicJson = await anthropicResponse.json();
  const rawText = anthropicJson.content?.[0]?.text ?? '[]';

  let ranked: Array<{ candidate_id: string; score: number; reason: string }>;
  try {
    ranked = JSON.parse(rawText.trim());
  } catch {
    return new Response(JSON.stringify({ error: 'llm_returned_unparseable_output', raw: rawText }), { status: 502, headers: corsHeaders });
  }

  const rows = ranked
    .filter((r) => summaries.some((s) => s.candidate_id === r.candidate_id))
    .map((r) => ({
      request_id: request.id,
      candidate_id: r.candidate_id,
      score: Math.min(1, Math.max(0, r.score)),
      reason: { scored_by: 'semantic_v1', explanation: r.reason },
      algorithm: 'semantic',
    }));

  const { data: inserted, error: insertError } = await serviceClient
    .from('matches')
    .upsert(rows, { onConflict: 'request_id,candidate_id' })
    .select();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ matches: inserted }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
