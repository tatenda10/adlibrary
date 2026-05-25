const hookTypes = [
  {
    title: 'Pattern Interrupt',
    description: 'Start with something unexpected in the first 1-2 seconds to stop scrolling.',
    examples: ['"I spent $0 and got 120 leads."', '"This ad format is quietly winning in 2026."'],
  },
  {
    title: 'Pain-Point Callout',
    description: 'Name the exact frustration your audience feels so they instantly self-identify.',
    examples: ['"Still getting clicks but no sales?"', '"If your CPAs keep rising, watch this."'],
  },
  {
    title: 'Curiosity Gap',
    description: 'Tease a result or method without revealing everything up front.',
    examples: ['"The 3-second change that improved retention."', '"We fixed this with one script line."'],
  },
  {
    title: 'Proof First',
    description: 'Lead with evidence before explanation to establish trust quickly.',
    examples: ['"Here is the exact dashboard after 7 days."', '"Before vs after from one creative test."'],
  },
  {
    title: 'Contrarian Take',
    description: 'Challenge a common belief to create immediate interest.',
    examples: ['"More targeting is hurting your ads."', '"Viral edits are not the best for conversion."'],
  },
  {
    title: 'Direct Offer',
    description: 'Say who this is for and what they get right away.',
    examples: ['"For local gyms: 5 ad hooks to book more trials."', '"DTC founders: steal this UGC brief template."'],
  },
];

const hookTemplates = [
  'Nobody talks about this [topic]...',
  'This will change how you see [topic]...',
  'I learned this too late about [topic]...',
  'Most people don’t realize [truth]...',
  'This is why you’re still [blank]...',
  'Here is the truth about [topic]...',
  'Avoid this mistake when [action]...',
  'This is the real reason you’re [blank]...',
  'If I had to start over with [topic]...',
  'If you are [audience], listen carefully...',
];

const creativeRules = [
  { label: 'Do', text: 'Keep the core hook inside the first 3 seconds.' },
  { label: 'Do', text: 'Use on-screen text so videos work without sound.' },
  { label: 'Do', text: 'Show product/context early, not only at the end.' },
  { label: "Don't", text: 'Use long intros before value is clear.' },
  { label: "Don't", text: 'Overload one ad with too many messages.' },
  { label: "Don't", text: 'Depend only on trends without a clear offer.' },
];

function TikTokKnowledgeHub() {
  return (
    <section className="space-y-4">
      <div className="rounded-lg p-5" style={{ background: 'var(--app-panel)' }}>
        <h2 className="text-lg font-semibold">Knowledge Hub</h2>
        <p className="mt-2 text-sm app-muted">
          Static starter content for hook strategy and ad creative direction. You can expand this with your own playbooks next.
        </p>
      </div>

      <div className="rounded-lg p-5" style={{ background: 'var(--app-panel)' }}>
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] app-muted">Hook Types</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {hookTypes.map((item) => (
            <article key={item.title} className="rounded-sm p-3" style={{ background: 'var(--app-panel-2)' }}>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs app-muted">{item.description}</p>
              <div className="mt-2 space-y-1">
                {item.examples.map((example) => (
                  <p key={example} className="text-xs">- {example}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg p-5" style={{ background: 'var(--app-panel)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] app-muted">Hook Templates</h3>
          <div className="mt-3 space-y-2">
            {hookTemplates.map((template) => (
              <p key={template} className="rounded-sm px-3 py-2 text-sm" style={{ background: 'var(--app-panel-2)' }}>
                {template}
              </p>
            ))}
          </div>
        </div>

        <div className="rounded-lg p-5" style={{ background: 'var(--app-panel)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] app-muted">Creative Checklist</h3>
          <div className="mt-3 space-y-2">
            {creativeRules.map((rule, index) => (
              <p key={`${rule.label}-${index}`} className="rounded-sm px-3 py-2 text-sm" style={{ background: 'var(--app-panel-2)' }}>
                <span className={rule.label === 'Do' ? 'text-emerald-500' : 'text-rose-500'}>{rule.label}:</span> {rule.text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default TikTokKnowledgeHub;
