function Influencers() {
  return (
    <section className="min-h-full bg-white text-slate-950">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        <header className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.03em]">Influencers</h1>
              <p className="mt-1 text-sm text-slate-500">Persistent AI characters: train once, generate endlessly.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">10 credits</span>
              <button type="button" className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white">
                + New influencer
              </button>
            </div>
          </div>
        </header>

        <section className="grid min-h-[520px] place-items-center rounded-md border border-slate-200 bg-white p-4">
          <div className="max-w-lg text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-md border border-slate-200 bg-slate-50 text-emerald-600">
              <InfluencerIcon />
            </div>
            <h2 className="mt-4 text-xl font-semibold">Create your first AI influencer</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Pick traits, generate a base character, and reuse the same influencer across every piece of content.
            </p>
            <button type="button" className="mt-5 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white">
              + New influencer
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

function InfluencerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8.5 17c.8-2 2-3 3.5-3s2.7 1 3.5 3" strokeLinecap="round" />
    </svg>
  );
}

export default Influencers;
