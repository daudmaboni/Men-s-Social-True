export default function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="rise">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="mt-6 rounded-3xl bg-surface p-6 text-sm text-ink-soft ring-1 ring-line">
        {text}
      </div>
    </div>
  );
}
