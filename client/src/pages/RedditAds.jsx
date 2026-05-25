const subredditIdeas = [
  {
    community: 'r/Entrepreneur',
    angle: 'Founders looking for leverage, systems, and practical tools.',
    hook: 'Show the exact process, not just the outcome.',
  },
  {
    community: 'r/marketing',
    angle: 'Performance marketers comparing channels, attribution, and creative testing.',
    hook: 'Lead with benchmark deltas and what changed.',
  },
  {
    community: 'r/smallbusiness',
    angle: 'Operators who care about simplicity, margin, and immediate usefulness.',
    hook: 'Frame ads around time saved or leads booked.',
  },
];

const adFormats = [
  'Problem-led text ads with a strong first sentence.',
  'Conversation-style promoted posts that feel native to the thread.',
  'Case-study creatives with one chart or one clear before/after.',
  'Lead magnets positioned as tools, templates, or checklists.',
];

function RedditAds() {
  return (
    <section className="space-y-4">
      <div className="rounded-lg app-card p-5">
        <p className="text-xs uppercase tracking-[0.18em] app-muted">Reddit Ads</p>
        <h2 className="mt-1 text-xl font-semibold">Static Audience Map</h2>
        <p className="mt-2 max-w-3xl text-sm app-muted">
          A placeholder research page for subreddit targeting, angle mapping, and native creative concepts.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-lg app-card p-4">
          <h3 className="text-sm font-semibold">Subreddit Angle Ideas</h3>
          <div className="mt-3 space-y-3">
            {subredditIdeas.map((item) => (
              <section key={item.community} className="rounded-md app-panel-soft p-3">
                <p className="text-sm font-semibold">{item.community}</p>
                <p className="mt-1 text-sm app-muted">{item.angle}</p>
                <p className="mt-2 text-sm">{item.hook}</p>
              </section>
            ))}
          </div>
        </article>

        <article className="rounded-lg app-card p-4">
          <h3 className="text-sm font-semibold">Native Format Prompts</h3>
          <div className="mt-3 space-y-2">
            {adFormats.map((item) => (
              <p key={item} className="rounded-md app-panel-soft px-3 py-2 text-sm">
                {item}
              </p>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

export default RedditAds;
