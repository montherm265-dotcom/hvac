import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Users, Receipt, Share2, ClipboardCheck, Wrench } from 'lucide-react';

const FEATURES = [
  { icon: Users, title: 'A real customer list', body: 'Every customer, their address, contact info, and full job history in one place — not scattered across text threads.' },
  { icon: CalendarClock, title: 'Jobs you can actually schedule', body: 'Installation, repair, maintenance, inspection — set a date, time, and technician, and see what’s coming up today and this week.' },
  { icon: Wrench, title: 'Track a job start to finish', body: 'Requested → scheduled → in progress → completed. Know exactly where every job stands without calling the technician to ask.' },
  { icon: Receipt, title: 'Itemized invoicing', body: 'Parts, labor, call-out fee — line by line. Tax/VAT calculated automatically, never by hand.' },
  { icon: Share2, title: 'A link your customer can actually open', body: 'Send an invoice as a link — no login, no app to download, no PDF that gets lost in an inbox.' },
  { icon: ClipboardCheck, title: 'Built for how the work actually happens', body: 'Not a generic project tool bent into shape — scheduling and invoicing modeled on an actual service call.' },
];

export default function Home() {
  return (
    <div>
      <section className="section-pad pb-8 text-center">
        <div className="mx-auto max-w-content">
          <span className="inline-block rounded-full bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent">Field service software</span>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Run your HVAC business from one screen, not four apps
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Customers, jobs, scheduling, and invoicing — built for HVAC and field-service contractors who are still juggling a paper calendar and a Word invoice template.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="btn-primary h-12 px-6 text-base">Start free <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/login" className="btn-outline h-12 px-6 text-base">Sign in</Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No card required. Your first 5 jobs are free.</p>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto max-w-content">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">Everything a small service business actually needs</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card-soft p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-heading text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad bg-muted/40">
        <div className="mx-auto max-w-content text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Who it's for</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            HVAC contractors, plumbers, electricians, and any field-service business that goes to a customer's site, does the work, and needs to bill for it.
          </p>
          <div className="mt-8">
            <Link to="/register" className="btn-primary h-12 px-6 text-base">Set up your first job <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
