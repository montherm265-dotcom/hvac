import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock } from 'lucide-react';

const URGENCY_LABEL = { now: 'Needed now', this_week: 'This week', flexible: 'Flexible' };

export default function RequestCard({ request }) {
  return (
    <Link to={`/requests/${request.id}`} className="card-soft flex flex-col gap-2 p-5 hover:border-accent/40">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-semibold leading-snug">{request.title}</h3>
        <span className="badge bg-accent/10 text-accent flex-none">{URGENCY_LABEL[request.urgency] ?? request.urgency}</span>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{request.description}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {request.categories?.label && <span className="badge bg-muted text-muted-foreground">{request.categories.label}</span>}
        {request.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{request.city}</span>}
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{request.status}</span>
      </div>
    </Link>
  );
}
