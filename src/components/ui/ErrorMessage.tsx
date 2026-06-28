interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({
  title = "خطا",
  message,
  onRetry,
}: ErrorMessageProps) {
  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
      role="alert"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-sm font-medium underline hover:no-underline"
        >
          تلاش مجدد
        </button>
      )}
    </div>
  );
}
