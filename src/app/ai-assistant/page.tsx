"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStableAuthUser, supabase } from "@/utils/supabase/client";
import { useI18n } from "@/lib/i18n";

export default function AiAssistantPage() {
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const routeUser = async () => {
      const { user } = await getStableAuthUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .single();

      if (!isMounted) {
        return;
      }

      if (profile?.account_type === "doctor") {
        router.replace("/dashboardoctlarabi?tab=ai-assistant");
        return;
      }

      router.replace("/dashboardpatientlarabi?tab=ai-assistant");
    };

    void routeUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        <p className="text-sm font-medium text-slate-300">{t("redirect.ai")}</p>
      </div>
    </div>
  );
}
