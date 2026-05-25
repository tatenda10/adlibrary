import CubeLoader from './CubeLoader.jsx';

function AnalysisModal({ video, analysis, isLoading, error, onClose }) {
  if (!video) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">AI Breakdown</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{video.caption || video.url}</h3>
          </div>
          <button onClick={onClose} className="rounded-md border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800">
            Close
          </button>
        </div>

        {isLoading ? <CubeLoader label="Analyzing video…" size={80} className="py-6" /> : null}
        {error && <p className="text-sm text-rose-300">{error}</p>}

        {!isLoading && !error && analysis && (
          <div className="grid gap-3">
            <Section title="Hook" value={analysis.hook} />
            <Section title="Structure" value={analysis.structure} />
            <Section title="CTA" value={analysis.cta} />
            <Section title="Viral Factor" value={analysis.viral_factor} />
            <Section title="Content Angle" value={analysis.content_angle} />
            <Section title="Replication Tips" value={analysis.replication_tips} />
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, value }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-950/45 p-3">
      <h4 className="text-xs uppercase tracking-[0.15em] text-cyan-300">{title}</h4>
      <p className="mt-1 text-sm text-slate-200">{value || 'No data returned.'}</p>
    </section>
  );
}

export default AnalysisModal;
