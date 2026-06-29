interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
  showPercentage?: boolean;
  /** 1-based domain index for "دامنه X از Y" display */
  domainIndex?: number;
  domainTotal?: number;
  /** Shorter bar height for sticky progress header */
  compact?: boolean;
}

export function ProgressBar({
  label,
  current,
  total,
  showPercentage = true,
  domainIndex,
  domainTotal,
  compact = false,
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const progressLabel =
    domainIndex !== undefined && domainTotal !== undefined
      ? `دامنه ${domainIndex} از ${domainTotal} — ${percentage}%`
      : showPercentage
        ? `${percentage}%`
        : `${current} از ${total}`;

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 break-words font-medium text-zinc-700">{label}</span>
        <span className="shrink-0 text-zinc-500">{progressLabel}</span>
      </div>
      <div
        className={`overflow-hidden rounded-full bg-zinc-200 ${compact ? "h-1.5" : "h-2"}`}
      >
        <div
          className="h-full rounded-full bg-brand-600 motion-safe:transition-all motion-safe:duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
