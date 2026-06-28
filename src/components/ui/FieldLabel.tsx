import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldLabelProps {
  label: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function FieldLabel({
  label,
  required,
  htmlFor,
  children,
  className,
}: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
