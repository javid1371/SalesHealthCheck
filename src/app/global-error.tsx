"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body className="flex min-h-screen items-center justify-center bg-gray-50 p-6 font-sans">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-xl font-semibold text-gray-900">
            خطای غیرمنتظره
          </h1>
          <p className="mb-6 text-gray-600">
            مشکلی در نمایش این صفحه پیش آمد. لطفاً دوباره تلاش کنید.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            تلاش مجدد
          </button>
        </div>
      </body>
    </html>
  );
}
