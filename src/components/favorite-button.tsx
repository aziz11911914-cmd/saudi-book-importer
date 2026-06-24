import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  toggleFavorite,
  useIsFavorited,
  type Favorite,
  type FavoriteType,
} from "@/lib/favorites-store";

export function FavoriteButton({
  type,
  id,
  snapshot,
  variant = "ghost",
  className,
  size = "md",
}: {
  type: FavoriteType;
  id: string;
  snapshot: Favorite["snapshot"];
  variant?: "ghost" | "solid";
  className?: string;
  size?: "sm" | "md";
}) {
  const fav = useIsFavorited(type, id);
  const sizes = size === "sm" ? "size-8" : "size-9";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite({ type, id, snapshot });
      }}
      aria-pressed={fav}
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border transition-colors",
        sizes,
        variant === "solid"
          ? "bg-background/85 backdrop-blur"
          : "bg-transparent",
        fav
          ? "border-gold/70 text-gold gold-glow"
          : "border-hairline text-muted-foreground hover:border-gold/50 hover:text-foreground",
        className,
      )}
    >
      <Heart
        className={cn(size === "sm" ? "size-3.5" : "size-4")}
        fill={fav ? "currentColor" : "none"}
      />
    </button>
  );
}
