'use client';

import { useEffect } from "react";

type PrescriptionAutoPrintProps = {
  enabled: boolean;
  ready?: boolean;
};

export default function PrescriptionAutoPrint({ enabled, ready = true }: PrescriptionAutoPrintProps) {
  useEffect(() => {
    if (!enabled || !ready) {
      return;
    }

    let cancelled = false;
    const timerId = window.setTimeout(() => {
      const printWhenReady = async () => {
        try {
          if ("fonts" in document) {
            await Promise.race([
              document.fonts.ready,
              new Promise((resolve) => window.setTimeout(resolve, 1500)),
            ]);
          }
        } catch {
          // ignore font readiness failures
        }

        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (!cancelled) {
              window.print();
            }
          });
        });
      };

      void printWhenReady();
    }, 1100);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [enabled, ready]);

  return null;
}
