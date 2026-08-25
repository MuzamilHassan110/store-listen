export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">Store Listien</p>
        <h1 className="text-4xl font-semibold tracking-tight">Store listing app is ready to build</h1>
        <p className="max-w-xl text-slate-300">
          Frontend is running on Vite. The API health check lives at{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-emerald-300">/api/health</code>.
        </p>
      </section>
    </main>
  );
}
