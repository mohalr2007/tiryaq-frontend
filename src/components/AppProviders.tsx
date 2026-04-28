"use client";

import { I18nProvider } from "@/lib/i18n";
import type { AppLanguage } from "@/lib/i18n-config";
import SessionGuard from "@/components/SessionGuard";
import PwaRuntime from "@/components/PwaRuntime";

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
      <PwaRuntime />
      {children}
    </I18nProvider>
  );
}
