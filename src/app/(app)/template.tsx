// Re-runs on every page change. Pages that open on top of a tab (an article, sign-up…)
// slide in from the right, like on an iPhone. The main tabs themselves don't use this.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="slide-from-right">{children}</div>;
}
