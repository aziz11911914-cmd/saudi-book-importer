import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  value,
  count,
  showCount = true,
  size = "sm",
  className,
}: {
  value: number;
  count?: number;
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const star = size === "lg" ? "size-5" : size === "md" ? "size-4" : "size-3.5";
  const text =
    size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs";
  return (
    <span className={cn("inline-flex items-center gap-1.5", text, className)}>
      <Star className={cn(star, "fill-gold text-gold")} />
      <span className="font-medium text-foreground">{value.toFixed(1)}</span>
      {showCount && count != null && (
        <span className="text-muted-foreground">({count.toLocaleString()})</span>
      )}
    </span>
  );
}
