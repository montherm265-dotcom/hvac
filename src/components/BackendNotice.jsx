import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function BackendNotice({ className = '' }) {
  return (
    <div className={`card-soft flex items-start gap-3 border-amber-200 bg-amber-50 p-4 text-left ${className}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
      <p className="text-sm text-amber-800">
        No live backend is connected yet. The schema and every RPC in <code>supabase/migrations/</code> are ready to apply —
        see <strong>README.md → "Activating the backend"</strong> to go live.
      </p>
    </div>
  );
}
