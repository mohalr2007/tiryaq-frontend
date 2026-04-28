'use client';
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export default function DoctorsPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t("doctors.title")}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          {t("doctors.description")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 font-medium transition"
          >
            {t("doctors.login")}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {t("common.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
