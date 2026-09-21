import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useI18n, SUPPORTED_LOCALES } from '@/i18n';
import TaxonomyPicker from '@/components/TaxonomyPicker';

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const { locale, setLocale } = useI18n();

  const [form, setForm] = useState({ displayName: '', bio: '', city: '', country: '' });
  const [skills, setSkills] = useState([]);
  const [interests, setInterests] = useState([]);
  const [livedExperiences, setLivedExperiences] = useState([]);
  const [newExperience, setNewExperience] = useState({ category: '', title: '' });
  const [privacy, setPrivacy] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({ displayName: profile.display_name || '', bio: profile.bio || '', city: profile.city || '', country: profile.country || '' });

    supabase.from('profile_skills').select('skills(id, label)').eq('profile_id', user.id).then(({ data }) => setSkills((data ?? []).map((r) => r.skills)));
    supabase.from('profile_interests').select('interests(id, label)').eq('profile_id', user.id).then(({ data }) => setInterests((data ?? []).map((r) => r.interests)));
    supabase.from('lived_experiences').select('*').eq('profile_id', user.id).then(({ data }) => setLivedExperiences(data ?? []));
    supabase.from('privacy_settings').select('*').eq('user_id', user.id).single().then(({ data }) => setPrivacy(data));
  }, [profile, user.id]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('profiles').update({
      display_name: form.displayName, bio: form.bio, city: form.city || null, country: form.country || null,
    }).eq('id', user.id);
    setSaving(false);
    if (updateError) setError(updateError.message);
    else { setSaved(true); refreshProfile(); }
  }

  async function updateSkills(next) {
    const added = next.filter((s) => !skills.some((existing) => existing.id === s.id));
    const removed = skills.filter((s) => !next.some((existing) => existing.id === s.id));
    if (added.length) await supabase.from('profile_skills').insert(added.map((s) => ({ profile_id: user.id, skill_id: s.id })));
    for (const r of removed) await supabase.from('profile_skills').delete().eq('profile_id', user.id).eq('skill_id', r.id);
    setSkills(next);
  }

  async function updateInterests(next) {
    const added = next.filter((i) => !interests.some((existing) => existing.id === i.id));
    const removed = interests.filter((i) => !next.some((existing) => existing.id === i.id));
    if (added.length) await supabase.from('profile_interests').insert(added.map((i) => ({ profile_id: user.id, interest_id: i.id })));
    for (const r of removed) await supabase.from('profile_interests').delete().eq('profile_id', user.id).eq('interest_id', r.id);
    setInterests(next);
  }

  async function addExperience(e) {
    e.preventDefault();
    if (!newExperience.title.trim()) return;
    const { data } = await supabase.from('lived_experiences').insert({
      profile_id: user.id, category: newExperience.category.trim() || 'general', title: newExperience.title.trim(),
    }).select().single();
    if (data) setLivedExperiences((prev) => [...prev, data]);
    setNewExperience({ category: '', title: '' });
  }

  async function removeExperience(id) {
    await supabase.from('lived_experiences').delete().eq('id', id);
    setLivedExperiences((prev) => prev.filter((e) => e.id !== id));
  }

  async function updatePrivacy(field, value) {
    setPrivacy((p) => ({ ...p, [field]: value }));
    await supabase.from('privacy_settings').update({ [field]: value }).eq('user_id', user.id);
  }

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-lg space-y-10">
        <div>
          <h1 className="font-display text-2xl font-bold">Settings</h1>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Display name</label>
              <input className="input-soft" value={form.displayName} onChange={(e) => update('displayName', e.target.value)} maxLength={60} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Bio</label>
              <textarea className="input-soft min-h-24" value={form.bio} onChange={(e) => update('bio', e.target.value)} maxLength={500} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">City</label>
                <input className="input-soft" value={form.city} onChange={(e) => update('city', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Country</label>
                <input className="input-soft" value={form.country} onChange={(e) => update('country', e.target.value)} />
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            {saved && <p className="text-sm text-success">Saved.</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : 'Save changes'}</button>
          </form>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold">Skills you can help with</h2>
          <div className="mt-3"><TaxonomyPicker table="skills" selected={skills} onChange={updateSkills} placeholder="Search or add a skill…" /></div>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold">Interests</h2>
          <div className="mt-3"><TaxonomyPicker table="interests" selected={interests} onChange={updateInterests} placeholder="Search or add an interest…" /></div>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold">Lived experience</h2>
          <ul className="mt-3 space-y-1.5">
            {livedExperiences.map((le) => (
              <li key={le.id} className="flex items-center justify-between text-sm">
                <span>{le.title} <span className="text-muted-foreground">· {le.category}</span></span>
                <button type="button" onClick={() => removeExperience(le.id)} className="text-xs text-danger">Remove</button>
              </li>
            ))}
          </ul>
          <form onSubmit={addExperience} className="mt-3 flex gap-2">
            <input className="input-soft" placeholder="Category" value={newExperience.category} onChange={(e) => setNewExperience((v) => ({ ...v, category: e.target.value }))} />
            <input className="input-soft" placeholder="Title" value={newExperience.title} onChange={(e) => setNewExperience((v) => ({ ...v, title: e.target.value }))} />
            <button type="submit" className="btn-outline">Add</button>
          </form>
        </div>

        {privacy && (
          <div>
            <h2 className="font-display text-lg font-semibold">Privacy</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Who can see your profile</label>
                <select className="input-soft" value={privacy.profile_visibility} onChange={(e) => updatePrivacy('profile_visibility', e.target.value)}>
                  <option value="public">Anyone</option>
                  <option value="connections">Connections only</option>
                  <option value="private">Only me</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Who can message you</label>
                <select className="input-soft" value={privacy.message_permissions} onChange={(e) => updatePrivacy('message_permissions', e.target.value)}>
                  <option value="anyone">Anyone</option>
                  <option value="connections_only">Connections only</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={privacy.allow_matching} onChange={(e) => updatePrivacy('allow_matching', e.target.checked)} />
                Include me in Ask Human matching
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={privacy.discoverable_in_search} onChange={(e) => updatePrivacy('discoverable_in_search', e.target.checked)} />
                Show me in search
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={privacy.show_lived_experiences} onChange={(e) => updatePrivacy('show_lived_experiences', e.target.checked)} />
                Show my lived experiences publicly
              </label>
            </div>
          </div>
        )}

        <div>
          <h2 className="font-display text-lg font-semibold">Language</h2>
          <select className="input-soft mt-3" value={locale} onChange={(e) => setLocale(e.target.value)}>
            {SUPPORTED_LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
