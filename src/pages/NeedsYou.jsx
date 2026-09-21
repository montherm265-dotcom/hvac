import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, HandHeart } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function NeedsYou() {
  const { profile } = useAuth();
  const [needs, setNeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc('get_matching_needs', { p_limit: 30 });
      if (!active) return;
      if (rpcError) setError(rpcError.message);
      else setNeeds(data ?? []);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content">
        <h1 className="font-display text-3xl font-bold">Needs You</h1>
        <p className="mt-2 text-muted-foreground">
          Missions with an open need that matches a skill on your profile{profile?.skills?.length ? '' : ' — add skills in Settings to see matches'}.
        </p>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
        ) : error ? (
          <p className="mt-8 text-sm text-danger">{error}</p>
        ) : needs.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">
            No matches right now. This is rule-based matching on your listed skills today — see the README roadmap for real semantic matching.
          </p>
        ) : (
          <ul className="mt-8 space-y-3">
            {needs.map((n) => (
              <li key={n.need_id}>
                <Link to={`/missions/${n.mission_id}`} className="card-soft flex items-center justify-between gap-3 p-4 hover:border-accent/40">
                  <div>
                    <p className="font-semibold">{n.mission_title}</p>
                    <p className="text-sm text-muted-foreground">Needs: {n.skill_needed}</p>
                  </div>
                  <span className="badge bg-accent/10 text-accent"><HandHeart className="h-3.5 w-3.5" /> matches "{n.matched_skill}"</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
