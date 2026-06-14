import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Dashboard render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b1022] text-slate-200 flex items-center justify-center px-4">
          <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
            <h1 className="text-2xl font-black text-rose-300">Server Offline</h1>
            <p className="text-sm text-slate-200 mt-2">Dashboard failed to load. Please check backend connectivity and try again.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
