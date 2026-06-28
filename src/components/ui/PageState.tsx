"use client";

import { type ReactNode } from "react";
import { ResultPageSkeleton } from "@/components/report/ResultPageSkeleton";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

interface PageStateProps {
  loading?: boolean;
  /** Placeholder layout while loading (instead of spinner). */
  skeleton?: "result";
  error?: string | null;
  loadingMessage?: string;
  errorTitle?: string;
  onRetry?: () => void;
  errorExtra?: ReactNode;
  children: ReactNode;
}

export function PageState({
  loading = false,
  skeleton,
  error = null,
  loadingMessage,
  errorTitle,
  onRetry,
  errorExtra,
  children,
}: PageStateProps) {
  if (loading) {
    if (skeleton === "result") {
      return <ResultPageSkeleton />;
    }
    return <LoadingSpinner message={loadingMessage} />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorMessage title={errorTitle} message={error} onRetry={onRetry} />
        {errorExtra}
      </div>
    );
  }

  return <>{children}</>;
}
