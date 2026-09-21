import React from 'react';

export default function About() {
  return (
    <div className="section-pad">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold">About HUMAN</h1>
        <p className="mt-4 text-foreground/90">
          Most social networks are built around content: posts, likes, followers. HUMAN is built around Missions —
          real things real people are trying to make happen, from rebuilding a fence to running a study group to organizing
          a neighborhood cleanup — and the humans who show up to help them happen.
        </p>
        <p className="mt-4 text-foreground/90">
          A Mission moves through real states — idea, planning, active, in progress, near completion, completed — instead
          of sitting in a feed forever. Crew join it, milestones get checked off, and Moments capture what actually happened
          along the way.
        </p>
        <p className="mt-4 text-foreground/90">
          Reputation on HUMAN isn't a star rating — it's the missions you've shown up for.
        </p>
      </div>
    </div>
  );
}
