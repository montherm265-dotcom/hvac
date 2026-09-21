import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { track } from '@/lib/analytics';

export default function NewMission() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const originRequestId = params.get('from_request');

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', categoryId: '', city: '', crewLimit: '', visibility: 'public',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('categories').select('id, label').in('kind', ['mission', 'both']).order('label').then(({ data }) => {
      setCategories(data ?? []);
      if (data?.length) setForm((f) => ({ ...f, categoryId: f.categoryId || data[0].id }));
    });
  }, []);

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
          category_id: form.categoryId || null,
          city: form.city || null,
          crew_limit: form.crewLimit ? Number(form.crewLimit) : null,
          visibility: form.visibility,
          origin_request_id: originRequestId || null,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      await supabase.from('mission_members').insert({ mission_id: data.id, user_id: user.id, role: 'creator' });
      track('mission_created', { mission_id: data.id });

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
        <h1 className="font-display text-2xl font-bold">Start a Mission</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A Mission is for sustained work with real crew, milestones, and progress — not a one-off ask.
          For something lighter, try <a href="/ask" className="text-accent underline">Ask Human</a> instead.
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
              <select className="input-soft" value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">City</label>
              <input className="input-soft" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Crew limit</label>
              <input
                className="input-soft" type="number" min={1} value={form.crewLimit}
                onChange={(e) => update('crewLimit', e.target.value)} placeholder="Unlimited"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Visibility</label>
              <select className="input-soft" value={form.visibility} onChange={(e) => update('visibility', e.target.value)}>
                <option value="public">Public</option>
                <option value="connections">Connections only</option>
                <option value="private">Private (invite only)</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Creating…' : 'Create Mission'}
          </button>
        </form>
      </div>
    </div>
  );
}
