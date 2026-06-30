import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ctaButtonLabels } from "@/config/model-v1/report-content/cta-templates";
import { cn } from "@/lib/utils";

interface SummaryActionsProps {
  reportUrl: string;
  onConsultationClick?: () => void;
  className?: string;
}

export function SummaryActions({
  reportUrl,
  onConsultationClick,
  className,
}: SummaryActionsProps) {
  return (
    <section
      id="result-actions"
      className={cn(
        "rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-8",
        className,
      )}
    >
      <h2 className="text-lg font-semibold text-zinc-900">
        گزارش کامل و تحلیل عمیق
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        برای جزئیات ۱۶ حوزه فروش، شواهد پاسخ‌ها و نقشه اقدام، گزارش تفصیلی را
        ببینید.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href={reportUrl}>
          <Button size="lg">مشاهده گزارش کامل</Button>
        </Link>
        {onConsultationClick && (
          <Button size="lg" variant="secondary" onClick={onConsultationClick}>
            {ctaButtonLabels.free}
          </Button>
        )}
      </div>
    </section>
  );
}
