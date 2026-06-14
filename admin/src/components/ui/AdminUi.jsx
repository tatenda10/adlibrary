export const adminInputClass =
  'w-full rounded-sm border border-white/10 bg-[#0f0f10] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#6b7280] focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-500/20';

export function AdminEyebrow({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/90">{children}</p>
  );
}

export function AdminPageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-4 border-b border-white/8 pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <AdminEyebrow>{eyebrow}</AdminEyebrow> : null}
        <h1 className={`text-2xl font-semibold tracking-tight text-white ${eyebrow ? 'mt-2' : ''}`}>{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9ca3af]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminCard({ children, className = '', padding = 'p-5' }) {
  return (
    <div className={`rounded-sm border border-white/10 bg-white/[0.03] ${padding} ${className}`}>{children}</div>
  );
}

export function AdminMetricCard({ label, value, detail, accent = false }) {
  return (
    <AdminCard className={accent ? 'border-emerald-400/25 bg-emerald-400/[0.04]' : ''}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#7f8ba0]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-2 text-sm text-[#9ca3af]">{detail}</p> : null}
    </AdminCard>
  );
}

export function AdminButton({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}) {
  const variants = {
    primary:
      'rounded-sm bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-60',
    secondary:
      'rounded-sm border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.08]',
    ghost:
      'rounded-sm border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#d1d5db] hover:bg-white/5',
    danger:
      'rounded-sm border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/10',
  };

  return (
    <button type={type} className={`${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function AdminBadge({ children, tone = 'default' }) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-[#c6d0db]',
    success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    draft: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  };
  return (
    <span className={`inline-flex rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${tones[tone] || tones.default}`}>
      {children}
    </span>
  );
}

export function AdminAlert({ children, tone = 'info' }) {
  const tones = {
    info: 'border-white/10 bg-white/[0.03] text-[#9ca3af]',
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  };
  return <p className={`rounded-sm border px-3 py-2 text-sm ${tones[tone] || tones.info}`}>{children}</p>;
}
