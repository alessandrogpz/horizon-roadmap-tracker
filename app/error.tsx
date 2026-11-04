'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App-level rendering error caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-background text-foreground font-mono text-center">
      <div className="p-8 rounded-lg bg-card border border-warning/20 max-w-[600px] w-full shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
        <h2 className="text-warning mb-4 uppercase tracking-[0.05em] text-2xl font-bold">
          Workspace Error
        </h2>
        <p className="text-muted-foreground text-[0.95rem] mb-6 leading-normal">
          A client-side rendering or hydration error occurred while building the dashboard.
        </p>
        <div className="p-4 bg-black rounded-md text-left text-[0.8rem] text-red-400 overflow-x-auto mb-8 border border-card-border">
          <strong>Error:</strong> {error.message || String(error)}
          {error.digest && <div className="text-muted-foreground mt-2">Digest: {error.digest}</div>}
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="bg-transparent text-foreground border border-accent rounded-md px-5 py-2 cursor-pointer font-medium transition-all duration-200 hover:bg-accent hover:text-black"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="bg-transparent text-muted-foreground border border-card-border rounded-md px-5 py-2 cursor-pointer font-medium transition-all duration-200 hover:border-card-border-hover hover:text-foreground"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
