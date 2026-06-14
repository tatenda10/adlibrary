import { AdminBadge, AdminButton } from '../ui/AdminUi.jsx';

const FAILURE_LABELS = {
  zero_items: 'Zero items returned',
  api_error: 'API error',
  apify_run_failed: 'Apify run failed',
  unknown: 'Unknown failure',
};

export function failureTypeLabel(type) {
  return FAILURE_LABELS[type] || FAILURE_LABELS.unknown;
}

export function IncidentDetailModal({ incident, loading, onClose }) {
  if (!incident && !loading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/75" aria-label="Close incident detail" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-sm border border-white/10 bg-[#0a0a0a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Incident detail</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {loading ? 'Loading…' : `#${incident?.id} · ${incident?.source || 'incident'}`}
            </h2>
          </div>
          <AdminButton variant="ghost" onClick={onClose}>
            Close
          </AdminButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? <p className="text-sm text-[#9ca3af]">Loading incident…</p> : null}
          {incident ? <IncidentDetailBody incident={incident} /> : null}
        </div>
      </div>
    </div>
  );
}

function IncidentDetailBody({ incident }) {
  const fields = [
    ['Severity', incident.severity],
    ['Failure type', failureTypeLabel(incident.failure_type)],
    ['Source', incident.source],
    ['Endpoint', incident.endpoint || '—'],
    ['Run status', incident.run_status || incident.meta?.runStatus || '—'],
    ['Items returned', formatItems(incident.item_count, incident.meta?.itemCount)],
    ['User', incident.user_id || 'System / background job'],
    ['Time', new Date(incident.created_at).toLocaleString()],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={incident.severity} />
        <FailureBadge failureType={incident.failure_type} />
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.12em] text-[#7f8ba0]">Message</p>
        <p className="mt-2 text-sm leading-6 text-white">{incident.message}</p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-sm border border-white/8 bg-black/20 px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-[0.12em] text-[#6b7280]">{label}</dt>
            <dd className="mt-1 break-all text-sm text-[#e5e7eb]">{String(value)}</dd>
          </div>
        ))}
      </dl>

      {incident.meta ? (
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#7f8ba0]">Full payload</p>
          <pre className="mt-2 max-h-[420px] overflow-auto rounded-sm border border-white/8 bg-black/40 p-4 text-[11px] leading-5 text-[#c6d0db]">
            {JSON.stringify(incident.meta, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export function SeverityBadge({ severity }) {
  const tone = severity === 'error' ? 'error' : severity === 'warn' ? 'draft' : 'success';
  return <AdminBadge tone={tone}>{severity}</AdminBadge>;
}

export function FailureBadge({ failureType }) {
  const tone = failureType === 'zero_items' ? 'draft' : failureType === 'api_error' ? 'error' : 'default';
  return <AdminBadge tone={tone}>{failureTypeLabel(failureType)}</AdminBadge>;
}

function formatItems(primary, fallback) {
  const value = primary ?? fallback;
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
