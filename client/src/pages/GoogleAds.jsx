const campaignCards = [
  {
    title: 'Search Winners',
    summary: 'High-intent ad groups with clear commercial keywords and short conversion paths.',
    metric: 'CTR 8.4%',
    note: 'Use exact-match problem queries and route to focused landing pages.',
  },
  {
    title: 'Display Retargeting',
    summary: 'Reminder creatives built for users who already visited pricing or demo pages.',
    metric: 'CPA $18',
    note: 'Keep copy minimal, repeat one core proof point, and tighten audience windows.',
  },
  {
    title: 'YouTube Hooks',
    summary: 'Video-first concepts that open with a claim, proof frame, or direct pain point.',
    metric: 'View rate 31%',
    note: 'Front-load result visuals and test shorter 6s and 15s variants.',
  },
];

const keywordThemes = [
  { theme: 'Problem Aware', examples: ['crm for small teams', 'reduce lead response time', 'ad spy alternatives'] },
  { theme: 'Competitor', examples: ['better than hubspot', 'similar to semrush', 'alternative to clickup'] },
  { theme: 'Solution Aware', examples: ['landing page builder', 'appointment booking software', 'facebook ad tracker'] },
];

function GoogleAds() {
  return (
    <section className="space-y-4">
      <div className="rounded-lg app-card p-5">
        <p className="text-xs uppercase tracking-[0.18em] app-muted">Google Ads</p>
        <h2 className="mt-1 text-xl font-semibold">Static Research Workspace</h2>
        <p className="mt-2 max-w-3xl text-sm app-muted">
          Starter data for search, display, and YouTube research. This is static for now, but the layout is ready for live campaign and keyword ingest.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {campaignCards.map((card) => (
          <article key={card.title} className="rounded-lg app-card p-4">
            <p className="text-xs uppercase tracking-[0.14em] app-muted">{card.metric}</p>
            <h3 className="mt-2 text-lg font-semibold">{card.title}</h3>
            <p className="mt-2 text-sm app-muted">{card.summary}</p>
            <p className="mt-3 text-sm">{card.note}</p>
          </article>
        ))}
      </div>

      <div className="rounded-lg app-card overflow-hidden">
        <div className="app-panel-soft border-b px-4 py-3" style={{ borderColor: 'var(--app-border)' }}>
          <h3 className="text-sm font-semibold">Keyword Theme Bank</h3>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          {keywordThemes.map((group) => (
            <section key={group.theme} className="rounded-md app-panel-soft p-3">
              <p className="text-xs uppercase tracking-[0.12em] app-muted">{group.theme}</p>
              <div className="mt-3 space-y-2 text-sm">
                {group.examples.map((example) => (
                  <p key={example}>{example}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

export default GoogleAds;
