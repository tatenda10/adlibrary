import { CubeLoaderOverlay } from '../CubeLoader.jsx';
import SectionCard from './SectionCard.jsx';
import { CalendarIcon, CheckIcon, PlusIcon } from './PlannerIcons.jsx';

const FOLDER_COLORS = [
  { back: '#facc15', front: '#fcd34d', edge: '#eab308', paper: '#fff7d6', text: '#211600', muted: '#624700' },
  { back: '#fb923c', front: '#fdba74', edge: '#ea580c', paper: '#fff1e6', text: '#2b1304', muted: '#7c2d12' },
  { back: '#ef4444', front: '#f87171', edge: '#b91c1c', paper: '#ffe4e6', text: '#fff7ed', muted: '#fee2e2' },
  { back: '#8b5cf6', front: '#a78bfa', edge: '#6d28d9', paper: '#f3e8ff', text: '#ffffff', muted: '#ede9fe' },
  { back: '#2563eb', front: '#3b82f6', edge: '#1d4ed8', paper: '#dbeafe', text: '#eff6ff', muted: '#dbeafe' },
  { back: '#16a34a', front: '#22c55e', edge: '#15803d', paper: '#dcfce7', text: '#052e16', muted: '#14532d' },
];

function MonthFolderGrid({ months, selectedMonth, loading, creating, onAddMonth, onSelectMonth }) {
  return (
    <SectionCard
      title="Folders"
      actions={(
        <button
          type="button"
          onClick={onAddMonth}
          disabled={creating}
          title="Add month"
          aria-label="Add month"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-400 text-black hover:bg-emerald-300 disabled:opacity-60"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      )}
    >
      {loading ? (
        <CubeLoaderOverlay label="Loading month folders…" minHeight="220px" />
      ) : months.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {months.map((month, index) => (
            <FolderCover
              key={month.key}
              month={month}
              color={FOLDER_COLORS[index % FOLDER_COLORS.length]}
              active={month.key === selectedMonth}
              onClick={() => onSelectMonth(month.key)}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[260px] place-items-center rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
          <div>
            <div className="mx-auto h-20 w-28">
              <FolderShape muted />
            </div>
            <p className="mt-4 text-sm text-slate-400">No month folders yet.</p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function FolderCover({ month, color, active, onClick }) {
  const hasCalendar = Boolean(month.calendar?.length);

  return (
    <button type="button" onClick={onClick} className="group block w-full text-left">
      <div className="relative mx-auto h-[210px] max-w-[300px] [perspective:800px]">
        <FolderShape active={active} color={color} planned={hasCalendar} />
        <div className="absolute inset-x-5 bottom-4 z-30 flex h-[132px] flex-col justify-between rounded-[22px] p-5 transition duration-300 [transform-origin:top] group-hover:[transform:rotateX(-12deg)_scaleX(1.04)]" style={{ backgroundColor: color.front, color: color.text }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xl font-bold">{month.label}</p>
              <p className="mt-1 truncate text-xs font-semibold" style={{ color: color.muted }}>
                Social calendar
              </p>
            </div>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/10 text-sm font-bold">
              {hasCalendar ? month.calendar.length : 0}
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-xs font-bold" style={{ color: color.muted }}>
            {hasCalendar ? <CheckIcon className="h-3.5 w-3.5" /> : <CalendarIcon className="h-3.5 w-3.5" />}
            {hasCalendar ? `${month.calendar.length} planned days` : 'Empty folder'}
          </p>
        </div>
      </div>
    </button>
  );
}

function FolderShape({ active = false, muted = false, color = FOLDER_COLORS[0], planned = false }) {
  const solid = muted
    ? { back: '#334155', front: '#475569', edge: '#1f2937', paper: '#e2e8f0' }
    : color;

  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-x-7 bottom-0 top-11 rounded-[26px] opacity-50 shadow-[0_18px_32px_rgba(0,0,0,0.30)]"
        style={{ backgroundColor: solid.edge }}
      />
      <div
        className="absolute left-8 top-4 h-10 w-[54%] rounded-t-[22px]"
        style={{
          backgroundColor: solid.back,
          clipPath: 'polygon(0 0, 62% 0, 100% 100%, 0 100%)',
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.12)',
        }}
      />
      <div
        className="absolute inset-x-6 bottom-0 top-9 rounded-[26px]"
        style={{
          backgroundColor: solid.back,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 18px 34px rgba(0,0,0,0.18)',
        }}
      />
      <div
        className="absolute inset-x-12 bottom-8 z-10 h-[122px] rounded-xl bg-white shadow-[0_0_38px_rgba(0,0,0,0.16)] transition duration-300 group-hover:-translate-y-3"
        style={{ backgroundColor: solid.paper }}
      />
      {planned ? (
        <div className="absolute inset-x-16 bottom-11 z-20 space-y-2 opacity-75 transition duration-300 group-hover:-translate-y-3">
          <div className="h-2 rounded-full bg-black/15" />
          <div className="h-2 w-3/4 rounded-full bg-black/10" />
          <div className="h-2 w-1/2 rounded-full bg-black/10" />
        </div>
      ) : null}
      <div
        className={[
          'absolute inset-x-5 bottom-4 z-20 h-[132px] rounded-[22px]',
          active ? 'ring-2 ring-emerald-300 ring-offset-2 ring-offset-black' : '',
        ].join(' ')}
        style={{
          backgroundColor: solid.front,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -8px 0 rgba(0,0,0,0.10), 0 18px 30px rgba(0,0,0,0.24)',
        }}
      />
    </div>
  );
}

export default MonthFolderGrid;
