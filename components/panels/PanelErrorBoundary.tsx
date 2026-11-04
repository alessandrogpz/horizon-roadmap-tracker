"use client";

import React from "react";
import { TriangleAlert } from "lucide-react";

interface Props {
  /** Shown in the fallback so it's obvious which module failed. */
  label: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Contains a crash to the panel that caused it. Without this, one module
 * throwing on malformed data takes the whole dashboard down to app/error.tsx
 * — including the modules that were rendering fine, and the sync button
 * needed to pull down a good copy of the data.
 */
export default class PanelErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`Panel "${this.props.label}" crashed:`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="glass-panel flex flex-col gap-3 border-l-4 !border-l-warning">
        <h2 className="section-title !mb-0">
          <TriangleAlert size={14} strokeWidth={2.5} className="section-icon !text-warning" />
          {this.props.label} unavailable
        </h2>
        <p className="text-[0.8rem] text-muted-foreground m-0">
          This module hit an error, so it&apos;s been isolated. The rest of your dashboard is unaffected and your data
          is untouched.
        </p>
        <code className="text-[0.7rem] text-danger font-mono break-all">{error.message}</code>
        <button
          onClick={() => this.setState({ error: null })}
          className="btn px-3 py-1.5 text-[0.8rem] self-start !bg-transparent !text-muted-foreground !border-card-border hover:!text-foreground"
        >
          Try again
        </button>
      </div>
    );
  }
}
