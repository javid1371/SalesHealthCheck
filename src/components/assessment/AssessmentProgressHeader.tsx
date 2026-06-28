import { ProgressBar } from "@/components/assessment/ProgressBar";
import {
  SaveStatusIndicator,
  type SaveStatus,
} from "@/components/assessment/SaveStatusIndicator";
import { StickyZone } from "@/components/ui/StickyZone";

interface AssessmentProgressHeaderProps {
  overall: { current: number; total: number; label?: string };
  domain?: {
    current: number;
    total: number;
    domainIndex: number;
    domainTotal: number;
    domainName?: string;
  };
  saveStatus?: SaveStatus;
}

export function AssessmentProgressHeader({
  overall,
  domain,
  saveStatus = "idle",
}: AssessmentProgressHeaderProps) {
  return (
    <StickyZone position="top">
      <div className="relative space-y-3 py-3">
        {saveStatus !== "idle" && (
          <SaveStatusIndicator
            status={saveStatus}
            className="absolute end-0 top-3"
          />
        )}
        {domain && (
          <p className="text-sm text-foreground-muted">
            دامنه {domain.domainIndex} از {domain.domainTotal}
            {domain.domainName ? ` — ${domain.domainName}` : ""}
          </p>
        )}
        <ProgressBar
          compact
          label={overall.label ?? "پیشرفت کلی"}
          current={overall.current}
          total={overall.total}
        />
        {domain && (
          <ProgressBar
            compact
            label="پیشرفت این بخش"
            current={domain.current}
            total={domain.total}
            showPercentage
          />
        )}
      </div>
    </StickyZone>
  );
}
