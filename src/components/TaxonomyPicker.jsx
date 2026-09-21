import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { slugify } from '@/lib/slugify';

// Reusable picker over the open skills/interests taxonomy tables (see
// supabase/migrations/0001_identity.sql). Search-as-you-type against
// existing rows, or add a brand-new one on the fly — anyone can extend the
// taxonomy, which is why matching gets more precise as HUMAN grows instead
// of being stuck with whatever a launch-day admin thought to seed.
export default function TaxonomyPicker({ table, selected, onChange, placeholder }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    let active = true;
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from(table).select('id, slug, label').ilike('label', `%${query.trim()}%`).limit(8);
      if (active) setResults((data ?? []).filter((r) => !selected.some((s) => s.id === r.id)));
    }, 200);
    return () => { active = false; clearTimeout(timeout); };
  }, [query, table, selected]);

  async function addExisting(item) {
    onChange([...selected, item]);
    setQuery('');
    setResults([]);
  }

  async function addNew() {
    const label = query.trim();
    if (!label) return;
    const { data, error } = await supabase
      .from(table)
      .upsert({ slug: slugify(label), label }, { onConflict: 'slug' })
      .select('id, slug, label')
      .single();
    if (!error && data) addExisting(data);
  }

  function remove(id) {
    onChange(selected.filter((s) => s.id !== id));
  }

  const exactMatch = results.some((r) => r.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {selected.map((s) => (
          <span key={s.id} className="badge bg-accent/10 text-accent">
            {s.label}
            <button type="button" onClick={() => remove(s.id)} aria-label={`Remove ${s.label}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="relative mt-2">
        <input className="input-soft" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
        {query.trim().length >= 2 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card py-1 shadow-soft">
            {results.map((r) => (
              <button key={r.id} type="button" onClick={() => addExisting(r)} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted">
                {r.label}
              </button>
            ))}
            {!exactMatch && (
              <button type="button" onClick={addNew} className="block w-full px-3 py-1.5 text-left text-sm text-accent hover:bg-muted">
                Add "{query.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
