import { supabase } from '@/lib/supabaseClient';

// Human matching/routing provider abstraction. Rule-based matching is the
// real, working default (public.run_matching_for_request() — exact
// skill/interest/location overlap, see 0008_functions_triggers.sql). The
// `semantic-match` Edge Function is the upgrade path: same output shape
// (rows in `matches`), scored by an LLM instead. It returns HTTP 501 when
// ANTHROPIC_API_KEY isn't configured, which we treat as "fall back", not an
// error — the caller always finds out which one actually ran.
export async function runMatching(requestId) {
  const semanticResult = await supabase.functions.invoke('semantic-match', { body: { request_id: requestId } });

  if (!semanticResult.error) {
    return { provider: 'semantic', matches: semanticResult.data?.matches ?? [] };
  }

  const { data: ruleBasedMatches, error: ruleBasedError } = await supabase.rpc('run_matching_for_request', { p_request_id: requestId });
  if (ruleBasedError) throw ruleBasedError;
  return { provider: 'rule_based', matches: ruleBasedMatches ?? [] };
}
