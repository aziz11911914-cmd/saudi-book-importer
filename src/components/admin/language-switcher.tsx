import { startTransition } from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.language?.split("-")[0] ?? "ar") as "ar" | "en";
  const next = current === "ar" ? "en" : "ar";
  return (
    <button
      onClick={() => {
        // Mark the language flip as a non-urgent update so the input stays
        // responsive while React re-renders every translated node + flips dir.
        startTransition(() => {
          void i18n.changeLanguage(next);
        });
      }}
      aria-label={t("admin.language.ariaSwitch")}
      className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <Languages className="size-4" />
      <span>{t("admin.language.label")}</span>
    </button>
  );
}
