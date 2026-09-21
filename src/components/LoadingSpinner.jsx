import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ className = 'py-16' }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-accent" />
    </div>
  );
}
