import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertVariant = "warning" | "success" | "info" | "error";

const variantClass: Record<AlertVariant, string> = {
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-zinc-200 bg-zinc-50 text-zinc-900",
  error: "border-red-200 bg-red-50 text-red-800",
};

const titleClass: Record<AlertVariant, string> = {
  warning: "text-amber-900",
  success: "text-emerald-900",
  info: "text-zinc-900",
  error: "text-red-800",
};

const bodyClass: Record<AlertVariant, string> = {
  warning: "text-amber-800",
  success: "text-emerald-800",
  info: "text-zinc-700",
  error: "text-red-700",
};

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
}

export function Alert({
  variant = "info",
  title,
  children,
  className,
  id,
}: AlertProps) {
  const role = variant === "error" ? "alert" : "status";

  return (
    <div
      id={id}
      role={role}
      className={cn(
        "rounded-xl border p-4",
        variantClass[variant],
        className,
      )}
    >
      {title && (
        <p className={cn("font-medium", titleClass[variant])}>{title}</p>
      )}
      {children && (
        <div
          className={cn(
            "text-sm",
            title && "mt-1",
            bodyClass[variant],
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
