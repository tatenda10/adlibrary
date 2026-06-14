import { useEffect, useMemo, useState } from 'react';
import { adminGetIncidentDetail, adminGetIncidents, adminGetIncidentsSummary } from '../lib/api.js';
import { getIncidentsLastSeenId, markIncidentsSeenFromSummary } from '../lib/incidentStorage.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import {
  AdminButton,
  AdminCard,
  AdminMetricCard,
  AdminPageHeader,
} from '../components/ui/AdminUi.jsx';
import {
  FailureBadge,
  IncidentDetailModal,
  SeverityBadge,
} from '../components/incidents/IncidentDetailModal.jsx';

export function IncidentsPage() {
  const { token } = useAdminAuth();
  const [severity, setSeverity] = useState('');
  const [source, setSource] = useState('');
  const [failureType, setFailureType] = useState('');
  const [incidents, setIncidents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) return;
      try {
        setLoading(true);
        setError('');
        const [incidentData, summaryData] = await Promise.all([
          adminGetIncidents(token, { severity, source, limit: 200 }),
          adminGetIncidentsSummary(token, { hours: 24, sinceId: getIncidentsLastSeenId() }),
        ]);
        if (cancelled) return;

        const rows = incidentData?.incidents || [];
        setIncidents(rows);
        setSummary(summaryData || null);
        markIncidentsSeenFromSummary(summaryData);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load incidents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, severity, source]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!token || !selectedId) {
        setSelectedIncident(null);
        return;
      }
      try {
        setDetailLoading(true);
        const data = await adminGetIncidentDetail(token, selectedId);
        if (!cancelled) setSelectedIncident(data?.incident || null);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load incident detail');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [token, selectedId]);

  const filteredIncidents = useMemo(() => {
    if (!failureType) return incidents;
    return incidents.filter((item) => item.failure_type === failureType);
  }, [incidents, failureType]);

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Reliability"
        title="Incidents"
        description="Failures are logged when an API returns an error or a scrape returns zero items."
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="rounded-sm border border-white/10 bg-[#0f0f10] px-3 py-2 text-sm text-white"
            >
              <option value="">All severities</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
            </select>
            <select
              value={failureType}
              onChange={(e) => setFailureType(e.target.value)}
              className="rounded-sm border border-white/10 bg-[#0f0f10] px-3 py-2 text-sm text-white"
            >
              <option value="">All failure types</option>
              <option value="zero_items">Zero items</option>
              <option value="api_error">API error</option>
              <option value="apify_run_failed">Apify run failed</option>
            </select>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Filter source…"
              className="rounded-sm border border-white/10 bg-[#0f0f10] px-3 py-2 text-sm text-white"
            />
          </div>
        }
      />

      {summary?.new_since_id > 0 ? (
        <div className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {summary.new_since_id} new incident{summary.new_since_id === 1 ? '' : 's'} since your last visit.
        </div>
      ) : null}

      {error ? <p className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <AdminMetricCard label="Last 24h" value={loading ? '…' : String(summary?.total ?? 0)} accent />
        <AdminMetricCard label="Errors" value={loading ? '…' : String(summary?.errors ?? 0)} />
        <AdminMetricCard label="Zero-item scrapes" value={loading ? '…' : String(summary?.zero_items ?? 0)} />
        <AdminMetricCard label="Warnings" value={loading ? '…' : String(summary?.warnings ?? 0)} />
      </div>

      <AdminCard className="overflow-x-auto p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-[11px] uppercase tracking-[0.12em] text-[#7f8ba0]">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Failure</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Message</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-[#9ca3af]">
                  Loading incidents…
                </td>
              </tr>
            ) : null}
            {!loading && filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-[#9ca3af]">
                  No incidents logged yet. Failures appear here when a scrape errors or returns 0 items.
                </td>
              </tr>
            ) : null}
            {filteredIncidents.map((item) => (
              <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-[#9ca3af]">
                  {new Date(item.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <SeverityBadge severity={item.severity} />
                </td>
                <td className="px-4 py-3">
                  <FailureBadge failureType={item.failure_type} />
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-emerald-300">{item.source}</p>
                  {item.endpoint ? <p className="mt-0.5 text-[11px] text-[#6b7280]">{item.endpoint}</p> : null}
                </td>
                <td className="max-w-xs px-4 py-3">
                  <p className="truncate text-white" title={item.message}>
                    {item.message}
                  </p>
                  {item.user_id ? (
                    <p className="mt-0.5 truncate font-mono text-[10px] text-[#6b7280]">{item.user_id}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-[#c6d0db]">
                  {item.item_count ?? item.meta?.itemCount ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <AdminButton variant="ghost" onClick={() => setSelectedId(item.id)}>
                    View
                  </AdminButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>

      <IncidentDetailModal
        incident={selectedIncident}
        loading={detailLoading}
        onClose={() => {
          setSelectedId(null);
          setSelectedIncident(null);
        }}
      />
    </section>
  );
}
