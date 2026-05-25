import CubeLoader from './CubeLoader.jsx';

function SearchBar({ keyword, onKeywordChange, onSearch, isLoading }) {
  return (
    <form onSubmit={onSearch} className="grid gap-3 rounded-xl border border-slate-700/70 bg-slate-950/55 p-4 md:grid-cols-[1fr_auto]">
      <input
        value={keyword}
        onChange={(event) => onKeywordChange(event.target.value)}
        placeholder="Search TikTok niche keyword (e.g. gym, skincare, faceless ai)"
        className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-400 transition focus:ring"
      />
      <button
        disabled={isLoading}
        className="rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? <CubeLoader size={40} /> : 'Search'}
      </button>
    </form>
  );
}

export default SearchBar;
