"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 p-6">
          <div className="text-[28px]">⚠️</div>
          <div className="font-serif text-[15px] font-bold text-dn">Terjadi Kesalahan</div>
          <div className="font-mono text-[11px] text-ink-dim text-center max-w-[400px]">
            {this.state.error?.message ?? "Unknown error"}
          </div>
          <button
            type="button"
            className="btn btn-ghost text-[11px]"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Coba lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
