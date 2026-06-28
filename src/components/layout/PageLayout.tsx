import Link from "next/link";
import type { CSSProperties } from "react";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backHref?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "5xl";
  footer?: "full" | "minimal";
}

const maxWidthClass = {
  sm: "max-w-lg",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  "5xl": "max-w-6xl",
};

export function PageLayout({
  children,
  title,
  subtitle,
  showBack = false,
  backHref = "/",
  maxWidth = "lg",
  footer = "full",
}: PageLayoutProps) {
  return (
    <div
      className="min-h-screen bg-zinc-50 pb-[env(safe-area-inset-bottom)]"
      style={
        {
          "--header-height": "calc(env(safe-area-inset-top) + 3.25rem)",
          "--assessment-progress-height": "7rem",
          "--assessment-scroll-offset":
            "calc(var(--header-height) + var(--assessment-progress-height))",
        } as CSSProperties
      }
    >
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white pt-[env(safe-area-inset-top)]">
        <div
          className={`mx-auto flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 ${maxWidthClass[maxWidth]}`}
        >
          <Link
            href="/"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Sales Health Check
          </Link>
          {showBack && (
            <Link
              href={backHref}
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              بازگشت
            </Link>
          )}
        </div>
      </header>

      <main
        className={`mx-auto px-4 py-6 sm:px-6 sm:py-8 ${maxWidthClass[maxWidth]}`}
      >
        {(title || subtitle) && (
          <div className="mb-8">
            {title && (
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-2 text-base leading-7 text-zinc-600">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </main>

      <footer className="border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div
          className={`mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-5 text-center text-sm text-zinc-500 sm:px-6 sm:py-6 ${maxWidthClass[maxWidth]}`}
        >
          {footer === "full" && (
            <>
              <Link
                href="/recover"
                className="text-emerald-700 hover:text-emerald-800"
              >
                بازیابی لینک نتیجه
              </Link>
              <span aria-hidden className="text-zinc-300">
                ·
              </span>
            </>
          )}
          <Link href="/privacy" className="text-emerald-700 hover:text-emerald-800">
            حریم خصوصی
          </Link>
        </div>
      </footer>
    </div>
  );
}
