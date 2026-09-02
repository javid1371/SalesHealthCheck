import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import type { PersonAssessmentItem } from "@/modules/consultation/consultation.types";

interface LeadPersonAssessmentsProps {
  assessments: PersonAssessmentItem[];
}

export function LeadPersonAssessments({
  assessments,
}: LeadPersonAssessmentsProps) {
  if (assessments.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="lead-person-assessments-heading">
      <h3
        id="lead-person-assessments-heading"
        className="mb-4 text-base font-semibold text-zinc-900"
      >
        تست‌های این شخص
      </h3>
      <ul className="space-y-2">
        {assessments.map((item) => (
          <li key={item.assessmentId}>
            <Card padding="compact">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <time className="text-zinc-600">{item.startedAt}</time>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                    {item.statusLabel}
                  </span>
                  {item.overallScorePercentage != null ? (
                    <span className="font-medium text-zinc-900">
                      {item.overallScorePercentage}٪
                    </span>
                  ) : null}
                </div>
                <LinkButton
                  href={item.expertViewUrl}
                  variant="secondary"
                  size="sm"
                >
                  مشاهده تست
                </LinkButton>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
