import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, ShieldAlert, ShieldCheck, Award } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import MissionCard from '@/components/MissionCard';
import ReportButton from '@/components/ReportButton';

export default function Profile() {
  const { username } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [interests, setInterests] = useState([]);
  const [livedExperiences, setLivedExperiences] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [reputation, setReputation] = useState(null);
  const [missions, setMissions] = useState([]);
  const [sharedCompletedMission, setSharedCompletedMission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [error, setError] = useState(null);
  const [verifyBusy, setVerifyBusy] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
      if (!active) return;
      if (profileError || !profileData) { setError('Profile not found'); setLoading(false); return; }
      setProfile(profileData);

      const [skillsRes, interestsRes, livedRes, verificationsRes, reputationRes, missionsRes] = await Promise.all([
        supabase.from('profile_skills').select('mode, skills(id, label, slug)').eq('profile_id', profileData.id),
        supabase.from('profile_interests').select('interests(id, label)').eq('profile_id', profileData.id),
        supabase.from('lived_experiences').select('*').eq('profile_id', profileData.id).eq('is_public', true),
        supabase.from('identity_verifications').select('*').eq('user_id', profileData.id).eq('status', 'verified'),
        supabase.from('reputation_scores').select('*').eq('user_id', profileData.id).maybeSingle(),
        supabase.from('missions').select('*, categories(label)').eq('creator_id', profileData.id).eq('visibility', 'public').order('created_at', { ascending: false }),
      ]);
      if (!active) return;
      setSkills(skillsRes.data ?? []);
      setInterests(interestsRes.data ?? []);
      setLivedExperiences(livedRes.data ?? []);
      setVerifications(verificationsRes.data ?? []);
      setReputation(reputationRes.data);
      setMissions(missionsRes.data ?? []);

      if (user && user.id !== profileData.id) {
        const { data: blockRow } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id).eq('blocked_id', profileData.id).maybeSingle();
        setIsBlocked(Boolean(blockRow));

        const { data: theirMissionIds } = await supabase.from('mission_members').select('mission_id').eq('user_id', profileData.id);
        const missionIds = (theirMissionIds ?? []).map((m) => m.mission_id);
        if (missionIds.length > 0) {
          const { data: sharedMission } = await supabase
            .from('mission_members').select('mission_id, missions!inner(state)')
            .eq('user_id', user.id).eq('missions.state', 'completed').in('mission_id', missionIds).maybeSingle();
          setSharedCompletedMission(sharedMission);
        }
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

  async function verifySkill(skillId) {
    setVerifyBusy(skillId);
    const { error: verifyError } = await supabase.rpc('verify_peer_skill', { p_target_user_id: profile.id, p_skill_id: skillId });
    setVerifyBusy(null);
    if (!verifyError) {
      const { data } = await supabase.from('identity_verifications').select('*').eq('user_id', profile.id).eq('status', 'verified');
      setVerifications(data ?? []);
    }
  }

  if (loading) return <LoadingSpinner className="py-24" />;
  if (error) return <p className="section-pad text-center text-sm text-danger">{error}</p>;

  const isSelf = user?.id === profile.id;
  const verifiedSkillSlugs = new Set(verifications.filter((v) => v.kind === 'peer_skill_reference').map((v) => v.value));

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
              <p className="text-sm text-muted-foreground">@{profile.username}{profile.pronouns ? ` · ${profile.pronouns}` : ''}</p>
              {profile.city && <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{profile.city}</p>}
            </div>
          </div>
          {!isSelf && user && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleBlock} className="btn-outline text-xs">{isBlocked ? 'Unblock' : 'Block'}</button>
              <ReportButton targetType="user" targetId={profile.id} />
            </div>
          )}
        </div>

        {reputation && (
          <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
            <span>{reputation.missions_completed} Missions completed</span>
            <span>{reputation.help_given_count} times helped someone</span>
            <span>{reputation.help_received_count} times helped</span>
          </div>
        )}

        {profile.bio && <p className="mt-4 max-w-xl text-foreground/90">{profile.bio}</p>}

        {skills.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Can help with</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s.skills.id} className="badge bg-accent/10 text-accent">
                  {verifiedSkillSlugs.has(s.skills.slug ?? '') && <ShieldCheck className="h-3 w-3" />}
                  {s.skills.label}
                  {!isSelf && sharedCompletedMission && !verifiedSkillSlugs.has(s.skills.slug ?? '') && (
                    <button type="button" disabled={verifyBusy === s.skills.id} onClick={() => verifySkill(s.skills.id)} title="Verify this skill" className="ml-0.5 text-accent/60 hover:text-accent">
                      <Award className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {interests.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {interests.map((i) => <span key={i.interests.id} className="badge bg-muted text-muted-foreground">{i.interests.label}</span>)}
          </div>
        )}

        {livedExperiences.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lived experience</p>
            <ul className="mt-1.5 space-y-1">
              {livedExperiences.map((le) => <li key={le.id} className="text-sm">{le.title} <span className="text-muted-foreground">· {le.category}</span></li>)}
            </ul>
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
