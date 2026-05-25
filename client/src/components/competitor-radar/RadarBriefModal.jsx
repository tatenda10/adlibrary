import { useEffect } from 'react';
import { CloseIcon, RadarIcon } from './RadarIcons.jsx';

const EXAMPLE_BRIEFS = [
  'Find direct competitors for a health and wellness brand selling supplements to women 30-55 in the US. Include websites, audience, offers, and how long they seem to have operated.',
  'Find newer DTC skincare competitors that are strong on TikTok and Instagram. I care about hooks, audience, pricing, and launch age.',
  'Find local competitors for a premium fitness coaching business. Show their websites, audience, positioning, and what to verify next.',
];

function RadarBriefModal({ open, brief, working, canRun, onBriefChange, onClose, onRun }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" role="dialog" aria-modal="true" aria-label="New competitor radar">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close competitor radar modal"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/12 bg-[#070707] p-4 shadow-2xl md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">New radar</p>
            <h2 className="mt-1 text-base font-semibold text-white">Describe what to find</h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">
              Write it naturally. The saved brand profile is added in the background.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <textarea
          value={brief}
          onChange={(event) => onBriefChange(event.target.value)}
          placeholder="Find direct competitors for..."
          className="mt-4 min-h-[180px] w-full resize-y rounded-xl border border-white/12 bg-black px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/60"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_BRIEFS.map((example) => (
            <button
              type="button"
              key={example}
              onClick={() => onBriefChange(example)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-left text-[11px] text-slate-300 hover:border-emerald-400/40 hover:text-white"
            >
              {example.slice(0, 64)}...
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-5 text-slate-500">Dates, websites, and operating age are marked for verification when evidence is uncertain.</p>
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-xs font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <RadarIcon className="h-3.5 w-3.5" />
            {working === 'radar' ? 'Running...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RadarBriefModal;
