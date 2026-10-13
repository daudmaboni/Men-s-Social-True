// A "template" re-runs every time you switch tabs,
// so each page fades in fresh — like Fernly's page changes.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
