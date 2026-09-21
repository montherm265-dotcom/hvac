import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

const CATEGORIES = ['Community', 'Creative', 'Outdoors', 'Learning', 'Building', 'Sports', 'Volunteering'];

export default function NewMission() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', category: CATEGORIES[0], city: '', crewLimit: '', isPrivate: false,
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: insertError } = await supabase
        .from('missions')
        .insert({
          creator_id: user.id,
          title: form.title,
          description: form.description,
          category: form.category,
          city: form.city || null,
          crew_limit: form.crewLimit ? Number(form.crewLimit) : null,
          is_private: form.isPrivate,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      await supabase.from('mission_participants').insert({
        mission_id: data.id, user_id: user.id, role: 'creator',
      });

      navigate(`/missions/${data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-2xl font-bold">Ask Human</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe the real thing you're trying to make happen. HUMAN will help you find the people who can help it happen.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <input
              className="input-soft" value={form.title} maxLength={120}
              onChange={(e) => update('title', e.target.value)} placeholder="Rebuild the community garden fence" required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">What needs to happen</label>
            <textarea
              className="input-soft min-h-32" value={form.description} maxLength={4000}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What is it, why does it matter, and what kind of humans do you need?" required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <select className="input-soft" value={form.category} onChange={(e) => update('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">City</label>
              <input className="input-soft" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Crew limit</label>
            <input
              className="input-soft" type="number" min={1} value={form.crewLimit}
              onChange={(e) => update('crewLimit', e.target.value)} placeholder="Optional — leave blank for unlimited"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPrivate} onChange={(e) => update('isPrivate', e.target.checked)} />
            Private mission (only visible to crew)
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Creating…' : 'Create Mission'}
          </button>
        </form>
      </div>
    </div>
  );
}
