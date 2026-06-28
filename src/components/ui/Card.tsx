import { type ComponentPropsWithoutRef, type ElementType } from "react";
import { cn } from "@/lib/utils";

type CardPadding = "default" | "compact" | "spacious";

export type { CardPadding };

const paddingClass: Record<CardPadding, string> = {
  default: "p-6 sm:p-8",
  compact: "p-4 sm:p-8",
  spacious: "p-8 sm:p-12",
};

type CardProps<T extends ElementType = "div"> = {
  as?: T;
  padding?: CardPadding;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

export function Card<T extends ElementType = "div">({
  as,
  padding = "default",
  className,
  ...props
}: CardProps<T>) {
  const Component = as ?? "div";

  return (
    <Component
      className={cn(
        "rounded-2xl bg-white shadow-sm",
        paddingClass[padding],
        className,
      )}
      {...props}
    />
  );
}
