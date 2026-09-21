import { supabase } from '@/lib/supabaseClient';

// Thin wrapper around the log_analytics_event() RPC (see
// supabase/migrations/0008_functions_triggers.sql). Every event type here
// must be one of the values allowed by analytics_events' CHECK constraint —
// call sites are listed in README "Analytics events tracked".
export function track(eventType, payload = {}) {
  supabase.rpc('log_analytics_event', { p_event_type: eventType, p_payload: payload }).then(({ error }) => {
    if (error) console.warn('[analytics] failed to log', eventType, error.message);
  });
}
