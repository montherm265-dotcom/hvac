import React, { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'QAR', 'KWD'];

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    company_name: profile?.company_name || '',
    company_address: profile?.company_address || '',
    company_phone: profile?.company_phone || '',
    default_currency: profile?.default_currency || 'USD',
    default_tax_rate: profile?.default_tax_rate ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('profiles').update(form).eq('id', user.id);
    setSaving(false);
    setSaved(true);
    refreshProfile();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight">Company settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Shown on every exported invoice and shared link.</p>

        <form onSubmit={save} className="card-soft mt-6 space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Company name</label>
            <input value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} className="input-soft" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Company address</label>
            <input value={form.company_address} onChange={(e) => setForm((f) => ({ ...f, company_address: e.target.value }))} className="input-soft" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Phone</label>
            <input value={form.company_phone} onChange={(e) => setForm((f) => ({ ...f, company_phone: e.target.value }))} className="input-soft" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Default currency</label>
              <select value={form.default_currency} onChange={(e) => setForm((f) => ({ ...f, default_currency: e.target.value }))} className="input-soft">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Default tax %</label>
              <input type="number" step="0.1" value={form.default_tax_rate} onChange={(e) => setForm((f) => ({ ...f, default_tax_rate: Number(e.target.value) }))} className="input-soft" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="h-4 w-4" /> {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? 'Saved' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
