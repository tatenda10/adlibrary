import SectionCard from './SectionCard.jsx';
import { buildCalendarCells, isTodayDate, WEEKDAYS } from './plannerUtils.js';

function MonthlyCalendarView({ month, highlightedDate, onSelectDay }) {
  const cells = buildCalendarCells(month.key, month.calendar || []);

  return (
    <SectionCard title="Calendar">
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-white">{month.label}</p>
              <p className="text-xs text-slate-400">
                {month.calendar?.length ? `${month.calendar.length} planned days` : 'Generate to add plans to these dates'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-flex h-3 w-3 rounded-full bg-emerald-400" />
              Today or selected date
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10 bg-black/25">
            <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.03]">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {cells.map((cell, index) => (
                cell ? (
                  <CalendarDate
                    key={cell.date}
                    cell={cell}
                    active={cell.date === highlightedDate || isTodayDate(cell.date)}
                    selected={cell.date === highlightedDate}
                    onSelect={() => cell.hasPlan && onSelectDay(cell.date)}
                  />
                ) : (
                  <div key={`blank-${index}`} className="min-h-[126px] border-b border-r border-white/10 bg-white/[0.01]" />
                )
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function CalendarDate({ cell, active, selected, onSelect }) {
  const base = cell.hasPlan
    ? 'cursor-pointer hover:bg-white/[0.05]'
    : 'cursor-default text-slate-500';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!cell.hasPlan}
      className={`min-h-[126px] border-b border-r border-white/10 p-2 text-left transition ${base} ${selected ? 'bg-emerald-400/[0.12]' : 'bg-black/10'}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={active ? 'grid h-7 w-7 place-items-center rounded-full bg-emerald-400 text-sm font-bold text-black' : 'text-sm font-semibold text-slate-200'}>
          {cell.day}
        </span>
        {cell.hasPlan ? <span className="h-2 w-2 rounded-full bg-emerald-300" /> : null}
      </span>

      {cell.hasPlan ? (
        <span className="mt-3 block">
          <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-300">{cell.platform}</span>
          <span className="mt-1 line-clamp-2 text-xs font-semibold text-white">{cell.topic}</span>
          <span className="mt-1 line-clamp-2 text-[11px] text-slate-400">{cell.format}</span>
        </span>
      ) : (
        <span className="mt-8 block text-center text-xs text-slate-600">No plan</span>
      )}
    </button>
  );
}

export default MonthlyCalendarView;
