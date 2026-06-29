export const SITE_HEADER_SELECTOR = "[data-site-header]";
export const ASSESSMENT_PROGRESS_SELECTOR = "[data-assessment-progress]";

const SCROLL_GAP_PX = 8;

export function getAssessmentScrollOffset(): number {
  const header = document.querySelector(SITE_HEADER_SELECTOR);
  const progress = document.querySelector(ASSESSMENT_PROGRESS_SELECTOR);

  const headerHeight = header?.getBoundingClientRect().height ?? 0;
  const progressHeight = progress?.getBoundingClientRect().height ?? 0;

  return headerHeight + progressHeight + SCROLL_GAP_PX;
}

export function scrollToAssessmentTarget(element: HTMLElement): void {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const offset = getAssessmentScrollOffset();
  const top = element.getBoundingClientRect().top + window.scrollY - offset;

  window.scrollTo({
    top: Math.max(0, top),
    behavior: reducedMotion ? "instant" : "smooth",
  });
}

/** Wait for layout after React state updates before scrolling. */
export function scrollToAssessmentTargetAfterLayout(
  element: HTMLElement | null | undefined,
): void {
  if (!element) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollToAssessmentTarget(element);
    });
  });
}
