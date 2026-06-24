import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { initI18n, isRtl, type Locale } from "./i18n";

initI18n();

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  useEffect(() => {
    const lng = i18n.language || "ar";
    const dir = isRtl(lng) ? "rtl" : "ltr";
    document.documentElement.setAttribute("lang", lng);
    document.documentElement.setAttribute("dir", dir);
  }, [i18n.language]);
  return <>{children}</>;
}

export function useLocale() {
  const { i18n } = useTranslation();
  const lng = (i18n.language?.split("-")[0] || "ar") as Locale;
  const rtl = isRtl(lng);
  return {
    lng,
    rtl,
    setLocale: (next: Locale) => i18n.changeLanguage(next),
    toggle: () => i18n.changeLanguage(lng === "ar" ? "en" : "ar"),
    t: (en: string, ar: string) => (lng === "ar" ? ar : en),
  };
}
