// made by mohamed
'use client';
// made by mohamed
import { useI18n } from "@/lib/i18n";

export default function AuthError() {
    const { t } = useI18n();
    return (
        <div className="flex h-screen w-full items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-red-600">{t("authError.title")}</h1>
                <p className="text-gray-600 dark:text-slate-300">
                    {t("authError.description")}
                </p>
                <a href="/login" className="mt-4 block text-blue-600 dark:text-blue-400 hover:underline">
                    {t("authError.backToLogin")}
                </a>
            </div>
        </div>
    )
}
// made by mohamed
