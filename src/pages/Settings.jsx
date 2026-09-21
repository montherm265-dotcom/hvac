import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ displayName: '', bio: '', city: '', country: '', skills: '', interests: '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      displayName: profile.display_name || '',
      bio: profile.bio || '',
      city: profile.city || '',
      country: profile.country || '',
      skills: (profile.skills || []).join(', '),
      interests: (profile.interests || []).join(', '),
    });
  }, [profile]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('profiles').update({
      display_name: form.displayName,
      bio: form.bio,
      city: form.city || null,
      country: form.country || null,
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      interests: form.interests.split(',').map((s) => s.trim()).filter(Boolean),
    }).eq('id', user.id);
    setSaving(false);
    if (updateError) setError(updateError.message);
    else {
      setSaved(true);
      refreshProfile();
    }
  }

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-lg">
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
          <div>
            <label className="mb-1 block text-sm font-medium">Skills (comma separated)</label>
            <input className="input-soft" value={form.skills} onChange={(e) => update('skills', e.target.value)} placeholder="carpentry, spanish, first aid" />
            <p className="mt-1 text-xs text-muted-foreground">Used to match you in Needs You.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Interests (comma separated)</label>
            <input className="input-soft" value={form.interests} onChange={(e) => update('interests', e.target.value)} placeholder="hiking, cooking, music" />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {saved && <p className="text-sm text-success">Saved.</p>}

          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : 'Save changes'}</button>
        </form>
      </div>
    </div>
  );
}
