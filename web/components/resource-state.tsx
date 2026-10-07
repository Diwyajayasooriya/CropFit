export function ResourceState({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) {
  if (loading) return <p role="status" className="p-6 text-slate-500 animate-pulse">Loading greenhouse data…</p>;
  if (error) return <div role="alert" className="p-5 rounded-xl bg-rose-50 text-rose-800"><p>{error}</p><button className="mt-2 underline" onClick={retry}>Try again</button></div>;
  return null;
}
