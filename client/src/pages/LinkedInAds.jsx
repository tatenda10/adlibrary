const workflowCards = [
  {
    title: 'Ad Library Research',
    detail: 'Search advertiser names, keywords, countries, and date ranges to inspect creative direction.',
  },
  {
    title: 'Campaign Management',
    detail: 'Connect ad accounts, creatives, and reporting once official access is approved.',
  },
  {
    title: 'Conversions API',
    detail: 'Send server-side conversion signals for more reliable attribution than browser-only tracking.',
  },
];

const launchChecklist = [
  'Apply for LinkedIn developer access and confirm the exact product scope you need.',
  'Decide whether you need Ad Library research, campaign management, or conversion tracking.',
  'Use OAuth for account-linked integrations and separate system tokens for server-to-server event flows.',
  'Version your LinkedIn API calls because LinkedIn sunsets monthly versions aggressively.',
];

function LinkedInAds() {
  return (
    <section className="space-y-4">
      <div className="rounded-lg app-card p-5">
        <p className="text-xs uppercase tracking-[0.18em] app-muted">LinkedIn</p>
        <h2 className="mt-1 text-xl font-semibold">Static LinkedIn Workspace</h2>
        <p className="mt-2 max-w-3xl text-sm app-muted">
          Placeholder page for LinkedIn ad research and account integrations. Once access is approved, this can split into Ad Library, Campaign Manager, and conversion workflows.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {workflowCards.map((card) => (
          <article key={card.title} className="rounded-lg app-card p-4">
            <h3 className="text-lg font-semibold">{card.title}</h3>
            <p className="mt-2 text-sm app-muted">{card.detail}</p>
          </article>
        ))}
      </div>

      <div className="rounded-lg app-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] app-muted">Launch Checklist</h3>
        <div className="mt-3 space-y-2">
          {launchChecklist.map((item) => (
            <p key={item} className="rounded-md app-panel-soft px-3 py-2 text-sm">
              {item}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export default LinkedInAds;
