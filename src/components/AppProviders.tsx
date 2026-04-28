"use client";

import { I18nProvider } from "@/lib/i18n";
import type { AppLanguage } from "@/lib/i18n-config";
import SessionGuard from "@/components/SessionGuard";

export default function AppProviders({
  initialLanguage,
  children,
}: {
  initialLanguage: AppLanguage;
  children: React.ReactNode;
}) {
  return (
    <I18nProvider initialLanguage={initialLanguage}>
      <SessionGuard />
      {children}
    </I18nProvider>
  );
}
