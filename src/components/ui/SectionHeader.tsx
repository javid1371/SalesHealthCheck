import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  label: string;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeader({
  label,
  title,
  subtitle,
  className,
}: SectionHeaderProps) {
  return (
    <div className={className}>
      <p className="text-sm font-medium text-emerald-700">{label}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      )}
      {title && (
        <h2
          className={cn(
            "font-bold text-zinc-900",
            subtitle ? "mt-2 text-3xl" : "mt-2 text-2xl sm:text-3xl",
          )}
        >
          {title}
        </h2>
      )}
    </div>
  );
}
