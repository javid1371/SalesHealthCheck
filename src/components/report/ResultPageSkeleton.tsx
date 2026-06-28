import { Card } from "@/components/ui/Card";

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-zinc-200 motion-reduce:animate-none ${className ?? ""}`}
      aria-hidden
    />
  );
}

export function ResultPageSkeleton() {
  return (
    <div
      className="space-y-8"
      role="status"
      aria-busy="true"
      aria-label="در حال بارگذاری نتیجه"
    >
      <Card padding="compact">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-10 w-28" />
            <SkeletonBlock className="h-4 w-40" />
          </div>
          <SkeletonBlock className="h-10 w-24 rounded-full" />
        </div>
        <SkeletonBlock className="mt-6 h-4 w-full" />
        <SkeletonBlock className="mt-2 h-4 w-5/6" />
      </Card>

      <Card padding="compact">
        <SkeletonBlock className="h-4 w-16" />
        <SkeletonBlock className="mt-3 h-7 w-36" />
        <SkeletonBlock className="mt-2 h-4 w-56" />
        <div className="mt-6 flex aspect-square max-h-72 items-center justify-center rounded-xl bg-zinc-100">
          <SkeletonBlock className="size-48 rounded-full" />
        </div>
      </Card>

      <Card padding="compact">
        <SkeletonBlock className="h-4 w-14" />
        <SkeletonBlock className="mt-3 h-7 w-32" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-xl border border-zinc-100 p-4"
            >
              <div className="flex items-center justify-between">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-4 w-10" />
              </div>
              <SkeletonBlock className="h-2 w-full rounded-full" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <SkeletonBlock className="h-7 w-40" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} padding="compact">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="mt-3 h-5 w-full" />
            <SkeletonBlock className="mt-2 h-4 w-4/5" />
          </Card>
        ))}
      </div>
    </div>
  );
}
