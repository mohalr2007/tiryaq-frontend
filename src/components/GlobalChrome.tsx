"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const ThemeToggle = dynamic(() => import("@/components/ThemeToggle"), {
  ssr: false,
});

const AiFloatingWidget = dynamic(() => import("@/components/AiFloatingWidget"), {
  ssr: false,
});

export default function GlobalChrome() {
  const pathname = usePathname();

  const hideFloatingTheme = pathname?.startsWith("/admin-page");
  const hideFloatingAssistant =
    hideFloatingTheme ||
    pathname?.startsWith("/ai-assistant") ||
    pathname?.startsWith("/patient-dashboard") ||
    pathname?.startsWith("/dashboardpatientlarabi") ||
    pathname?.startsWith("/dashboardoctlarabi") ||
    pathname?.startsWith("/doctor-dashboard");

  if (hideFloatingTheme && hideFloatingAssistant) {
    return null;
  }

  return (
    <>
      {!hideFloatingTheme ? (
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
      ) : null}
      {!hideFloatingAssistant ? (
        <div className="hidden md:block">
          <AiFloatingWidget />
        </div>
      ) : null}
    </>
  );
}
