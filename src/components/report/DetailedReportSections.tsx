import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { ReportSpecView } from "@/components/report/ReportSpecView";
import type { ReportResponse } from "@/modules/assessment/assessment.types";

interface DetailedReportSectionsProps {
  report: ReportResponse;
  onRequestAnalysis?: () => void;
}

export function DetailedReportSections({
  report,
  onRequestAnalysis,
}: DetailedReportSectionsProps) {
  if (report.reportSpec) {
    return (
      <ReportSpecView
        reportSpec={report.reportSpec}
        assessmentId={report.assessmentId}
        businessName={report.businessName}
        onCtaClick={() => onRequestAnalysis?.()}
      />
    );
  }

  return (
    <Card className="text-center">
      <h2 className="text-lg font-semibold text-zinc-900">
        گزارش در دسترس نیست
      </h2>
      <p className="mt-3 text-sm leading-7 text-zinc-600">
        این ارزیابی با نسخه قدیمی گزارش ذخیره شده است. برای مشاهده گزارش
        جدید، یک ارزیابی تازه انجام دهید یا لینک نتیجه را بازیابی کنید.
      </p>
      <LinkButton href="/recover" variant="secondary" className="mt-6">
        بازیابی لینک نتیجه
      </LinkButton>
    </Card>
  );
}
