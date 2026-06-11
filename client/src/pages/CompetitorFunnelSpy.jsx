import { Link } from 'react-router-dom';

const workflowSteps = [
  {
    title: 'Collect active ads',
    text: 'Start from a competitor Meta Ad Library URL or advertiser and pull the live ads connected to that account.',
  },
  {
    title: 'Cluster by landing page',
    text: 'Group ads by the destination page they point to so the pages carrying real spend rise above one-off tests.',
  },
  {
    title: 'Rank the proven winners',
    text: 'Sort landing pages by ad volume, creative variety, and run duration so the strongest funnels surface first.',
  },
  {
    title: 'Tear down the full funnel',
    text: 'Analyze hooks, offers, social proof, pricing, cart lifts, and checkout mechanics from click to conversion.',
  },
];

const deliverables = [
  'Winning landing pages ranked by ad support',
  'Creative breakdowns for top ads and videos',
  'Offer, pricing, and proof analysis for each page',
  'Cart and checkout notes for bundles, thresholds, and upsells',
  'A clean export-ready report saved into your workspace',
];

const useCases = [
  {
    title: 'DTC brand research',
    text: 'See which competitor pages are actually carrying spend and which offer structures are doing the heavy lifting.',
  },
  {
    title: 'Agency teardown reports',
    text: 'Turn ad research into a client-facing funnel report instead of a disconnected swipe file of screenshots.',
  },
  {
    title: 'Creative strategy planning',
    text: 'Connect the ad angle to the page angle so your team can model the entire journey, not just the hook.',
  },
];

function CompetitorFunnelSpy() {
  return (
    <div className="space-y-6">
      <section className="rounded-sm border border-white/10 bg-[radial-gradient(circle_at_15%_15%,rgba(34,197,94,0.12),transparent_32%),linear-gradient(180deg,#0b0b0b_0%,#090909_100%)] p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Competitor Funnel Spy</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold text-white md:text-4xl">
              Reverse-engineer the pages, offers, and cart mechanics behind a competitor&apos;s active ads.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              This workflow goes beyond the ad creative. It helps your team find the landing pages actually carrying spend, break down the post-click experience, and capture the funnel mechanics worth borrowing.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-sm bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
              >
                Run Funnel Breakdown
              </button>
              <Link
                to="/facebook/ads"
                className="rounded-sm border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Start From Facebook Research
              </Link>
            </div>
          </div>

          <div className="rounded-sm border border-emerald-400/25 bg-emerald-400/[0.06] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">What you get</p>
            <ul className="mt-4 space-y-3">
              {deliverables.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workflowSteps.map((step, index) => (
          <article key={step.title} className="rounded-sm border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Step {index + 1}</p>
            <h2 className="mt-2 text-lg font-semibold text-white">{step.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{step.text}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-sm border border-white/10 bg-white/[0.03] p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Run setup</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">How this workflow will run in ViralAdLibrary</h2>

          <div className="mt-6 space-y-4">
            <div className="rounded-sm border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Input</p>
              <p className="mt-2 text-sm text-white">Competitor Meta Ad Library URL, brand, or advertiser page</p>
            </div>
            <div className="rounded-sm border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Ranking logic</p>
              <p className="mt-2 text-sm text-white">Ad count, run duration, creative density, and page reuse across active ads</p>
            </div>
            <div className="rounded-sm border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Post-click audit</p>
              <p className="mt-2 text-sm text-white">Headline, offer framing, proof, pricing, cart lifts, bundles, gifts, and shipping thresholds</p>
            </div>
          </div>
        </article>

        <article className="rounded-sm border border-white/10 bg-white/[0.03] p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Best use cases</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Where this becomes a real advantage</h2>

          <div className="mt-6 space-y-4">
            {useCases.map((item) => (
              <div key={item.title} className="rounded-sm border border-white/10 bg-black/25 p-4">
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

export default CompetitorFunnelSpy;
