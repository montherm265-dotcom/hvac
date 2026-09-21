import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function ToolShell({ tool, children }) {
  const Icon = tool.icon;
  return (
    <div className="section-pad">
      <div className="mx-auto max-w-content">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> All tools
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent"><Icon className="h-5 w-5" /></div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">{tool.name}</h1>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </div>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
