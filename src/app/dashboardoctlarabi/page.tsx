import { Suspense } from "react";
import DashboardOctLarabiClient from "./DashboardOctLarabiClient";
import { requireDoctorDashboardAccess } from "@/utils/serverAccessGuards";

export const dynamic = "force-dynamic";

export default async function DashboardOctLarabiPage() {
  await requireDoctorDashboardAccess();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <DashboardOctLarabiClient />
    </Suspense>
  );
}
