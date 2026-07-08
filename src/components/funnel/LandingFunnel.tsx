"use client";

import { useEffect } from "react";
import Link from "next/link";
import { trackFunnelEvent } from "@/lib/funnel-track";
import { cn } from "@/lib/utils";

type LinkButtonVariant = "primary" | "secondary";
type LinkButtonSize = "sm" | "md" | "lg";

const variantClass: Record<LinkButtonVariant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700",
  secondary: "bg-white text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50",
};

const sizeClass: Record<LinkButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

interface LandingStartButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export function LandingFunnelTracker() {
  useEffect(() => {
    void trackFunnelEvent({ type: "landing_view" });
  }, []);

  return null;
}

export function LandingStartButton({
  href,
  children,
  className,
  fullWidth = false,
}: LandingStartButtonProps) {
  return (
    <Link
      href={href}
      onClick={() => {
        void trackFunnelEvent({ type: "assessment_start_click" });
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition",
        variantClass.primary,
        sizeClass.lg,
        fullWidth && "w-full sm:w-auto",
        className,
      )}
    >
      {children}
    </Link>
  );
}
