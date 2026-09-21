import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import { ShieldCheck } from 'lucide-react';

const ACTIONS = ['dismiss', 'warn', 'remove_content', 'suspend_user', 'ban_user'];

export default function Admin() {
  const { profile } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!profile?.is_admin) return;
    supabase.from('reports').select('*, profiles!reporter_id(username, display_name)').eq('status', 'open').order('created_at')
      .then(({ data }) => { setReports(data ?? []); setLoading(false); });
  }, [profile]);

  if (!profile) return <LoadingSpinner className="py-24" />;
  if (!profile.is_admin) return <Navigate to="/" replace />;

  async function apply(reportId, action) {
    setBusyId(reportId);
    const { error } = await supabase.rpc('apply_moderation_action', { p_report_id: reportId, p_action: action });
    setBusyId(null);
    if (!error) setReports((prev) => prev.filter((r) => r.id !== reportId));
  }

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content">
        <h1 className="font-display text-3xl font-bold">Moderation queue</h1>
        {loading ? <LoadingSpinner /> : reports.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Queue is empty" description="No open reports right now." />
        ) : (
          <ul className="mt-8 space-y-4">
            {reports.map((r) => (
              <li key={r.id} className="card-soft p-5">
                <p className="text-sm"><strong>{r.profiles?.display_name}</strong> reported a <strong>{r.target_type}</strong></p>
                <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">target id: {r.target_id}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ACTIONS.map((a) => (
                    <button key={a} type="button" disabled={busyId === r.id} onClick={() => apply(r.id, a)} className="btn-outline text-xs capitalize">
                      {a.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
