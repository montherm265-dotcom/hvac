import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CalendarClock, Receipt, Users, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { formatMoney, formatDate } from '@/lib/utils';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState(null);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

      const [{ data: upcomingJobs }, { data: unpaidJobs }, { count: customerCount }] = await Promise.all([
        supabase.from('jobs').select('*, customers(name)').eq('owner_id', user.id).gte('scheduled_date', today).lte('scheduled_date', weekAhead).order('scheduled_date'),
        supabase.from('jobs').select('id, job_items(quantity, unit_price)').eq('owner_id', user.id).eq('invoice_status', 'invoiced'),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
      ]);

      const unpaidTotal = (unpaidJobs || []).reduce((sum, job) => sum + (job.job_items || []).reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0), 0);

      setStats({ jobsThisWeek: (upcomingJobs || []).length, unpaidTotal, unpaidCount: (unpaidJobs || []).length, customerCount: customerCount || 0 });
      setUpcoming(upcomingJobs || []);
    })();
  }, [user.id]);

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content">
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back{profile?.company_name ? `, ${profile.company_name}` : ''}</h1>

        {!stats ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="card-soft p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarClock className="h-4 w-4" /></div>
                <p className="mt-3 font-display text-2xl font-bold">{stats.jobsThisWeek}</p>
                <p className="text-xs text-muted-foreground">Jobs in the next 7 days</p>
              </div>
              <div className="card-soft p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent"><Receipt className="h-4 w-4" /></div>
                <p className="mt-3 font-display text-2xl font-bold">{formatMoney(stats.unpaidTotal, profile?.default_currency)}</p>
                <p className="text-xs text-muted-foreground">Outstanding across {stats.unpaidCount} invoice{stats.unpaidCount === 1 ? '' : 's'}</p>
              </div>
              <div className="card-soft p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-4 w-4" /></div>
                <p className="mt-3 font-display text-2xl font-bold">{stats.customerCount}</p>
                <p className="text-xs text-muted-foreground">Customers</p>
              </div>
            </div>

            <div className="card-soft mt-6 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="font-heading font-semibold">Coming up this week</h2>
                <Link to="/jobs" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">All jobs <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
              {upcoming.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">Nothing scheduled in the next 7 days.</p>
              ) : (
                <div className="divide-y divide-border">
                  {upcoming.map((job) => (
                    <Link key={job.id} to={`/jobs/${job.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.customers?.name}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDate(job.scheduled_date)}{job.scheduled_time ? ` · ${job.scheduled_time}` : ''}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
