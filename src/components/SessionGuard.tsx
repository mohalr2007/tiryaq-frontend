"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  clearSupabaseAuthSnapshot,
  getStableAuthUser,
  hasSupabaseAuthTokenSnapshot,
  isMissingRefreshTokenError,
  supabase,
} from "@/utils/supabase/client";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/auth/callback",
  "/auth/auth-error",
  "/admin-page",
];

function isPublicPath(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function SessionGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const inFlightRef = useRef(false);
  const lastCheckAtRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const clearRetryTimer = () => {
      if (retryTimerRef.current != null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const revalidateSession = async (
      reason: "mount" | "visible" | "focus" | "online" | "interval" | "auth",
    ) => {
      if (!isMounted || inFlightRef.current) {
        return;
      }

      if (
        typeof document !== "undefined" &&
        document.hidden &&
        reason !== "mount" &&
        reason !== "auth"
      ) {
        return;
      }

      const now = Date.now();
      if (reason === "interval" && now - lastCheckAtRef.current < 15000) {
        return;
      }

      inFlightRef.current = true;

      try {
        const { user, error } = await getStableAuthUser();

        if (isMissingRefreshTokenError(error)) {
          clearSupabaseAuthSnapshot();
          await supabase.auth.signOut();
          if (!isPublicPath(pathname)) {
            router.replace("/login");
          }
          return;
        }

        if (!user) {
          // If a token snapshot still exists, allow time for the browser client
          // to rebuild its session instead of forcing a logout on transient wake-ups.
          if (hasSupabaseAuthTokenSnapshot()) {
            clearRetryTimer();
            retryTimerRef.current = window.setTimeout(() => {
              retryTimerRef.current = null;
              void revalidateSession("auth");
            }, 900);
            return;
          }
          return;
        }

        clearRetryTimer();
        const params = new URLSearchParams();
        if (user.email) {
          params.set("email", user.email);
        }

        const response = await fetch(
          `/api/account-eligibility${params.size ? `?${params.toString()}` : ""}`,
          {
            cache: "no-store",
            credentials: "include",
            headers: { accept: "application/json" },
          },
        );

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          blocked?: boolean;
          restricted?: boolean;
        };

        if (payload.blocked || payload.restricted) {
          // The dashboards now surface moderation/blacklist notices directly
          // to the signed-in user, so we avoid forcing a logout loop here.
          lastCheckAtRef.current = now;
          return;
        }

        lastCheckAtRef.current = now;
      } catch {
        // Ignore transient guard failures; the next focus/visibility/interval check will retry.
      } finally {
        inFlightRef.current = false;
      }
    };

    void revalidateSession("mount");

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        void revalidateSession("visible");
      }
    };

    const handleFocus = () => {
      void revalidateSession("focus");
    };

    const handleOnline = () => {
      void revalidateSession("online");
    };

    const handlePageShow = () => {
      void revalidateSession("visible");
    };

    const intervalId = window.setInterval(() => {
      void revalidateSession("interval");
    }, 12000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearRetryTimer();
        if (!isPublicPath(pathname)) {
          router.replace("/login");
        }
        return;
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        void revalidateSession("auth");
      }
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      clearRetryTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pageshow", handlePageShow);
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  return null;
}
