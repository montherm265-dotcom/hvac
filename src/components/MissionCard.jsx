import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Users, Radio } from 'lucide-react';
import StateBadge from '@/components/StateBadge';

export default function MissionCard({ mission }) {
  return (
    <Link to={`/missions/${mission.id}`} className="card-soft flex flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:border-accent/40">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold leading-snug">{mission.title}</h3>
        <div className="flex flex-none flex-col items-end gap-1.5">
          {mission.is_live && (
            <span className="badge bg-red-100 text-red-700"><Radio className="h-3 w-3 animate-pulse" /> LIVE</span>
          )}
          <StateBadge state={mission.state} />
        </div>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{mission.description}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {mission.categories?.label && <span className="badge bg-muted text-muted-foreground">{mission.categories.label}</span>}
        {mission.city && (
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{mission.city}</span>
        )}
        {typeof mission.crew_count === 'number' && (
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{mission.crew_count} crew</span>
        )}
      </div>
    </Link>
  );
}
