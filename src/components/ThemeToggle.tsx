// made by larabi
'use client';
import { useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { AppLanguage } from '@/lib/i18n-config';

type ThemePreference = 'light' | 'dark' | 'system';
type ThemeToggleProps = {
  variant?: 'floating' | 'inline';
  className?: string;
};

function persistThemePreference(preference: ThemePreference) {
  localStorage.setItem('theme', preference);
  document.cookie = `theme=${preference}; path=/; max-age=31536000; samesite=lax`;
}

function disableThemeTransitionsTemporarily() {
  const root = document.documentElement;
  root.classList.add('theme-no-transition');

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.classList.remove('theme-no-transition');
    });
  });
}

function applyTheme(preference: ThemePreference) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = preference === 'dark' || (preference === 'system' && prefersDark);
  disableThemeTransitionsTemporarily();
  document.documentElement.classList.toggle('dark', useDark);
  document.documentElement.style.colorScheme = useDark ? 'dark' : 'light';
}

export default function ThemeToggle({
  variant = 'floating',
  className = '',
}: ThemeToggleProps) {
  const { language, setLanguage, t } = useI18n();
  const isEmbedded =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('embed') === '1';

  const languageOptions: AppLanguage[] = ['ar', 'en', 'fr'];

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const initialPreference: ThemePreference =
      stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';

    // Mode auto activé par défaut.
    if (!stored) {
      persistThemePreference('system');
    } else {
      document.cookie = `theme=${initialPreference}; path=/; max-age=31536000; samesite=lax`;
    }

    applyTheme(initialPreference);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = () => {
      const current = localStorage.getItem('theme') ?? 'system';
      if (current === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const toggleTheme = () => {
    const stored = localStorage.getItem('theme');
    const currentPreference: ThemePreference =
      stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    const isDarkNow = document.documentElement.classList.contains('dark');

    const nextPreference: ThemePreference =
      currentPreference === 'system'
        ? (isDarkNow ? 'light' : 'dark')
        : (currentPreference === 'dark' ? 'light' : 'dark');

    persistThemePreference(nextPreference);
    applyTheme(nextPreference);
  };

  if (variant === 'floating' && isEmbedded) {
    return null;
  }

  if (variant === 'inline') {
    return (
      <div
        data-print-hidden="true"
        className={`flex items-center justify-end gap-2 ${className}`.trim()}
      >
        <div
          dir="ltr"
          className="inline-flex items-center rounded-full border border-slate-200 bg-white/96 p-1 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/96 dark:shadow-[0_10px_24px_-16px_rgba(255,255,255,0.05)]"
          aria-label={t("language.switcherLabel")}
        >
          {languageOptions.map((option) => {
            const isActive = option === language;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setLanguage(option)}
                className={`rounded-full px-2.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-all duration-150 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.8)]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
                aria-label={`${t("language.switcherLabel")} ${option.toUpperCase()}`}
              >
                {option.toUpperCase()}
              </button>
            );
          })}
        </div>
        <button
          onClick={toggleTheme}
          title={t("theme.toggleTitle")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.28)] transition-all duration-150 hover:scale-[1.03] active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-yellow-400 dark:shadow-[0_10px_24px_-16px_rgba(255,255,255,0.05)]"
          aria-label={t("theme.toggleAria")}
        >
          <div className="relative flex h-5 w-5 items-center justify-center">
            <Sun size={20} className="hidden dark:block transform rotate-0 scale-100 transition-all duration-150" />
            <Moon size={20} className="block dark:hidden transform rotate-0 scale-100 transition-all duration-150" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      data-print-hidden="true"
      className={`fixed bottom-6 z-[9998] ltr:right-6 rtl:left-6 max-sm:bottom-4 ltr:max-sm:right-4 rtl:max-sm:left-4 ${className}`.trim()}
    >
      <div dir="ltr" className="flex items-center gap-3">
        <div
          className="inline-flex items-center rounded-full border border-slate-200 bg-white/96 p-1 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/96 dark:shadow-[0_10px_40px_-10px_rgba(255,255,255,0.05)]"
          aria-label={t("language.switcherLabel")}
        >
          {languageOptions.map((option) => {
            const isActive = option === language;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setLanguage(option)}
                className={`rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-all duration-150 max-sm:px-2.5 max-sm:text-[11px] ${
                  isActive
                    ? "bg-blue-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.8)]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
                aria-label={`${t("language.switcherLabel")} ${option.toUpperCase()}`}
              >
                {option.toUpperCase()}
              </button>
            );
          })}
        </div>
        <button
          onClick={toggleTheme}
          title={t("theme.toggleTitle")}
          className="p-4 rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] dark:shadow-[0_10px_40px_-10px_rgba(255,255,255,0.05)] bg-white dark:bg-slate-900 text-slate-900 dark:text-yellow-400 hover:scale-[1.03] active:scale-95 transition-all duration-150 border border-slate-200 dark:border-slate-800 flex items-center justify-center group"
          aria-label={t("theme.toggleAria")}
        >
          <div className="relative w-6 h-6 flex items-center justify-center">
            <Sun size={24} className="hidden dark:block transform rotate-0 scale-100 transition-all duration-150 group-hover:rotate-45" />
            <Moon size={24} className="block dark:hidden transform rotate-0 scale-100 transition-all duration-150 group-hover:-rotate-12" />
          </div>
        </button>
      </div>
    </div>
  );
}
// made by larabi
