"use client";

import { Download, Share2, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaInstallButtonProps = {
  className?: string;
  fullWidth?: boolean;
  compact?: boolean;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function isIosSafari() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();
  const isAppleDevice =
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform.includes("mac") && window.navigator.maxTouchPoints > 1);
  const isSafariBrowser =
    /safari/.test(userAgent) && !/crios|fxios|edgios|chrome|android/.test(userAgent);

  return isAppleDevice && isSafariBrowser;
}

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export default function PwaInstallButton({
  className,
  fullWidth = false,
  compact = false,
}: PwaInstallButtonProps) {
  const { language } = useI18n();
  const tr = (fr: string, en: string, ar: string) =>
    language === "ar" ? ar : language === "en" ? en : fr;

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(max-width: 1023px)");
    const installMedia = window.matchMedia("(display-mode: standalone)");

    const syncState = () => {
      setIsMobileViewport(media.matches);
      setIsStandalone(isStandaloneMode());
    };

    syncState();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setShowIosHint(false);
      setIsStandalone(true);
    };

    const handleViewportChange = () => {
      syncState();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleInstalled);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleViewportChange);
      installMedia.addEventListener("change", handleViewportChange);
    } else {
      media.addListener(handleViewportChange);
      installMedia.addListener(handleViewportChange);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleInstalled);
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", handleViewportChange);
        installMedia.removeEventListener("change", handleViewportChange);
      } else {
        media.removeListener(handleViewportChange);
        installMedia.removeListener(handleViewportChange);
      }
    };
  }, []);

  const canRender = useMemo(() => {
    if (!isMobileViewport || isStandalone) {
      return false;
    }

    return Boolean(deferredPrompt) || isIosSafari();
  }, [deferredPrompt, isMobileViewport, isStandalone]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      setIsInstalling(true);

      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      } finally {
        setIsInstalling(false);
      }

      return;
    }

    setShowIosHint((current) => !current);
  };

  if (!canRender) {
    return null;
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleInstall()}
        className={cx(
          "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/92 px-5 py-3 text-sm font-semibold text-slate-700 transition touch-manipulation hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900/82 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white",
          compact && "min-h-[42px] px-3 py-2.5 text-xs",
          fullWidth && "w-full",
        )}
      >
        {deferredPrompt ? <Download className="size-4" /> : <Smartphone className="size-4" />}
        {isInstalling
          ? tr("Préparation...", "Preparing...", "جارٍ التحضير...")
          : compact
            ? tr("Installer", "Install", "تثبيت")
            : tr("Installer l'app", "Install app", "تثبيت التطبيق")}
      </button>
      {showIosHint ? (
        <div className="mt-2 rounded-2xl border border-blue-100 bg-blue-50/90 px-4 py-3 text-xs leading-6 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200">
          <div className="inline-flex items-center gap-2 font-semibold">
            <Share2 className="size-4" />
            {tr(
              "Sur iPhone: Partager puis Ajouter à l'écran d'accueil.",
              "On iPhone: tap Share, then Add to Home Screen.",
              "على iPhone: اضغط مشاركة ثم أضف إلى الشاشة الرئيسية.",
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
