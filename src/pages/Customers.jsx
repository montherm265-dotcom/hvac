import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, Users, Phone, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

export default function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('customers').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
    setCustomers(data || []);
  };
  useEffect(() => { load(); }, [user.id]);

  const addCustomer = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    await supabase.from('customers').insert({ owner_id: user.id, ...form });
    setForm({ name: '', phone: '', email: '', address: '' });
    setSaving(false);
    load();
  };

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content">
        <h1 className="font-display text-3xl font-bold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every client you've done work for.</p>

        <form onSubmit={addCustomer} className="card-soft mt-6 grid gap-3 p-5 sm:grid-cols-5">
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input-soft" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input-soft" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input-soft" />
          <input placeholder="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="input-soft sm:col-span-1" />
          <button type="submit" disabled={saving} className="btn-primary">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add</button>
        </form>

        {customers === null ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : customers.length === 0 ? (
          <div className="card-soft mt-6 flex flex-col items-center gap-2 p-14 text-center">
            <Users className="h-9 w-9 text-muted-foreground" />
            <p className="font-medium">No customers yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">Add your first customer above to start scheduling jobs for them.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customers.map((c) => (
              <Link key={c.id} to={`/jobs?customer=${c.id}`} className="card-soft p-5 transition hover:border-primary/40">
                <p className="font-heading font-semibold">{c.name}</p>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {c.phone}</p>}
                  {c.email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {c.email}</p>}
                  {c.address && <p>{c.address}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
