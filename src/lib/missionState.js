export const MISSION_STATES = [
  { value: 'idea', label: 'Idea', color: 'bg-muted text-muted-foreground' },
  { value: 'planning', label: 'Planning', color: 'bg-blue-100 text-blue-700' },
  { value: 'active', label: 'Active', color: 'bg-accent/15 text-accent' },
  { value: 'progress', label: 'In progress', color: 'bg-accent/15 text-accent' },
  { value: 'near_completion', label: 'Near completion', color: 'bg-amber-100 text-amber-700' },
  { value: 'completed', label: 'Completed', color: 'bg-success/15 text-success' },
  { value: 'paused', label: 'Paused', color: 'bg-muted text-muted-foreground' },
  { value: 'archived', label: 'Archived', color: 'bg-muted text-muted-foreground' },
];

export function stateMeta(value) {
  return MISSION_STATES.find((s) => s.value === value) ?? MISSION_STATES[0];
}

// Mirrors public.is_legal_mission_transition() in supabase/migrations/0002_human_functions.sql
export const LEGAL_TRANSITIONS = {
  idea: ['planning', 'archived'],
  planning: ['active', 'paused', 'archived'],
  active: ['progress', 'paused', 'archived'],
  progress: ['near_completion', 'paused', 'archived'],
  near_completion: ['completed', 'progress', 'paused'],
  paused: ['planning', 'active', 'progress', 'archived'],
  completed: [],
  archived: [],
};

export function nextStates(current) {
  return LEGAL_TRANSITIONS[current] ?? [];
}
