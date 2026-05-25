function WebsiteAnalysisReport({
  title,
  eyebrow = 'Quick Website Report',
  metrics = [],
  columns = [],
  subtitle = '',
  actions = null,
  className = '',
}) {
  return (
    <div className={`websiteReportShell ${className}`.trim()} style={{ fontFamily: 'inherit' }}>
      <div className="websiteReportHeader">
        <div className="flex min-w-0 items-start gap-3">
          <ShieldIcon />
          <div className="min-w-0">
            <p className="websiteReportEyebrow">{eyebrow}</p>
            <h2 className="websiteReportTitle">{title}</h2>
            {subtitle ? <p className="websiteReportSubtitle">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="websiteReportActions">{actions}</div> : null}
      </div>

      <div className="websiteReportMetrics">
        {metrics.map((metric, idx) => (
          <MetricCard
            key={metric.label}
            metric={metric}
            isLast={idx === metrics.length - 1}
            columnClass={idx === 1 ? 'md:px-7' : idx === metrics.length - 1 ? 'md:pl-7' : 'md:pr-7'}
          />
        ))}
      </div>

      <div className="websiteReportColumns">
        {columns.map((column, idx) => (
          <EditorialColumn
            key={column.title}
            icon={column.icon}
            title={column.title}
            items={column.items}
            isLast={idx === columns.length - 1}
            itemPrefix={column.itemPrefix}
            columnClass={idx === 1 ? 'md:px-7' : idx === columns.length - 1 ? 'md:pl-7' : 'md:pr-7'}
          />
        ))}
      </div>
    </div>
  );
}

function MetricCard({ metric, isLast, columnClass = '' }) {
  const isGood = metric.tone === 'good';
  const isMedium = metric.tone === 'medium';
  const scoreColor = isGood ? '#22c55e' : isMedium ? '#f59e0b' : '#ef4444';
  const subColor = isGood ? '#4a7a5a' : isMedium ? '#8b6a2f' : '#7a3a3a';

  return (
    <div className={`websiteReportMetric ${columnClass} ${!isLast ? 'websiteReportMetricBorder' : ''}`.trim()}>
      <p className="websiteReportMetricLabel">{metric.label}</p>
      <p className="websiteReportMetricValue" style={{ color: scoreColor }}>
        {metric.value}
        <span className="websiteReportMetricScale" style={{ color: subColor }}>/100</span>
      </p>
    </div>
  );
}

function EditorialColumn({ icon, title, items = [], isLast, itemPrefix = '', columnClass = '' }) {
  return (
    <div className={`websiteReportColumn ${columnClass} ${!isLast ? 'websiteReportColumnBorder' : ''}`.trim()}>
      <div className="websiteReportColumnIcon">{icon}</div>
      <h3 className="websiteReportColumnTitle">{title}</h3>
      <div className="websiteReportColumnBody">
        {items.map((item) => (
          <p key={item} className="websiteReportColumnItem">
            {itemPrefix}{item}
          </p>
        ))}
      </div>
    </div>
  );
}

export function ShieldIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-5 w-5 shrink-0" fill="none" stroke="#f0e4d6" strokeWidth="2.2">
      <path d="M32 6c8 8 17 10 24 11v15c0 13-7 22-24 30C15 54 8 45 8 32V17c7-1 16-3 24-11Z" />
      <path d="M32 7v48" />
    </svg>
  );
}

export function GraduationIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m3 9 9-5 9 5-9 5-9-5Z" />
      <path d="M7 11v4c0 1.8 2.2 3 5 3s5-1.2 5-3v-4" />
    </svg>
  );
}

export function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
      <path d="M12 14v2" />
    </svg>
  );
}

export default WebsiteAnalysisReport;
