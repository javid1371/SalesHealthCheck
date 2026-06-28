interface BottleneckCardProps {
  rank: number;
  domainName: string;
  priorityScore: number;
  summary?: string;
  salesImpact?: string;
}

export function BottleneckCard({
  rank,
  domainName,
  priorityScore,
  summary,
  salesImpact,
}: BottleneckCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-medium text-emerald-700">
            گلوگاه {rank}
          </span>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900">
            {domainName}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
          اولویت {Math.round(priorityScore)}
        </span>
      </div>
      {summary && (
        <p className="mt-3 text-sm leading-6 text-zinc-600">{summary}</p>
      )}
      {salesImpact && (
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          <span className="font-medium text-zinc-700">اثر بر فروش: </span>
          {salesImpact}
        </p>
      )}
    </div>
  );
}
