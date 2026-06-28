interface ActionItem {
  title: string;
  description: string;
}

interface ActionPlanTimelineProps {
  sevenDay: ActionItem[];
  thirtyDay: ActionItem[];
}

function ActionList({
  title,
  subtitle,
  items,
  accentClass,
}: {
  title: string;
  subtitle: string;
  items: ActionItem[];
  accentClass: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      <ul className="mt-4 space-y-4">
        {items.map((item, index) => (
          <li key={`${item.title}-${index}`} className="flex gap-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${accentClass}`}
            >
              {index + 1}
            </span>
            <div>
              <p className="font-medium text-zinc-900">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                {item.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ActionPlanTimeline({
  sevenDay,
  thirtyDay,
}: ActionPlanTimelineProps) {
  if (sevenDay.length === 0 && thirtyDay.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <ActionList
        title="برنامه ۷ روزه"
        subtitle="اقدامات فوری برای شروع بهبود"
        items={sevenDay}
        accentClass="bg-amber-50 text-amber-800"
      />
      <ActionList
        title="برنامه ۳۰ روزه"
        subtitle="اقدامات ساختاری برای تثبیت تغییر"
        items={thirtyDay}
        accentClass="bg-emerald-50 text-emerald-800"
      />
    </div>
  );
}
