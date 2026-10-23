// Step 89: what shows the moment he taps something that isn't loaded yet: the shape of a page, gently pulsing,
// instead of nothing happening. Server-safe (no hooks), so it can show before any code arrives.
export default function PageLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-5 w-24 animate-pulse rounded-full bg-line" />
      <div className="aspect-[5/4] w-full animate-pulse rounded-[24px] bg-forest-deep/15" />
      <div className="h-6 w-3/4 animate-pulse rounded-full bg-line" />
      <div className="h-4 w-full animate-pulse rounded-full bg-line/70" />
      <div className="h-4 w-5/6 animate-pulse rounded-full bg-line/70" />
      <div className="h-4 w-2/3 animate-pulse rounded-full bg-line/70" />
    </div>
  );
}
