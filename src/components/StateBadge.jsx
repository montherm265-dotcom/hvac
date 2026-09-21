import React from 'react';
import { stateMeta } from '@/lib/missionState';

export default function StateBadge({ state }) {
  const meta = stateMeta(state);
  return <span className={`badge ${meta.color}`}>{meta.label}</span>;
}
