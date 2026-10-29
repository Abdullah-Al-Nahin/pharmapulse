import React, { Component, useEffect } from 'react';
import { PharmaPulseDashboard } from './components/pharmapulse/PharmaPulseDashboard';
import { LoginPage } from './components/auth/LoginPage';
import { PharmacyService } from './services/pharmacyService';
import { useAuth } from './context/AuthContext';
import { initializeDomTranslator } from './i18n/domTranslator';
import { getCurrentLocale } from './utils/i18nFormatter';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };
  declare props: Readonly<ErrorBoundaryProps>;
  declare setState: Component<ErrorBoundaryProps, ErrorBoundaryState>['setState'];

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PharmaPulse UI Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-emerald-400">Session State Recovered</h2>
            <p className="text-sm text-slate-300">
              A temporary display error occurred and was intercepted before closing your workspace.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
              >
                Resume Workspace
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    document.documentElement.lang = getCurrentLocale();
    initializeDomTranslator();
    PharmacyService.initialize();
  }, []);

  return (
    <AppErrorBoundary>
      {!isAuthenticated ? <LoginPage /> : <PharmaPulseDashboard />}
    </AppErrorBoundary>
  );
}
