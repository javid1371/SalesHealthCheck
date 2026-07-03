import type { RenderMedium } from "@/modules/report/report.renderer";
import { cn } from "@/lib/utils";

interface ChartContainerProps {
  title: string;
  caption?: string;
  medium?: RenderMedium;
  children: React.ReactNode;
}

export function ChartContainer({
  title,
  caption,
  medium = "app",
  children,
}: ChartContainerProps) {
  const isPrint = medium === "print";

  return (
    <div className={cn(isPrint && "print-avoid-break")}>
      <h3 className="mb-4 text-sm font-medium text-zinc-700">{title}</h3>
      <div className="min-w-0">
        {children}
      </div>
      {caption && (
        <p className="mt-3 text-xs text-zinc-500">{caption}</p>
      )}
    </div>
  );
}
