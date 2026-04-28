"use client";

import { useEffect } from "react";

export default function PwaRuntime() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) {
      return;
    }

    let cancelled = false;

    const registerServiceWorker = async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration("/");
        if (existing || cancelled) {
          return;
        }

        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Keep install support best-effort only.
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
      return () => {
        cancelled = true;
      };
    }

    const handleLoad = () => {
      void registerServiceWorker();
    };

    window.addEventListener("load", handleLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", handleLoad);
    };
  }, []);

  return null;
}
