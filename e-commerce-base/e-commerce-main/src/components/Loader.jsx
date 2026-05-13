function Loader({ message = "Loading", count = 6 }) {
  return (
    <div className="space-y-6 py-10" role="status" aria-live="polite">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
        <div className="h-10 w-72 animate-pulse rounded-full bg-slate-200" />
      </div>
      <p className="text-sm text-[var(--color-text-soft)]">{message}</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="glass-panel space-y-4 rounded-[2rem] p-5">
            <div className="h-56 animate-pulse rounded-[1.5rem] bg-slate-200" />
            <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
            <div className="h-6 w-3/4 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-200" />
            <div className="h-12 w-full animate-pulse rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default Loader;
