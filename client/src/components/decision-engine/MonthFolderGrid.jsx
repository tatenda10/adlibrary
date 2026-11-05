import { CubeLoaderOverlay } from '../CubeLoader.jsx';
import { PlusIcon } from './PlannerIcons.jsx';
import folderImage from '../../assets/folder.png';

function MonthFolderGrid({ months, selectedMonth, loading, creating, onAddMonth, onSelectMonth }) {
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={folderImage} alt="" className="h-10 w-10 object-contain" />
          <div>
            <p className="text-sm font-bold text-slate-950">Content Calendar</p>
            <p className="text-xs text-slate-500">Plan and organize monthly content.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddMonth}
          disabled={creating}
          title="Add month"
          aria-label="Add month"
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <CubeLoaderOverlay label="Loading month folders…" minHeight="220px" />
      ) : months.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {months.map((month) => (
            <FolderCover
              key={month.key}
              month={month}
              active={month.key === selectedMonth}
              onClick={() => onSelectMonth(month.key)}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[260px] place-items-center bg-white p-6 text-center">
          <div>
            <img src={folderImage} alt="" className="mx-auto h-28 w-28 object-contain opacity-80" />
            <p className="mt-4 text-sm text-slate-500">No month folders yet.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function FolderCover({ month, active, onClick }) {
  const hasCalendar = Boolean(month.calendar?.length);

  return (
    <button type="button" onClick={onClick} className="group block w-full text-center">
      <div
        className={`mx-auto max-w-[220px] rounded-sm p-3 transition ${
          active ? 'bg-emerald-50 ring-2 ring-emerald-300' : 'hover:bg-slate-50'
        }`}
      >
        <img
          src={folderImage}
          alt=""
          className="mx-auto h-36 w-36 object-contain transition duration-200 group-hover:-translate-y-1"
        />
        <div className="mt-2">
          <p className="truncate text-sm font-bold text-slate-950">{month.label}</p>
          <p className="mt-1 text-xs text-slate-500">
            {hasCalendar ? `${month.calendar.length} planned days` : 'Empty folder'}
          </p>
        </div>
      </div>
    </button>
  );
}

export default MonthFolderGrid;
