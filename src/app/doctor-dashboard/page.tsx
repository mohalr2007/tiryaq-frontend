'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LegacyDoctorDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboardoctlarabi");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-lg">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Redirection du dashboard</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Cette ancienne route a été conservée pour compatibilité. Vous êtes redirigé vers le dashboard médecin principal.
        </p>
        <Link
          href="/dashboardoctlarabi"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium transition"
        >
          Ouvrir le dashboard médecin
        </Link>
      </div>
    </div>
  );
}
