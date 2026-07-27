import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  label?: string;
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
      {label && (
        <p className="text-sm font-medium text-emerald-700">{label}</p>
      )}
      {subtitle && (
        <p className={cn("text-sm text-zinc-500", label && "mt-1")}>{subtitle}</p>
      )}
      {title && (
        <h2
          className={cn(
            "font-bold text-zinc-900",
            (label || subtitle) && "mt-2",
            subtitle ? "text-3xl" : "text-2xl sm:text-3xl",
          )}
        >
          {title}
        </h2>
      )}
    </div>
  );
}
