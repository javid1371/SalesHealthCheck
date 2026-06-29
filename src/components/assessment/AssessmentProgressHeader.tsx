"use client";

import { useEffect, useRef } from "react";
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

const PROGRESS_HEIGHT_VAR = "--assessment-progress-height";
const FALLBACK_PROGRESS_HEIGHT = "9rem";

function findCssVariableRoot(
  element: HTMLElement,
  variableName: string,
): HTMLElement {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.style.getPropertyValue(variableName)) {
      return current;
    }
    current = current.parentElement;
  }
  return document.documentElement;
}

export function AssessmentProgressHeader({
  overall,
  domain,
  saveStatus = "idle",
}: AssessmentProgressHeaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const stickyEl = content.parentElement;
    if (!stickyEl) return;

    const cssRoot = findCssVariableRoot(stickyEl, PROGRESS_HEIGHT_VAR);

    const updateHeight = () => {
      cssRoot.style.setProperty(
        PROGRESS_HEIGHT_VAR,
        `${stickyEl.offsetHeight}px`,
      );
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(stickyEl);

    return () => {
      observer.disconnect();
      cssRoot.style.setProperty(PROGRESS_HEIGHT_VAR, FALLBACK_PROGRESS_HEIGHT);
    };
  }, []);

  return (
    <StickyZone position="top">
      <div ref={contentRef} className="relative space-y-3 py-3">
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
