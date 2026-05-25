import SectionCard from './SectionCard.jsx';
import { ClipboardIcon } from './PlannerIcons.jsx';

function DayPlanView({ day, monthLabel, onBack }) {
  return (
    <div className="space-y-4">
      <SectionCard
        title={day.date}
        actions={(
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold text-white"
          >
            Back to calendar
          </button>
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/[0.08] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{monthLabel}</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{day.topic}</h2>
            <p className="mt-3 text-sm text-slate-300">
              {day.weekday} - {day.platform} - {day.format}
            </p>
            <p className="mt-2 text-sm text-slate-400">{day.pillar}</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start gap-3">
              <ClipboardIcon className="mt-0.5 h-5 w-5 text-emerald-300" />
              <div>
                <p className="text-sm font-semibold text-white">Task</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{day.task}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <Detail label="Hook" value={day.hook} />
              <Detail label="Caption prompt" value={day.caption_prompt} />
              <Detail label="CTA" value={day.cta} />
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-200">{value || 'Not set'}</p>
    </div>
  );
}

export default DayPlanView;
