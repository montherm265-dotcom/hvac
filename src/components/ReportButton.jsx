import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function ReportButton({ targetType, targetId }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const { error: reportError } = await supabase.from('reports').insert({
      reporter_id: user.id, target_type: targetType, target_id: targetId, reason,
    });
    if (reportError) setError(reportError.message);
    else setSubmitted(true);
  }

  if (!user) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-outline text-xs">
        <Flag className="h-3.5 w-3.5" /> Report
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="card-soft w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            {submitted ? (
              <p className="text-sm">Thanks — this has been sent to HUMAN's trust &amp; safety review queue.</p>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3 className="font-display text-base font-semibold">Report {targetType}</h3>
                <textarea
                  className="input-soft mt-3 min-h-24" required minLength={3} value={reason}
                  onChange={(e) => setReason(e.target.value)} placeholder="What's wrong?"
                />
                {error && <p className="mt-2 text-sm text-danger">{error}</p>}
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
                  <button type="submit" className="btn-primary">Submit report</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
