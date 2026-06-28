interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-600"
        role="status"
        aria-label="در حال بارگذاری"
      />
      {message && (
        <p className="text-center text-sm text-zinc-600">{message}</p>
      )}
    </div>
  );
}
