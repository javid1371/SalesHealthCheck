import { type ReactNode } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, type CardPadding } from "@/components/ui/Card";
import { PageState } from "@/components/ui/PageState";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { cn } from "@/lib/utils";

type MaxWidth = "sm" | "md" | "lg" | "xl" | "2xl";

interface AssessmentShellProps {
  title: string;
  subtitle?: string;
  maxWidth?: MaxWidth;
  loading?: boolean;
  loadingMessage?: string;
  error?: string | null;
  onRetry?: () => void;
  /** Sticky progress header rendered above the card (e.g. AssessmentProgressHeader). */
  stickyProgress?: ReactNode;
  /** @deprecated Use stickyProgress instead. */
  progress?: ReactNode;
  banner?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  cardPadding?: CardPadding;
  reverseActionsOnMobile?: boolean;
  footer?: "full" | "minimal";
}

export function AssessmentShell({
  title,
  subtitle,
  maxWidth = "lg",
  loading = false,
  loadingMessage,
  error = null,
  onRetry,
  stickyProgress,
  progress,
  banner,
  children,
  actions,
  cardPadding = "compact",
  reverseActionsOnMobile = false,
  footer = "minimal",
}: AssessmentShellProps) {
  const showCard = Boolean(children ?? actions);
  const stickyProgressContent = stickyProgress ?? progress;
  const hasActions = Boolean(actions);

  return (
    <PageLayout
      title={title}
      subtitle={subtitle}
      maxWidth={maxWidth}
      footer={footer}
    >
      <PageState
        loading={loading}
        loadingMessage={loadingMessage}
        error={error}
        onRetry={onRetry}
      >
        <div
          className={cn(
            hasActions &&
              "pb-[calc(5rem+env(safe-area-inset-bottom))]",
          )}
        >
          {stickyProgressContent}
          {banner}
          {showCard && (
            <>
              <Card padding={cardPadding}>{children}</Card>
              {hasActions && (
                <>
                  <div
                    id="assessment-actions"
                    className="scroll-mt-[var(--assessment-scroll-offset)]"
                    aria-hidden
                  />
                  <StickyActionBar
                    maxWidth={maxWidth}
                    reverseOnMobile={reverseActionsOnMobile}
                  >
                    {actions}
                  </StickyActionBar>
                </>
              )}
            </>
          )}
        </div>
      </PageState>
    </PageLayout>
  );
}
