export type AppLanguage = "fr" | "en" | "ar";

export function isValidLanguage(value: string | undefined): value is AppLanguage {
  return value === "fr" || value === "en" || value === "ar";
}

export function getLanguageDirection(language: AppLanguage) {
  return language === "ar" ? "rtl" : "ltr";
}
