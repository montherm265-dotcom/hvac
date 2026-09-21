import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Plus, Trash2, FileDown, Link2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { formatMoney } from '@/lib/utils';
import { exportInvoicePdf } from '@/lib/pdf';

const STATUSES = ['requested', 'scheduled', 'in_progress', 'completed', 'cancelled'];
const SERVICE_LABELS = { installation: 'Installation', repair: 'Repair', maintenance: 'Maintenance', inspection: 'Inspection', duct_cleaning: 'Duct cleaning', other: 'Other' };
const INVOICE_STATUSES = ['not_invoiced', 'invoiced', 'paid'];

function useDebouncedSave(saveFn, delay = 600) {
  const [pending, setPending] = useState(null);
  useEffect(() => {
    if (pending === null) return;
    const t = setTimeout(() => { saveFn(pending); setPending(null); }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);
  return setPending;
}

export default function JobDetail() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [items, setItems] = useState(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: j } = await supabase.from('jobs').select('*, customers(*)').eq('id', id).single();
      const { data: its } = await supabase.from('job_items').select('*').eq('job_id', id).order('sort_order');
      setJob(j);
      setCustomer(j?.customers || null);
      setItems(its || []);
    })();
  }, [id]);

  const saveField = useCallback(async (patch) => { await supabase.from('jobs').update(patch).eq('id', id); }, [id]);
  const queueSave = useDebouncedSave(saveField);
  const updateLocal = (patch) => { setJob((j) => ({ ...j, ...patch })); queueSave(patch); };

  const addItem = async () => {
    const sortOrder = items.length;
    const { data } = await supabase.from('job_items').insert({ job_id: id, owner_id: user.id, description: 'New line item', quantity: 1, unit_price: 0, sort_order: sortOrder }).select('*').single();
    setItems((i) => [...i, data]);
  };

  const removeItem = async (itemId) => {
    setItems((i) => i.filter((it) => it.id !== itemId));
    await supabase.from('job_items').delete().eq('id', itemId);
  };

  const [pendingItemSaves, setPendingItemSaves] = useState({});
  useEffect(() => {
    const ids = Object.keys(pendingItemSaves);
    if (!ids.length) return;
    const timers = ids.map((itemId) => setTimeout(async () => {
      const patch = pendingItemSaves[itemId];
      if (!patch) return;
      await supabase.from('job_items').update(patch).eq('id', itemId);
      setPendingItemSaves((prev) => { const next = { ...prev }; delete next[itemId]; return next; });
    }, 600));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingItemSaves]);

  const updateItem = (itemId, patch) => {
    setItems((i) => i.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
    setPendingItemSaves((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  };

  const totals = useMemo(() => {
    if (!items) return { subtotal: 0, tax: 0, total: 0 };
    const subtotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
    const tax = subtotal * (Number(job?.tax_rate || 0) / 100);
    return { subtotal, tax, total: subtotal + tax };
  }, [items, job?.tax_rate]);

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/invoice/${job.share_token}`);
    setCopying(true);
    setTimeout(() => setCopying(false), 1800);
  };

  const exportPdf = () => exportInvoicePdf({ job, items, customer, company: profile });

  const deleteJob = async () => {
    if (!confirm('Delete this job? This cannot be undone.')) return;
    await supabase.from('jobs').delete().eq('id', id);
    navigate('/jobs');
  };

  if (!job || !items) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content">
        <div className="card-soft p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1">
              <input value={job.title} onChange={(e) => updateLocal({ title: e.target.value })} className="w-full min-w-[240px] border-none bg-transparent font-display text-2xl font-bold outline-none" />
              <p className="mt-1 text-sm text-muted-foreground">{customer?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={copyShareLink} className="btn-outline">{copying ? <><Check className="h-4 w-4" /> Copied</> : <><Link2 className="h-4 w-4" /> Invoice link</>}</button>
              <button onClick={exportPdf} className="btn-primary"><FileDown className="h-4 w-4" /> Export PDF</button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Status</label>
              <select value={job.status} onChange={(e) => updateLocal({ status: e.target.value })} className="input-soft capitalize">
                {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Service type</label>
              <select value={job.service_type} onChange={(e) => updateLocal({ service_type: e.target.value })} className="input-soft">
                {Object.entries(SERVICE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Scheduled date</label>
              <input type="date" value={job.scheduled_date || ''} onChange={(e) => updateLocal({ scheduled_date: e.target.value })} className="input-soft" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Scheduled time</label>
              <input type="time" value={job.scheduled_time || ''} onChange={(e) => updateLocal({ scheduled_time: e.target.value })} className="input-soft" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Technician</label>
              <input value={job.technician_name || ''} onChange={(e) => updateLocal({ technician_name: e.target.value })} className="input-soft" placeholder="Assigned to" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Tax / VAT %</label>
              <input type="number" step="0.1" value={job.tax_rate} onChange={(e) => updateLocal({ tax_rate: Number(e.target.value) })} className="input-soft" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Invoice status</label>
              <select value={job.invoice_status} onChange={(e) => updateLocal({ invoice_status: e.target.value })} className="input-soft capitalize">
                {INVOICE_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card-soft mt-5 overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-3 font-heading font-semibold">Line items</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="w-1/2 px-4 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium">Qty</th>
                  <th className="px-2 py-2 font-medium">Unit price</th>
                  <th className="px-2 py-2 text-right font-medium">Amount</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-1.5"><input value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} className="w-full rounded-lg border-none bg-transparent px-1 py-1.5 text-sm outline-none focus:bg-muted" /></td>
                    <td className="px-2 py-1.5"><input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })} className="w-20 rounded-lg border-none bg-transparent px-1 py-1.5 text-sm outline-none focus:bg-muted" /></td>
                    <td className="px-2 py-1.5"><input type="number" value={item.unit_price} onChange={(e) => updateItem(item.id, { unit_price: Number(e.target.value) })} className="w-24 rounded-lg border-none bg-transparent px-1 py-1.5 text-sm outline-none focus:bg-muted" /></td>
                    <td className="px-2 py-1.5 text-right font-medium">{formatMoney(Number(item.quantity || 0) * Number(item.unit_price || 0), profile?.default_currency)}</td>
                    <td className="px-2 py-1.5"><button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3"><button onClick={addItem} className="btn-ghost"><Plus className="h-4 w-4" /> Add line item</button></div>
        </div>

        <div className="mt-5 flex justify-end">
          <div className="w-full max-w-xs space-y-2 rounded-2xl border border-border bg-card p-5">
            <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span>{formatMoney(totals.subtotal, profile?.default_currency)}</span></div>
            {job.tax_rate > 0 && <div className="flex justify-between text-sm text-muted-foreground"><span>Tax / VAT ({job.tax_rate}%)</span><span>{formatMoney(totals.tax, profile?.default_currency)}</span></div>}
            <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold"><span>Total due</span><span>{formatMoney(totals.total, profile?.default_currency)}</span></div>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Notes (shown on the invoice)</label>
          <textarea value={job.notes || ''} onChange={(e) => updateLocal({ notes: e.target.value })} rows={3} className="input-soft" placeholder="Warranty info, payment terms…" />
        </div>

        <div className="mt-8 border-t border-border pt-6 text-end">
          <button onClick={deleteJob} className="text-sm font-medium text-destructive hover:underline">Delete this job</button>
        </div>
      </div>
    </div>
  );
}
