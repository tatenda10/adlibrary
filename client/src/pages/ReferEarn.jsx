function ReferEarn() {
  return (
    <section className="min-h-full bg-white text-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              <GiftIcon className="h-4 w-4" />
              Referral Program
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Refer & Earn</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Invite marketers and creative teams to ViralAdLibrary. Track referrals, customers, and pending commission from one place.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-emerald-200 hover:text-emerald-700"
          >
            What is this?
          </button>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold">Your referral link</h2>
              <p className="mt-1 text-sm text-slate-500">Share this link with people who would benefit from the platform.</p>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-3">
                <div className="min-w-[280px] flex-1 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  https://viraladlibrary.site?ref=viral
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:border-emerald-200 hover:text-emerald-700"
                >
                  <CopyIcon />
                  Copy link
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <ArrowUpRightIcon />
                  Open link
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Program status</h2>
                <p className="mt-1 text-sm text-slate-500">All-time referral activity.</p>
              </div>
              <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Active</span>
            </div>
            <div className="mt-5 space-y-3">
              <MiniMetric label="Commission rate" value="20%" />
              <MiniMetric label="Payout window" value="Monthly" />
              <MiniMetric label="Cookie period" value="30 days" />
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-md border border-slate-200 bg-white p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">ViralAdLibrary totals</h2>
              <p className="mt-1 text-sm text-slate-500">Performance across your referral link.</p>
            </div>
            <p className="text-sm text-slate-500">All time</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard title="Total referrals" value="0" note="No referrals yet" />
            <StatCard title="Customers" value="0" note="No customers yet" />
            <StatCard title="Pending commission" value="$0.00" note="No pending commission" />
          </div>
        </section>

        <section className="mt-5 rounded-md border border-slate-200 bg-white">
          <div className="grid gap-0 md:grid-cols-[1fr_1fr_1fr]">
            <InfoStep title="1. Share" text="Send your referral link to founders, creators, and marketing teams." />
            <InfoStep title="2. They join" text="When someone signs up from your link, they appear in your referral activity." />
            <InfoStep title="3. You earn" text="Commission is tracked when referred users become paying customers." />
          </div>
        </section>

        <section className="mt-5 rounded-md border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-md bg-slate-950 text-white">
                <LogoMark />
              </div>
              <div>
                <h2 className="text-lg font-semibold">ViralAdLibrary Racers</h2>
                <p className="mt-1 text-sm text-slate-500">Affiliate and referral program</p>
              </div>
            </div>
            <span className="text-sm text-slate-400">Powered by ViralAdLibrary</span>
          </div>
        </section>
      </div>
    </section>
  );
}

function StatCard({ title, value, note }) {
  return (
    <article className="rounded-md border border-slate-200 p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </article>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function InfoStep({ title, text }) {
  return (
    <article className="border-b border-slate-200 p-5 md:border-b-0 md:border-r md:last:border-r-0">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </article>
  );
}

function GiftIcon({ className = 'h-7 w-7' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 11h16v9H4zM3 7h18v4H3z" />
      <path d="M12 7v13M8.5 7C6 6.5 6 3.5 8 3.5S12 7 12 7s2-3.5 4-3.5 2 3-.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17 17 7" strokeLinecap="round" />
      <path d="M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 16 17 4" strokeLinecap="round" />
      <path d="M7 20 20 7" strokeLinecap="round" />
      <path d="M4 10h7M13 14h7" strokeLinecap="round" />
    </svg>
  );
}

export default ReferEarn;
