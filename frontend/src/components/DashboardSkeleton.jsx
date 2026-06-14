function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-slate-800/80 ${className}`} />;
}

export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#0b1022] text-slate-200 pb-20 lg:pb-6">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5 grid lg:grid-cols-[16.5rem_1fr] gap-4 lg:gap-6">
        <aside className="hidden lg:block rounded-3xl border border-slate-700/50 bg-slate-900/75 p-4 h-fit">
          <SkeletonBlock className="h-8 w-44 mb-5" />
          <div className="space-y-2">
            <SkeletonBlock className="h-10" />
            <SkeletonBlock className="h-10" />
            <SkeletonBlock className="h-10" />
            <SkeletonBlock className="h-10" />
          </div>
        </aside>

        <main className="space-y-4">
          <SkeletonBlock className="h-14" />
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-24" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SkeletonBlock className="h-80" />
            <SkeletonBlock className="h-80" />
            <SkeletonBlock className="h-80" />
            <SkeletonBlock className="h-80" />
          </div>
        </main>
      </div>
    </div>
  );
}
