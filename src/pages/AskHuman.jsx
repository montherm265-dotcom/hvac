import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { runMatching } from '@/lib/matchingProvider';
import { track } from '@/lib/analytics';

export default function AskHuman() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', categoryId: '', urgency: 'flexible', locationScope: 'either', city: '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    supabase.from('categories').select('id, label').in('kind', ['request', 'both']).order('label').then(({ data }) => {
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
    setStatusMessage('Posting your request…');
    try {
      const { data: request, error: insertError } = await supabase
        .from('requests')
        .insert({
          requester_id: user.id,
          title: form.title,
          description: form.description,
          category_id: form.categoryId || null,
          urgency: form.urgency,
          location_scope: form.locationScope,
          city: form.city || null,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      track('request_created', { request_id: request.id });

      setStatusMessage('Finding the right humans for this…');
      const { provider } = await runMatching(request.id);
      track('person_discovered', { request_id: request.id, via: provider });

      navigate(`/requests/${request.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
      setStatusMessage(null);
    }
  }

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-lg">
        <span className="inline-block rounded-full bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent">Ask Human</span>
        <h1 className="mt-4 font-display text-3xl font-bold">What do you need right now?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe it in your own words. HUMAN will route it to real people nearby, with the right skills or lived experience —
          not a search results page.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">In a sentence</label>
            <input
              className="input-soft" value={form.title} maxLength={140}
              onChange={(e) => update('title', e.target.value)} placeholder="Need someone who's been through a divorce to talk to" required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tell HUMAN more</label>
            <textarea
              className="input-soft min-h-32" value={form.description} maxLength={2000}
              onChange={(e) => update('description', e.target.value)}
              placeholder="The more specific you are, the better the match." required
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
              <label className="mb-1 block text-sm font-medium">How urgent?</label>
              <select className="input-soft" value={form.urgency} onChange={(e) => update('urgency', e.target.value)}>
                <option value="now">Right now</option>
                <option value="this_week">This week</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Where</label>
              <select className="input-soft" value={form.locationScope} onChange={(e) => update('locationScope', e.target.value)}>
                <option value="either">Local or remote</option>
                <option value="local">In person only</option>
                <option value="remote">Remote only</option>
              </select>
            </div>
            {form.locationScope !== 'remote' && (
              <div>
                <label className="mb-1 block text-sm font-medium">City</label>
                <input className="input-soft" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Optional" />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {statusMessage ?? 'Ask Human'}
          </button>
        </form>
      </div>
    </div>
  );
}
