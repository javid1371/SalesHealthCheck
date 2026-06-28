import { cn } from "@/lib/utils";

const STEPS = [
  { label: "امتیاز" },
  { label: "تشخیص" },
  { label: "گزارش" },
] as const;

interface ProcessingStepperProps {
  activeStep: 0 | 1 | 2;
}

export function ProcessingStepper({ activeStep }: ProcessingStepperProps) {
  return (
    <nav aria-label="مراحل تحلیل" className="w-full">
      <ol className="flex items-center justify-between gap-2">
        {STEPS.map((step, index) => {
          const isComplete = index < activeStep;
          const isActive = index === activeStep;

          return (
            <li
              key={step.label}
              className={cn(
                "flex min-w-0 flex-1 items-center",
                index < STEPS.length - 1 && "gap-2",
              )}
            >
              <div className="flex min-w-0 flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    isComplete &&
                      "border-brand-600 bg-brand-600 text-white",
                    isActive &&
                      "border-brand-600 bg-brand-600/10 text-brand-700",
                    !isComplete &&
                      !isActive &&
                      "border-zinc-200 bg-white text-zinc-400",
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isComplete ? (
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      className="size-3.5"
                      aria-hidden
                    >
                      <path
                        d="M3.5 8.5 6.5 11.5 12.5 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "truncate text-xs font-medium",
                    isActive || isComplete
                      ? "text-zinc-900"
                      : "text-zinc-400",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mb-5 h-0.5 min-w-4 flex-1 rounded-full",
                    index < activeStep ? "bg-brand-600" : "bg-zinc-200",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
