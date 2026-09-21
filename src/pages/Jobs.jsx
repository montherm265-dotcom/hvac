import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Loader2, Briefcase, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { formatDate } from '@/lib/utils';

const STATUS_STYLES = {
  requested: 'bg-muted text-muted-foreground',
  scheduled: 'bg-accent/15 text-accent',
  in_progress: 'bg-primary/15 text-primary',
  completed: 'bg-emerald-500/15 text-emerald-600',
  cancelled: 'bg-destructive/15 text-destructive',
};
const SERVICE_LABELS = { installation: 'Installation', repair: 'Repair', maintenance: 'Maintenance', inspection: 'Inspection', duct_cleaning: 'Duct cleaning', other: 'Other' };
const STATUSES = ['requested', 'scheduled', 'in_progress', 'completed', 'cancelled'];

export default function Jobs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerFilter = searchParams.get('customer');
  const [jobs, setJobs] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newJob, setNewJob] = useState({ customer_id: '', title: '', service_type: 'repair', scheduled_date: '', scheduled_time: '' });

  const load = async () => {
    let query = supabase.from('jobs').select('*, customers(name)').eq('owner_id', user.id).order('scheduled_date', { ascending: true, nullsFirst: false });
    if (customerFilter) query = query.eq('customer_id', customerFilter);
    const { data } = await query;
    setJobs(data || []);
  };

  useEffect(() => {
    load();
    supabase.from('customers').select('id, name').eq('owner_id', user.id).order('name').then(({ data }) => setCustomers(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, customerFilter]);

  const createJob = async (e) => {
    e.preventDefault();
    if (!newJob.customer_id || !newJob.title) return;
    setCreating(true);
    const { data, error } = await supabase.from('jobs').insert({ owner_id: user.id, ...newJob, scheduled_date: newJob.scheduled_date || null }).select('*').single();
    setCreating(false);
    if (!error) navigate(`/jobs/${data.id}`);
  };

  const filtered = (jobs || []).filter((j) => !statusFilter || j.status === statusFilter);

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Jobs</h1>
            <p className="mt-1 text-sm text-muted-foreground">Every service call — scheduled, in progress, or done.</p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary"><Plus className="h-4 w-4" /> New job</button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => setStatusFilter('')} className={`rounded-full px-3 py-1.5 text-xs font-medium ${!statusFilter ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>All</button>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{s.replace('_', ' ')}</button>
          ))}
        </div>

        {jobs === null ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="card-soft mt-6 flex flex-col items-center gap-2 p-14 text-center">
            <Briefcase className="h-9 w-9 text-muted-foreground" />
            <p className="font-medium">No jobs here yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">Create a job to start scheduling and invoicing work.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {filtered.map((job) => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="card-soft flex items-center justify-between p-5 transition hover:border-primary/40">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-heading font-semibold">{job.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[job.status]}`}>{job.status.replace('_', ' ')}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{job.customers?.name} · {SERVICE_LABELS[job.service_type]}{job.scheduled_date ? ` · ${formatDate(job.scheduled_date)}${job.scheduled_time ? ` at ${job.scheduled_time}` : ''}` : ''}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading font-semibold">New job</h3>
              <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={createJob} className="space-y-3">
              <select required value={newJob.customer_id} onChange={(e) => setNewJob((f) => ({ ...f, customer_id: e.target.value }))} className="input-soft">
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input required placeholder="Job title (e.g. AC unit not cooling)" value={newJob.title} onChange={(e) => setNewJob((f) => ({ ...f, title: e.target.value }))} className="input-soft" />
              <select value={newJob.service_type} onChange={(e) => setNewJob((f) => ({ ...f, service_type: e.target.value }))} className="input-soft">
                {Object.entries(SERVICE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={newJob.scheduled_date} onChange={(e) => setNewJob((f) => ({ ...f, scheduled_date: e.target.value }))} className="input-soft" />
                <input type="time" value={newJob.scheduled_time} onChange={(e) => setNewJob((f) => ({ ...f, scheduled_time: e.target.value }))} className="input-soft" />
              </div>
              {customers.length === 0 && <p className="text-xs text-muted-foreground">Add a customer first from the Customers page.</p>}
              <button type="submit" disabled={creating || customers.length === 0} className="btn-primary w-full">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create job'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
