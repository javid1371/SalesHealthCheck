interface CorrectiveAction {
  domainName: string;
  description: string;
}

interface ActionPlanSectionProps {
  actions: CorrectiveAction[];
}

export function ActionPlanSection({ actions }: ActionPlanSectionProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-zinc-900">
        اقدامات اصلاحی پیشنهادی
      </h3>
      <p className="mt-1 text-sm text-zinc-500">
        پیشنهادهای عملی برای بهبود گلوگاه‌های شناسایی‌شده
      </p>
      <ul className="mt-4 space-y-4">
        {actions.map((action, index) => (
          <li key={`${action.domainName}-${index}`} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-medium text-emerald-700">
              {index + 1}
            </span>
            <div>
              <p className="font-medium text-zinc-900">{action.domainName}</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                {action.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
