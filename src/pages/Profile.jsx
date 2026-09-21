import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MapPin, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import MissionCard from '@/components/MissionCard';
import ReportButton from '@/components/ReportButton';

export default function Profile() {
  const { username } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles').select('*').eq('username', username).maybeSingle();
      if (!active) return;
      if (profileError || !profileData) {
        setError('Profile not found');
        setLoading(false);
        return;
      }
      setProfile(profileData);

      const { data: missionData } = await supabase
        .from('missions').select('*').eq('creator_id', profileData.id).eq('is_private', false)
        .order('created_at', { ascending: false });
      setMissions(missionData ?? []);

      if (user && user.id !== profileData.id) {
        const { data: blockRow } = await supabase
          .from('blocks').select('blocked_id').eq('blocker_id', user.id).eq('blocked_id', profileData.id).maybeSingle();
        setIsBlocked(Boolean(blockRow));
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [username, user]);

  async function toggleBlock() {
    if (!profile || !user) return;
    if (isBlocked) {
      await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', profile.id);
      setIsBlocked(false);
    } else {
      await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: profile.id });
      setIsBlocked(true);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;
  if (error) return <p className="section-pad text-center text-sm text-danger">{error}</p>;

  const isSelf = user?.id === profile.id;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-white">
              {profile.display_name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold">{profile.display_name}</h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              {profile.city && <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{profile.city}</p>}
            </div>
          </div>
          {!isSelf && user && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleBlock} className="btn-outline text-xs">
                {isBlocked ? 'Unblock' : 'Block'}
              </button>
              <ReportButton targetType="user" targetId={profile.id} />
            </div>
          )}
        </div>

        {profile.bio && <p className="mt-4 max-w-xl text-foreground/90">{profile.bio}</p>}

        {profile.skills?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {profile.skills.map((s) => <span key={s} className="badge bg-accent/10 text-accent">{s}</span>)}
          </div>
        )}

        <h2 className="mt-10 font-display text-lg font-semibold">Missions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {missions.map((m) => <MissionCard key={m.id} mission={m} />)}
          {missions.length === 0 && <p className="text-sm text-muted-foreground">No public missions yet.</p>}
        </div>

        {!isSelf && (
          <p className="mt-10 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" /> See something wrong? Use Block or Report above.
          </p>
        )}
      </div>
    </div>
  );
}
