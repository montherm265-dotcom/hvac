import React from 'react';
import { Link } from 'react-router-dom';

export default function PersonCard({ profile, trailing }) {
  return (
    <Link to={`/profile/${profile.username}`} className="card-soft flex items-center gap-3 p-4 hover:border-accent/40">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
        {(profile.display_name || '?').slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{profile.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          @{profile.username}{profile.city ? ` · ${profile.city}` : ''}
        </p>
      </div>
      {trailing}
    </Link>
  );
}
