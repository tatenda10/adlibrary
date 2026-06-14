import { AdminBadge, AdminCard } from '../ui/AdminUi.jsx';

function pct(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0%';
  return `${(n * 100).toFixed(digits)}%`;
}

function formatUsers(value) {
  const n = Number(value || 0);
  return n.toLocaleString();
}

export function GaFunnelChart({
  title,
  subtitle,
  badge,
  steps = [],
  summary = null,
  isOpenFunnel = false,
  showOpenColumn = false,
  emptyMessage = 'No funnel data for this period.',
}) {
  if (!steps.length) {
    return (
      <AdminCard>
        <p className="text-sm text-[#9ca3af]">{emptyMessage}</p>
      </AdminCard>
    );
  }

  const maxUsers = Math.max(...steps.map((s) => Number(s.active_users || 0)), 1);
  const entered = Number(summary?.entered ?? steps[0]?.active_users ?? 0);
  const completed = Number(summary?.completed ?? steps[steps.length - 1]?.active_users ?? 0);
  const overallConversion = Number(summary?.overall_conversion ?? (entered ? completed / entered : 0));

  return (
    <AdminCard className="overflow-hidden p-0">
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">{title}</p>
              {badge}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-white">{subtitle}</h2>
            <p className="mt-1 text-sm text-[#9ca3af]">
              {isOpenFunnel ? 'Open funnel' : 'Closed funnel'} · {formatUsers(entered)} entered ·{' '}
              {formatUsers(completed)} completed ({pct(overallConversion)})
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-right">
            <FunnelStat label="Entered" value={formatUsers(entered)} />
            <FunnelStat label="Completed" value={formatUsers(completed)} />
            <FunnelStat label="Conversion" value={pct(overallConversion)} accent />
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="border-b border-white/8 px-5 py-6 lg:border-b-0 lg:border-r">
          <div className="mx-auto max-w-2xl space-y-1">
            {steps.map((step, index) => {
              const users = Number(step.active_users || 0);
              const widthPct = Math.max(8, Math.round((users / maxUsers) * 100));
              const pctOfFirst = entered > 0 ? users / entered : 0;
              const isLast = index === steps.length - 1;
              const dropOff = Number(step.abandonments || 0);
              const dropOffRate = Number(step.abandonment_rate || 0);

              return (
                <div key={`${step.name}-${index}`}>
                  <div className="grid grid-cols-[72px_minmax(0,1fr)_88px] items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#6b7280]">Step {step.step_index || index + 1}</p>
                    </div>

                    <div className="relative flex justify-center py-1.5">
                      <div
                        className="relative flex h-11 items-center justify-center rounded-sm border border-emerald-400/20 bg-gradient-to-r from-emerald-500/25 via-emerald-400/15 to-emerald-300/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all"
                        style={{ width: `${widthPct}%`, minWidth: '4.5rem' }}
                        title={`${step.name}: ${formatUsers(users)} users`}
                      >
                        <span className="truncate px-2 text-xs font-semibold text-white">{step.name}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{formatUsers(users)}</p>
                      <p className="text-[11px] text-emerald-300">{pct(pctOfFirst)}</p>
                    </div>
                  </div>

                  {!isLast ? (
                    <div className="grid grid-cols-[72px_minmax(0,1fr)_88px] items-center gap-3 py-1">
                      <div />
                      <div className="flex flex-col items-center">
                        <div className="h-5 w-px bg-white/10" />
                        {dropOff > 0 ? (
                          <div className="mt-1 rounded-full border border-rose-400/20 bg-rose-500/10 px-2.5 py-0.5 text-[11px] text-rose-200">
                            −{formatUsers(dropOff)} ({pct(dropOffRate)})
                          </div>
                        ) : (
                          <div className="mt-1 text-[11px] text-[#6b7280]">↓</div>
                        )}
                        <div className="h-5 w-px bg-white/10" />
                      </div>
                      <div />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/8 bg-black/20 text-[10px] uppercase tracking-[0.12em] text-[#7f8ba0]">
              <tr>
                <th className="px-4 py-3 font-medium">Step</th>
                <th className="px-4 py-3 font-medium text-right">Active users</th>
                <th className="px-4 py-3 font-medium text-right">Completion rate</th>
                <th className="px-4 py-3 font-medium text-right">Abandonments</th>
                {showOpenColumn ? <th className="px-4 py-3 font-medium text-right">Open funnel</th> : null}
              </tr>
            </thead>
            <tbody>
              {steps.map((step, index) => (
                <tr key={`${step.name}-row-${index}`} className="border-b border-white/5">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{step.name}</p>
                    {step.event ? <p className="mt-0.5 font-mono text-[10px] text-[#6b7280]">{step.event}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-white">{formatUsers(step.active_users)}</td>
                  <td className="px-4 py-3 text-right text-emerald-300">{pct(step.step_completion_rate ?? step.completion_rate)}</td>
                  <td className="px-4 py-3 text-right text-rose-200">
                    {formatUsers(step.abandonments)}
                    {Number(step.abandonment_rate) > 0 ? ` (${pct(step.abandonment_rate)})` : ''}
                  </td>
                  {showOpenColumn ? (
                    <td className="px-4 py-3 text-right text-[#9ca3af]">{formatUsers(step.open_funnel_users)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminCard>
  );
}

function FunnelStat({ label, value, accent = false }) {
  return (
    <div className="rounded-sm border border-white/8 bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#6b7280]">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
    </div>
  );
}

export function LocalFunnelChart({ funnel = [], completionRate = 0 }) {
  const steps = funnel.map((step, index) => ({
    step_index: index + 1,
    name: step.label || step.key,
    event: step.key,
    active_users: Number(step.unique_users || 0),
    step_completion_rate: 0,
    abandonments: 0,
    abandonment_rate: 0,
  }));

  const summary = {
    entered: steps[0]?.active_users || 0,
    completed: steps.find((s) => s.event === 'onboarding_continue_to_workspace')?.active_users || 0,
    overall_conversion: (completionRate || 0) / 100,
  };

  return (
    <GaFunnelChart
      title="Local mirror"
      subtitle="Database event funnel"
      badge={<AdminBadge>Database copy</AdminBadge>}
      steps={steps}
      summary={summary}
      showOpenColumn={false}
      emptyMessage="No local onboarding events yet."
    />
  );
}
