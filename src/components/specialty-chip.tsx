import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SpecialtyChip({
  active,
  onClick,
  children,
  className,
  size = "md",
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border transition-all",
        size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
        active
          ? "border-gold/70 bg-gold/10 text-gold gold-glow"
          : "border-hairline text-muted-foreground hover:border-gold/40 hover:text-foreground",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
