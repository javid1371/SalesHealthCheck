import { cn } from "@/lib/utils";

export interface ReportTocItem {
  id: string;
  label: string;
}

interface ReportMobileTocProps {
  items: ReportTocItem[];
  className?: string;
}

export function ReportMobileToc({ items, className }: ReportMobileTocProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="فهرست گزارش"
      className={cn(
        "-mx-4 mb-6 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:hidden",
        className,
      )}
    >
      <ul className="flex w-max gap-2 pb-1">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="inline-flex shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition hover:border-brand-600/30 hover:text-brand-700"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
