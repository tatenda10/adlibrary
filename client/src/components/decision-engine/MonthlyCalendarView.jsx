import SectionCard from './SectionCard.jsx';
import { buildCalendarCells, isTodayDate, WEEKDAYS } from './plannerUtils.js';

function MonthlyCalendarView({ month, highlightedDate, recalculating, onRecalculate, onSelectDay }) {
  const cells = buildCalendarCells(month.key, month.calendar || []);

  return (
    <SectionCard title="Calendar">
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-950">{month.label}</p>
              <p className="text-xs text-slate-500">
                {month.calendar?.length ? `${month.calendar.length} planned days` : 'Generate to add plans to these dates'}
              </p>
            </div>
            <button
              type="button"
              onClick={onRecalculate}
              disabled={recalculating}
              className="rounded-sm bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {recalculating ? 'Recalculating...' : 'Recalculate'}
            </button>
          </div>

          <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
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
                  <div key={`blank-${index}`} className="min-h-[126px] border-b border-r border-slate-200 bg-white" />
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
    ? 'cursor-pointer hover:bg-emerald-50/50'
    : 'cursor-default text-slate-500';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!cell.hasPlan}
      className={`min-h-[126px] border-b border-r border-slate-200 p-2 text-left transition ${base} ${selected ? 'bg-emerald-50' : 'bg-white'}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={active ? 'grid h-7 w-7 place-items-center rounded-full bg-emerald-400 text-sm font-bold text-white' : 'text-sm font-semibold text-slate-700'}>
          {cell.day}
        </span>
        {cell.hasPlan ? <span className="h-2 w-2 rounded-full bg-emerald-300" /> : null}
      </span>

      {cell.hasPlan ? (
        <span className="mt-3 block">
          <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-600">{cell.platform}</span>
          <span className="mt-1 line-clamp-2 text-xs font-semibold text-slate-950">{cell.topic}</span>
          <span className="mt-1 line-clamp-2 text-[11px] text-slate-500">{cell.format}</span>
        </span>
      ) : (
        <span className="mt-8 block text-center text-xs text-slate-400">No plan</span>
      )}
    </button>
  );
}

export default MonthlyCalendarView;
