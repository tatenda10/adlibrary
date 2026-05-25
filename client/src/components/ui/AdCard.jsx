function AdCard({ ad }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
      <div className="group relative aspect-[9/16] w-full">
        <img src={ad.image} alt={ad.headline} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        <div className="absolute right-3 top-3 rounded-full border border-lime-400/40 bg-black/65 px-3 py-1 text-xs font-bold text-lime-300">
          {ad.viralScore} Viral Score
        </div>

        <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
          {ad.platform}
        </div>

        <div className="absolute bottom-0 w-full p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300">{ad.niche}</p>
          <h3 className="mt-1 line-clamp-1 text-base font-semibold text-white">{ad.brand}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-200">{ad.headline}</p>
        </div>
      </div>
    </article>
  );
}

export { AdCard };
