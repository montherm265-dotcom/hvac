import React from 'react';
import { Link } from 'react-router-dom';
import { TOOLS } from '@/lib/tools';

export default function Home() {
  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content text-center">
        <span className="inline-block rounded-full bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent">Free · No sign-up · No watermark</span>
        <h1 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
          QR codes and barcodes, generated instantly
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          URLs, WiFi, contacts, email, SMS, and barcodes — customize the colors, download PNG or SVG, and codes that never expire.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-content gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.slug} to={`/${tool.slug}`} className="card-soft p-5 transition hover:-translate-y-0.5 hover:border-accent/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent"><Icon className="h-5 w-5" /></div>
              <h3 className="mt-3 font-heading text-base font-semibold">{tool.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
