'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStableAuthUser, supabase } from "@/utils/supabase/client";
import { useI18n } from "@/lib/i18n";

export default function CommunityPage() {
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function redirectToCommunity() {
      const { user, error } = await getStableAuthUser();

      if (!isMounted) {
        return;
      }

      if (error && !user) {
        return;
      }

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
        router.replace("/dashboardoctlarabi?tab=community");
        return;
      }

      router.replace("/dashboardpatientlarabi?tab=community");
    }

    void redirectToCommunity();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <p className="text-slate-600 dark:text-slate-300 font-medium">{t("redirect.community")}</p>
    </div>
  );
}
