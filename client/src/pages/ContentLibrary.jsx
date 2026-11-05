import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, getStaticAdExamples } from '../lib/api.js';

const PAGE_SIZE = 24;

function categoryLabel(value) {
  return value === 'all' ? 'All categories' : value;
}

function resolveMediaUrl(value) {
  if (!value) return '';
  if (String(value).startsWith('http') || String(value).startsWith('data:')) return value;
  return `${API_URL}${value}`;
}

function cleanAdCopy(value = '') {
  const ignoredLines = new Set(['viral', 'logo', 'logo here', 'brandlogo', '/']);
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !ignoredLines.has(line.toLowerCase()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toReadableTitle(value = '') {
  const text = cleanAdCopy(value);
  if (!text) return '';
  const letters = text.replace(/[^a-z]/gi, '');
  const uppercaseLetters = text.replace(/[^A-Z]/g, '');
  if (letters.length && uppercaseLetters.length / letters.length > 0.75) {
    const lower = text.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return text;
}

function getDisplayTitle(item) {
  const copyTitle = toReadableTitle(item.copy || item.notes || '');
  if (copyTitle && copyTitle.length > String(item.title || '').length + 10) return copyTitle;
  return toReadableTitle(item.title || copyTitle) || 'Static ad example';
}

function ContentLibrary() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewItem, setViewItem] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState(['all']);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getStaticAdExamples({
      category,
      search,
      page,
      limit: PAGE_SIZE,
    })
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setCategories(Array.isArray(data.categories) && data.categories.length ? data.categories : ['all']);
        setPagination({
          page: Number(data.pagination?.page || 1),
          limit: Number(data.pagination?.limit || PAGE_SIZE),
          total: Number(data.pagination?.total || 0),
          totalPages: Math.max(Number(data.pagination?.totalPages || 1), 1),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        setPagination((current) => ({ ...current, page: 1, total: 0, totalPages: 1 }));
        setError(err.message || 'Failed to load ad examples.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, search, page]);

  const totalPages = pagination.totalPages;
  const safePage = pagination.page;

  const handleCategoryChange = (value) => {
    setCategory(value);
    setPage(1);
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleReplicate = (item) => {
    const reference = {
      id: item.id,
      title: getDisplayTitle(item),
      brand_name: getDisplayTitle(item),
      category: item.category,
      notes: cleanAdCopy(item.copy || item.notes),
      tags: item.tags,
      image_url: resolveMediaUrl(item.image_url),
      source: 'meta_static_ads_ppt',
      source_slide: item.slide,
      selected_at: new Date().toISOString(),
    };
    try {
      sessionStorage.setItem('facebook_ad_reference', JSON.stringify(reference));
    } catch {
      // Continue navigation even if storage is unavailable.
    }
    navigate('/facebook/hook-generator');
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Facebook</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Ad Examples</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Categorized static ad copy templates extracted from the Meta Static Ads deck.
          </p>
        </div>
      </header>

      <div className="space-y-3 rounded-sm border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search hooks, testimonials, offers, benefits..."
            className="h-10 min-w-[260px] flex-1 rounded-sm border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-400"
          />
          <select
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value)}
            className="h-10 rounded-sm border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400"
          >
            {categories.map((item) => (
              <option key={item} value={item}>{categoryLabel(item)}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleCategoryChange(item)}
              className={`h-8 shrink-0 rounded-sm px-3 text-xs font-semibold transition ${
                category === item
                  ? 'bg-emerald-500 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
              }`}
            >
              {categoryLabel(item)}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-sm border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-950">Loading ad examples...</p>
        </div>
      ) : !items.length ? (
        <div className="rounded-sm border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-950">No ad examples found</p>
          <p className="mt-1 text-sm text-slate-500">Try another category or search term.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => (
              <article key={item.id} className="flex h-full flex-col overflow-hidden rounded-sm border border-slate-200 bg-white transition hover:border-emerald-200">
                <button type="button" onClick={() => setViewItem(item)} className="block w-full shrink-0 text-left">
                  <StaticAdPreview item={item} />
                </button>
                <div className="flex flex-1 flex-col p-4">
                  <div className="min-h-[88px]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">{item.category}</p>
                    <h2 className="mt-1 line-clamp-2 text-base font-semibold text-slate-950">{getDisplayTitle(item)}</h2>
                    <p className="mt-1 text-xs text-slate-400">Slide {item.slide}</p>
                  </div>
                  <p className="mt-3 min-h-[88px] line-clamp-4 text-sm leading-relaxed text-slate-600">{cleanAdCopy(item.notes || item.copy)}</p>
                  <div className="mt-3 flex min-h-[30px] flex-wrap content-start gap-1.5 overflow-hidden">
                    {(item.tags || []).slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-sm bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">{tag}</span>
                    ))}
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                    <button type="button" onClick={() => setViewItem(item)} className="rounded-sm border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      View
                    </button>
                    <button type="button" onClick={() => handleReplicate(item)} className="rounded-sm bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600">
                      Replicate
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 rounded-sm border border-slate-200 bg-white p-3">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={safePage <= 1}
              className="rounded-sm border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs font-semibold text-slate-500">Page {safePage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              disabled={safePage >= totalPages}
              className="rounded-sm border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}

      {viewItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative grid max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-md bg-white shadow-2xl md:grid-cols-[0.9fr_1.1fr]">
            <button
              type="button"
              onClick={() => setViewItem(null)}
              className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full bg-emerald-50 text-sm font-black text-emerald-700 hover:bg-emerald-100"
              aria-label="Close"
            >
              ×
            </button>

            <div className="flex flex-col justify-between gap-5 p-5">
              <div className="space-y-4">
                <span className="inline-flex rounded-sm bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  New
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">{viewItem.category}</p>
                  <h2 className="mt-2 text-lg font-semibold leading-snug text-slate-950">{getDisplayTitle(viewItem)}</h2>
                  <p className="mt-2 text-xs text-slate-500">Static Facebook ad template · Slide {viewItem.slide}</p>
                </div>

                <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                  <li className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                    Use this example as a proven creative starting point.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                    Replicate the structure, then adapt it to your own brand.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                    Keep the visual reference attached for the ad generator.
                  </li>
                </ul>

                <div className="flex flex-wrap gap-1.5">
                  {(viewItem.tags || []).slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-sm bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleReplicate(viewItem)}
                  className="w-full rounded-sm bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Replicate this ad
                </button>
                <button
                  type="button"
                  onClick={() => setViewItem(null)}
                  className="w-full rounded-sm px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Maybe later
                </button>
              </div>
            </div>

            <div className="grid min-h-[420px] place-items-center bg-emerald-700 p-8">
              <div className="w-full max-w-sm overflow-hidden rounded-md bg-slate-950/20 shadow-2xl ring-1 ring-white/15">
                {viewItem.image_url ? (
                  <img
                    src={resolveMediaUrl(viewItem.image_url)}
                    alt={getDisplayTitle(viewItem)}
                    className="h-full max-h-[62vh] w-full object-contain"
                  />
                ) : (
                  <div className="grid aspect-square place-items-center text-sm font-semibold text-white/70">
                    No preview image
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StaticAdPreview({ item, large = false }) {
  return (
    <div className={`overflow-hidden rounded-sm bg-slate-100 ${large ? 'min-h-[560px]' : 'h-[300px]'}`}>
      {item.image_url ? (
        <img
          src={resolveMediaUrl(item.image_url)}
          alt={item.title}
          loading="lazy"
          className={`${large ? 'max-h-[72vh] w-full object-contain' : 'h-full w-full object-cover object-top'}`}
        />
      ) : (
        <div className="grid h-full place-items-center p-6 text-center text-sm text-slate-400">
          No slide image
        </div>
      )}
    </div>
  );
}

function DetailBlock({ label, value, multiline = false }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm leading-relaxed text-slate-800 ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value || 'Not available'}</p>
    </div>
  );
}

export default ContentLibrary;
