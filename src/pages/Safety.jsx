import React from 'react';

export default function Safety() {
  return (
    <div className="section-pad">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold">Trust &amp; Safety</h1>
        <div className="mt-6 space-y-6 text-foreground/90">
          <section>
            <h2 className="font-display text-lg font-semibold">Real identity, always</h2>
            <p className="mt-1 text-sm text-muted-foreground">Every HUMAN account is tied to a verified email and a unique username. There is no anonymous posting or anonymous mission creation.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-semibold">Block and report</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Any user can block another user, which also prevents joining each other's missions and messaging. Any user, mission, moment, or message
              can be reported. Reports go into a review queue visible to admin accounts only (<code>reports</code> table, RLS-gated).
            </p>
          </section>
          <section>
            <h2 className="font-display text-lg font-semibold">Location privacy</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              HUMAN only stores city-level location, entered by you. There is no precise geolocation tracking in this version.
            </p>
          </section>
          <section>
            <h2 className="font-display text-lg font-semibold">What's not built yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Automated content moderation (image/text classification) and human moderation staffing are not part of this V1 — see
              the README's roadmap section for what real trust &amp; safety infrastructure this needs before scaling past a trusted pilot group.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
