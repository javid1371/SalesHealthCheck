import Link from "next/link";
import { type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type LinkButtonVariant = "primary" | "secondary";
type LinkButtonSize = "sm" | "md" | "lg";

const variantClass: Record<LinkButtonVariant, string> = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-700",
  secondary:
    "bg-white text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50",
};

const sizeClass: Record<LinkButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

interface LinkButtonProps extends ComponentPropsWithoutRef<typeof Link> {
  variant?: LinkButtonVariant;
  size?: LinkButtonSize;
  fullWidth?: boolean;
}

export function LinkButton({
  variant = "primary",
  size = "lg",
  fullWidth = false,
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition",
        variantClass[variant],
        sizeClass[size],
        fullWidth && "w-full sm:w-auto",
        className,
      )}
      {...props}
    />
  );
}
