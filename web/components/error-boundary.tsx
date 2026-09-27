// ============================================================
// CropFit — Global Error Boundary (Light / White Theme)
// Catches render exceptions, displays resilient fallback view
// ============================================================

'use client';

import React, { Component, type ReactNode } from 'react';
import { AlertTriangleIcon } from './icons';

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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CropFit ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl border border-rose-200 bg-white text-center space-y-4 shadow-xl shadow-slate-200/60">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangleIcon size={24} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-slate-900">
                Greenhouse Interface Error
              </h3>
              <p className="text-xs text-slate-500">
                An unexpected interface issue occurred. Your greenhouse edge hub continues running unaffected.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left font-mono text-[11px] text-rose-700 overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold tracking-wide transition-colors shadow-sm cursor-pointer"
            >
              Reload View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
