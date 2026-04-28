'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  FileText,
  HeartPulse,
  House,
  LogIn,
  LogOut,
  Map,
  Maximize2,
  Menu,
  MessageSquare,
  Minus,
  ShieldCheck,
  Stethoscope,
  User as UserIcon,
  X,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { AnimatedButton } from "../components/AnimatedButton";
import ThemeToggle from "@/components/ThemeToggle";
import { getSafeAuthSession, getStableAuthUser, supabase } from "@/utils/supabase/client";
import { useI18n } from "@/lib/i18n";
type DashboardWindowState = {
  title: string;
  src: string;
  minimized: boolean;
};

type ThemeAccountType = "patient" | "doctor" | null;

function extractUserFromAuthToken(parsed: unknown): User | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const asRecord = parsed as Record<string, unknown>;

  if (asRecord.user && typeof asRecord.user === "object") {
    return asRecord.user as User;
  }

  if (asRecord.currentSession && typeof asRecord.currentSession === "object") {
    const currentSession = asRecord.currentSession as Record<string, unknown>;
    if (currentSession.user && typeof currentSession.user === "object") {
      return currentSession.user as User;
    }
  }

  if (asRecord.session && typeof asRecord.session === "object") {
    const session = asRecord.session as Record<string, unknown>;
    if (session.user && typeof session.user === "object") {
      return session.user as User;
    }
  }

  return null;
}

function getCachedSupabaseUser(): User | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return null;
    }

    const projectRef = supabaseUrl.replace(/^https?:\/\//, "").split(".")[0];
    const authTokenKey = `sb-${projectRef}-auth-token`;
    const raw = window.localStorage.getItem(authTokenKey) ?? window.sessionStorage.getItem(authTokenKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        const candidateUser = extractUserFromAuthToken(entry);
        if (candidateUser) {
          return candidateUser;
        }
      }
      return null;
    }

    return extractUserFromAuthToken(parsed);
  } catch {
    return null;
  }
}

function hasSupabaseAuthToken(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return false;
    }

    const projectRef = supabaseUrl.replace(/^https?:\/\//, "").split(".")[0];
    const authTokenKey = `sb-${projectRef}-auth-token`;
    return Boolean(window.localStorage.getItem(authTokenKey) ?? window.sessionStorage.getItem(authTokenKey));
  } catch {
    return false;
  }
}

function getAccountBadgeLabel(
  accountType: ThemeAccountType,
  specialty: string | null | undefined,
  t: (key: string) => string
) {
  if (accountType === "doctor") {
    return specialty?.trim() ? `${t("common.doctor")} · ${specialty}` : t("common.doctor");
  }
  if (accountType === "patient") {
    return t("common.patient");
  }
  return t("common.account");
}

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-200/70 bg-blue-50/90 px-3 py-1 text-[10px] font-bold uppercase leading-tight tracking-[0.16em] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 sm:text-[11px] sm:tracking-[0.22em]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 dark:bg-blue-300" />
      <span className="min-w-0 break-words whitespace-normal">
        {children}
      </span>
    </span>
  );
}

function MetricCard({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint: string;
}) {
  return (
    <div className="w-full min-w-0 rounded-3xl border border-white/60 bg-white/85 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
      <p className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</p>
      <p className="mt-2 text-base leading-7 text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="w-full min-w-0 max-w-full overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.38)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 sm:p-6"
    >
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
        <Icon size={22} />
      </div>
      <h3 className="break-words text-lg font-bold tracking-tight text-slate-950 dark:text-white sm:text-xl">{title}</h3>
      <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-400">{description}</p>
    </motion.div>
  );
}

function AudienceCard({
  title,
  description,
  accent,
  bullets,
  action,
}: {
  title: string;
  description: string;
  accent: string;
  bullets: string[];
  action?: React.ReactNode;
}) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_90px_-55px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 sm:p-7">
      <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] ${accent}`}>
        Espace dédié
      </div>
      <h3 className="break-words text-xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl">{title}</h3>
      <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-400">{description}</p>
      <div className="mt-6 space-y-3">
        {bullets.map((bullet) => (
          <div key={bullet} className="flex items-start gap-3 text-base text-slate-700 dark:text-slate-300">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>{bullet}</span>
          </div>
        ))}
      </div>
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}

function WorkflowStep({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-900/80 sm:p-6">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white dark:bg-blue-600">
        {index}
      </div>
      <h3 className="break-words text-lg font-bold tracking-tight text-slate-950 dark:text-white sm:text-xl">{title}</h3>
      <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}

function DashboardWindow({
  dashboardWindow,
  setDashboardWindow,
}: {
  dashboardWindow: DashboardWindowState | null;
  setDashboardWindow: React.Dispatch<React.SetStateAction<DashboardWindowState | null>>;
}) {
  if (!dashboardWindow) {
    return null;
  }

  return (
    <div
      className={`fixed z-[80] ${
        dashboardWindow.minimized
          ? "inset-x-3 bottom-3 md:inset-x-auto md:right-5 md:bottom-5"
          : "inset-0 flex items-center justify-center bg-slate-950/45 p-0 backdrop-blur-[3px] sm:p-3 md:p-8"
      }`}
    >
      <div
        className={`overflow-hidden border border-slate-200 bg-white shadow-2xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-950 ${
          dashboardWindow.minimized
            ? "w-[min(92vw,420px)] rounded-2xl"
            : "h-screen w-screen rounded-none sm:h-[min(92vh,840px)] sm:w-[min(97vw,1240px)] sm:rounded-3xl"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 sm:h-12 sm:px-4 dark:border-slate-800 dark:bg-slate-900/70">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{dashboardWindow.title}</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setDashboardWindow((current) =>
                  current ? { ...current, minimized: !current.minimized } : current
                )
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title={dashboardWindow.minimized ? "Restaurer" : "Minimiser"}
            >
              {dashboardWindow.minimized ? <Maximize2 size={15} /> : <Minus size={15} />}
            </button>
            <button
              onClick={() => setDashboardWindow(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/80 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400"
              title="Fermer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div
          className={`transition-all duration-300 ${
            dashboardWindow.minimized ? "pointer-events-none h-0 opacity-0" : "h-[calc(100%-3.5rem)] sm:h-[calc(100%-3rem)] opacity-100"
          }`}
        >
          <iframe
            title={dashboardWindow.title}
            src={dashboardWindow.src}
            className="h-full w-full border-0 bg-white dark:bg-slate-950"
          />
        </div>

        {dashboardWindow.minimized ? (
          <button
            onClick={() =>
              setDashboardWindow((current) =>
                current ? { ...current, minimized: false } : current
              )
            }
            className="w-full bg-slate-50 px-4 py-3 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fenêtre minimisée. Cliquez pour reprendre.
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Navigation({
  user,
  displayName,
  accountType,
  accountSpecialty,
  isPlatformAdmin,
  authResolved,
  authPending,
  dashboardHref,
}: {
  user: User | null;
  displayName: string;
  accountType: ThemeAccountType;
  accountSpecialty: string | null;
  isPlatformAdmin: boolean;
  authResolved: boolean;
  authPending: boolean;
  dashboardHref: string;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isPatient = accountType === "patient";
  const findDoctorsHref = user && isPatient ? `${dashboardHref}?tab=search` : "/doctors";
  const mobileAccountHref = user ? dashboardHref : "/login";
  const primaryNavItems = [
    {
      key: "home",
      href: "/",
      label: t("common.home"),
      icon: House,
      isActive: pathname === "/",
    },
    {
      key: "find",
      href: findDoctorsHref,
      label: t("common.findDoctors"),
      icon: Stethoscope,
      isActive: pathname === "/doctors" || pathname.startsWith("/dashboardpatientlarabi"),
    },
    {
      key: "assistant",
      href: "/ai-assistant",
      label: t("common.aiAssistant"),
      icon: MessageSquare,
      isActive: pathname === "/ai-assistant",
    },
    {
      key: "community",
      href: "/community",
      label: t("common.community"),
      icon: FileText,
      isActive: pathname === "/community",
    },
  ];

  const navButtonClasses = (isActive: boolean, mobile = false) =>
    `inline-flex min-h-[46px] items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all touch-manipulation ${
      isActive
        ? "bg-slate-950 text-white shadow-[0_12px_24px_-18px_rgba(15,23,42,0.7)] dark:bg-blue-600"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    } ${mobile ? "w-full justify-between" : ""}`;

  const secondaryButtonClasses =
    "inline-flex min-h-[46px] items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-700 transition touch-manipulation hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white";

  const mobileBottomNavItems = [
    { key: "home", href: "/", label: t("common.home"), icon: House, isActive: pathname === "/" },
    { key: "find", href: findDoctorsHref, label: t("common.findDoctors"), icon: Stethoscope, isActive: pathname === "/doctors" || pathname.startsWith("/dashboardpatientlarabi") },
    { key: "community", href: "/community", label: t("common.community"), icon: FileText, isActive: pathname === "/community" },
    {
      key: "account",
      href: mobileAccountHref,
      label: user ? t("common.mySpace") : t("common.login"),
      icon: user ? UserIcon : LogIn,
      isActive:
        pathname === "/login" ||
        pathname === "/signup" ||
        pathname.startsWith("/dashboardpatientlarabi") ||
        pathname.startsWith("/dashboardoctlarabi"),
    },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center">
            <Logo size="lg" />
          </Link>

          <div className="hidden items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 lg:flex">
            {primaryNavItems.map(({ key, href, label, icon: Icon, isActive }) => (
              <Link key={key} href={href} className={navButtonClasses(isActive)}>
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            {(!authResolved || authPending) && !user ? (
              <div className="h-11 w-52 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
            ) : user ? (
              <>
                <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/90 px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <span className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <UserIcon className="size-4 shrink-0" />
                  </span>
                  <span className="flex min-w-0 flex-col items-start leading-tight">
                    <span className="max-w-[140px] truncate text-sm font-semibold text-slate-900 dark:text-white">{displayName}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                      {getAccountBadgeLabel(accountType, accountSpecialty, t)}
                    </span>
                  </span>
                </div>
                {user && isPlatformAdmin ? (
                  <Link href="/admin/community" className={secondaryButtonClasses}>
                    <Bot className="size-4" />
                    {t("home.nav.moderation")}
                  </Link>
                ) : null}
                <Link
                  href={dashboardHref}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(37,99,235,0.65)] transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  {t("common.mySpace")}
                  <ArrowRight className="size-4" />
                </Link>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                >
                  <LogOut className="size-4" />
                  {t("common.signOut")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <LogIn className="size-4" />
                  {t("common.login")}
                </Link>
                <AnimatedButton href="/signup" className="inline-flex h-10 w-auto items-center justify-center px-5 text-sm">
                  {t("common.signup")}
                </AnimatedButton>
              </>
            )}
          </div>

          <button
            onClick={() => setMobileOpen((current) => !current)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-700 transition touch-manipulation hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu size={20} />
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-h-[calc(100vh-72px)] overflow-y-auto border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden"
            >
              <div className="flex flex-col gap-2">
                {primaryNavItems.map(({ key, href, label, icon: Icon, isActive }) => (
                  <Link
                    key={key}
                    href={href}
                    className={navButtonClasses(isActive, true)}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="size-4" />
                      {label}
                    </span>
                    <ArrowRight className="size-4 opacity-50" />
                  </Link>
                ))}
                {user && isPlatformAdmin ? (
                  <Link
                    href="/admin/community"
                    className={`${secondaryButtonClasses} w-full justify-between`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Bot className="size-4" />
                      {t("home.nav.moderation")}
                    </span>
                  </Link>
                ) : null}
                <div className="mt-2">
                  <ThemeToggle variant="inline" className="justify-between" />
                </div>
                <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                  {user ? (
                    <div className="flex flex-col gap-3">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                        <p className="font-semibold text-slate-900 dark:text-white">{displayName}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                          {getAccountBadgeLabel(accountType, accountSpecialty, t)}
                        </p>
                      </div>
                      <Link
                        href={dashboardHref}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                        onClick={() => setMobileOpen(false)}
                      >
                        {t("common.mySpace")}
                        <ArrowRight className="size-4" />
                      </Link>
                      <button
                        onClick={async () => {
                          setMobileOpen(false);
                          await handleSignOut();
                        }}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-red-200 px-4 text-sm font-medium text-red-600 dark:border-red-900/60 dark:text-red-400"
                      >
                        <LogOut className="size-4" />
                        {t("common.signOut")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <Link href="/login" className={navButtonClasses(pathname === "/login", true)} onClick={() => setMobileOpen(false)}>
                        <LogIn className="size-4" />
                        {t("common.login")}
                      </Link>
                      <AnimatedButton href="/signup" className="inline-flex h-11 items-center justify-center text-sm">
                        {t("common.signup")}
                      </AnimatedButton>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </nav>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
        <div className="pointer-events-auto mx-auto max-w-md rounded-[28px] border border-slate-200/80 bg-white/92 p-1.5 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.38)] backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-950/92">
          <div className="grid grid-cols-4 gap-1">
            {mobileBottomNavItems.map(({ key, href, label, icon: Icon, isActive }) => (
              <Link
                key={key}
                href={href}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[20px] px-2 text-center text-[11px] font-semibold transition touch-manipulation ${
                  isActive
                    ? "bg-blue-600 text-white shadow-[0_16px_36px_-24px_rgba(37,99,235,0.7)]"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="line-clamp-2 leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Landing() {
  const { t, language } = useI18n();
  const tr = (fr: string, en: string, ar: string) =>
    language === "ar" ? ar : language === "en" ? en : fr;
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("Dashboard");
  const [accountType, setAccountType] = useState<ThemeAccountType>(null);
  const [accountSpecialty, setAccountSpecialty] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [dashboardHref, setDashboardHref] = useState("/dashboardpatientlarabi");
  const [authResolved, setAuthResolved] = useState(false);
  const [authPending, setAuthPending] = useState(true);
  const [dashboardWindow, setDashboardWindow] = useState<DashboardWindowState | null>(null);

  useEffect(() => {
    document.title = `TIRYAQ - ${t("home.hero.badge")}`;
  }, [t]);

  useEffect(() => {
    let isMounted = true;

    const applyUserSnapshot = (snapshotUser: User | null) => {
      setUser(snapshotUser);

      if (!snapshotUser) {
        setAccountType(null);
        setAccountSpecialty(null);
        setIsPlatformAdmin(false);
        setDisplayName("Dashboard");
        setDashboardHref("/dashboardpatientlarabi");
        return;
      }

      setDisplayName(
        snapshotUser.user_metadata?.full_name ||
          snapshotUser.user_metadata?.name ||
          snapshotUser.email?.split("@")[0] ||
          "Dashboard"
      );
      setAccountType(null);
      setAccountSpecialty(null);
      // NOTE: Do NOT reset dashboardHref here — refreshProfileSnapshot will set the correct one.
      // Resetting to "/" here caused a race condition where clicking the dashboard link
      // before the profile loaded would navigate to the home page instead of the dashboard.
    };

    const refreshProfileSnapshot = async (userId: string) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type, full_name, specialty, is_platform_admin, doctor_verification_status, is_doctor_verified, moderation_status")
        .eq("id", userId)
        .single();

      if (!isMounted || !profile) {
        return;
      }

      if (profile.account_type === "doctor") {
        setAccountType("doctor");
        setDashboardHref("/dashboardoctlarabi");
      } else if (profile.account_type === "patient") {
        setAccountType("patient");
        setDashboardHref("/dashboardpatientlarabi");
      }

      setAccountSpecialty(profile.specialty ?? null);

      if (profile.full_name) {
        setDisplayName(profile.full_name);
      }

      setIsPlatformAdmin(Boolean(profile.is_platform_admin));
    };

    async function bootstrapUser() {
      const hasTokenSnapshot = hasSupabaseAuthToken();
      setAuthPending(hasTokenSnapshot);
      const cachedUser = getCachedSupabaseUser();
      applyUserSnapshot(cachedUser);

      if (cachedUser) {
        setAuthResolved(true);
        setAuthPending(false);
      }

      const { session, error: sessionError } = await getSafeAuthSession();
      if (sessionError && sessionError.includes("Refresh Token Not Found")) {
        await supabase.auth.signOut();
      }

      let sessionUser = session?.user ?? null;
      if (sessionUser) {
        const { user: verifiedUser, error: userError } = await getStableAuthUser();
        sessionUser = verifiedUser;
        if (userError || !sessionUser) {
          await supabase.auth.signOut();
          applyUserSnapshot(null);
          setAuthResolved(true);
          setAuthPending(false);
          return;
        }
      }

      applyUserSnapshot(sessionUser);
      setAuthResolved(true);

      if (sessionUser || !hasTokenSnapshot) {
        setAuthPending(false);
      } else {
        window.setTimeout(() => {
          if (isMounted) {
            setAuthPending(false);
          }
        }, 1200);
      }

      if (sessionUser) {
        void refreshProfileSnapshot(sessionUser.id);
      }
    }

    void bootstrapUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      const snapshotUser = session?.user ?? null;
      applyUserSnapshot(snapshotUser);
      setAuthResolved(true);
      setAuthPending(false);
      if (snapshotUser) {
        void refreshProfileSnapshot(snapshotUser.id);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const openDashboardWindow = (title: string, tab: string) => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (accountType === "doctor" && dashboardHref === "/doctor-verification") {
      router.push("/doctor-verification");
      return;
    }

    const basePath = accountType === "doctor" ? "/dashboardoctlarabi" : "/dashboardpatientlarabi";
    setDashboardWindow({
      title,
      src: `${basePath}?tab=${tab}&embed=1`,
      minimized: false,
    });
  };

  const heroPrimaryAction = user
    ? accountType === "doctor"
      ? { label: t("home.hero.openDoctorDashboard"), action: () => openDashboardWindow(t("common.dashboard"), "appointments") }
      : {
          label: tr("Ouvrir mon espace patient", "Open my patient space", "فتح مساحة المريض"),
          action: () => openDashboardWindow(t("common.mySpace"), "overview"),
        }
    : null;
  const heroFindDoctorsHref = user && accountType === "patient" ? `${dashboardHref}?tab=search` : "/doctors";
  const guestPatientSignupHref = "/signup?role=patient";
  const guestDoctorSignupHref = "/signup?role=doctor";

  const heroDescription =
    language === "ar" ? (
      <>
        {"يجمع "}
        <bdi dir="ltr">TIRYAQ</bdi>
        {" بين التوجيه بالذكاء الاصطناعي، والبحث عن الأطباء، والحجوزات، والمنشورات الطبية، والمتابعة المهنية في تجربة واحدة متماسكة وجدية."}
      </>
    ) : (
      t("home.hero.description")
    );

  return (
    <div className="min-h-screen overflow-x-clip bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_24%,#f8fafc_100%)] text-slate-900 transition-colors duration-150 dark:bg-[linear-gradient(180deg,#020617_0%,#020817_30%,#020617_100%)] dark:text-white">
      <Navigation
        user={user}
        displayName={displayName}
        accountType={accountType}
        accountSpecialty={accountSpecialty}
        isPlatformAdmin={isPlatformAdmin}
        authResolved={authResolved}
        authPending={authPending}
        dashboardHref={dashboardHref}
      />

      <main className="overflow-x-clip pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute left-[-8%] top-24 h-72 w-72 rounded-full bg-blue-200/45 blur-3xl dark:bg-blue-900/25" />
            <div className="absolute right-[-10%] top-20 h-96 w-96 rounded-full bg-cyan-200/45 blur-3xl dark:bg-cyan-900/20" />
            <div className="absolute bottom-[-5%] left-[28%] h-72 w-72 rounded-full bg-indigo-200/35 blur-3xl dark:bg-indigo-900/20" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-18 sm:pt-14 lg:px-8 lg:pb-24 lg:pt-20">
            <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="order-1 max-w-3xl"
              >
                <SectionBadge>{t("home.hero.badge")}</SectionBadge>
                <h1 className="mt-5 max-w-full break-words text-[1.95rem] font-black leading-[1.02] tracking-[-0.05em] text-slate-950 dark:text-white sm:mt-6 sm:text-5xl lg:text-7xl">
                  {t("home.hero.titleMain")}
                  <span className="block text-blue-600 dark:text-blue-400">{t("home.hero.titleAccent")}</span>
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:mt-6 sm:text-lg sm:leading-8 lg:text-xl">
                  {heroDescription}
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row">
                  {heroPrimaryAction ? (
                    <button
                      onClick={heroPrimaryAction.action}
                      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-[0_18px_55px_-28px_rgba(37,99,235,0.7)] transition touch-manipulation hover:bg-blue-700 sm:w-auto"
                    >
                      {heroPrimaryAction.label}
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
                      <Link
                        href={guestPatientSignupHref}
                        className="group flex min-h-[72px] w-full items-center justify-between rounded-[26px] bg-blue-600 px-5 py-4 text-left text-white shadow-[0_18px_55px_-28px_rgba(37,99,235,0.7)] transition touch-manipulation hover:bg-blue-700"
                      >
                        <span className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/16 text-white">
                            <UserIcon size={18} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100/90">
                              {tr("Compte patient", "Patient account", "حساب المريض")}
                            </span>
                            <span className="mt-1 block text-base font-semibold leading-6">
                              {tr("Créer mon espace", "Create my space", "إنشاء مساحتي")}
                            </span>
                          </span>
                        </span>
                        <ArrowRight size={18} className="shrink-0 transition group-hover:translate-x-0.5" />
                      </Link>
                      <Link
                        href={guestDoctorSignupHref}
                        className="group flex min-h-[72px] w-full items-center justify-between rounded-[26px] border border-slate-200 bg-white/92 px-5 py-4 text-left text-slate-800 transition touch-manipulation hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                      >
                        <span className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-blue-500">
                            <Stethoscope size={18} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              {tr("Praticien", "Practitioner", "الممارس")}
                            </span>
                            <span className="mt-1 block text-base font-semibold leading-6">
                              {tr("Accéder à l'espace médecin", "Open practitioner space", "فتح مساحة الطبيب")}
                            </span>
                          </span>
                        </span>
                        <ArrowRight size={18} className="shrink-0 transition group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  )}
                  {heroPrimaryAction ? (
                    <Link
                      href={heroFindDoctorsHref}
                      className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-slate-200 bg-white/90 px-6 py-3.5 text-base font-semibold text-slate-700 transition touch-manipulation hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 sm:w-auto dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      {t("common.findDoctors")}
                    </Link>
                  ) : null}
                </div>
                {!user ? (
                  <div className="mt-3">
                    <Link
                      href={heroFindDoctorsHref}
                      className="text-sm font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {tr("Voir les médecins disponibles", "Browse available doctors", "عرض الأطباء المتاحين")}
                    </Link>
                  </div>
                ) : null}

                <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 xl:grid-cols-3">
                  <MetricCard value="24/7" label={t("home.metrics.ai.label")} hint={t("home.metrics.ai.hint")} />
                  <MetricCard value="< 3 min" label={t("home.metrics.speed.label")} hint={t("home.metrics.speed.hint")} />
                  <MetricCard value="2" label={t("home.metrics.roles.label")} hint={t("home.metrics.roles.hint")} />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="relative order-2 lg:order-none"
              >
                <div className="rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.55)] backdrop-blur-2xl sm:rounded-[36px] sm:p-6 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 pb-5 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">{t("home.panel.kicker")}</p>
                      <h2 className="mt-2 break-words text-xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl">{t("home.panel.title")}</h2>
                    </div>
                    <div className="rounded-2xl bg-blue-600 p-3 text-white shadow-lg shadow-blue-600/20">
                      <HeartPulse size={20} className="sm:size-[22px]" />
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-3xl border border-slate-200/70 bg-slate-50/85 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t("home.panel.patientJourney")}</p>
                          <p className="mt-2 break-words text-base font-bold text-slate-950 dark:text-white sm:text-lg">{t("home.panel.patientJourneyDesc")}</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <Map size={20} />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-3xl border border-slate-200/70 bg-slate-50/85 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-blue-100 p-3 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                            <Bot size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t("home.panel.assistant")}</p>
                            <p className="text-base font-bold text-slate-950 dark:text-white">{t("home.panel.assistantDesc")}</p>
                          </div>
                        </div>
                        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">
                          {t("home.panel.assistantBody")}
                        </p>
                      </div>

                      <div className="rounded-3xl border border-slate-200/70 bg-slate-50/85 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-violet-100 p-3 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                            <Stethoscope size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t("home.panel.doctorSpace")}</p>
                            <p className="text-base font-bold text-slate-950 dark:text-white">{t("home.panel.doctorSpaceDesc")}</p>
                          </div>
                        </div>
                        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">
                          {t("home.panel.doctorSpaceBody")}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[28px] bg-slate-950 p-6 text-white dark:bg-blue-950/50">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">{t("home.panel.quality")}</p>
                          <p className="mt-2 text-base font-bold sm:text-lg">{t("home.panel.qualityBody")}</p>
                        </div>
                        <ShieldCheck className="size-10 shrink-0 text-blue-300" />
                      </div>
                    </div>
                  </div>
                </div>

              </motion.div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-8 max-w-3xl sm:mb-12">
            <SectionBadge>{t("home.roles.badge")}</SectionBadge>
            <h2 className="mt-5 max-w-full break-words text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
              {t("home.roles.title")}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-400 sm:text-lg sm:leading-8">
              {t("home.roles.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <AudienceCard
              title={t("home.roles.patient.title")}
              description={t("home.roles.patient.description")}
              accent="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              bullets={[
                t("home.roles.patient.bullet1"),
                t("home.roles.patient.bullet2"),
                t("home.roles.patient.bullet3"),
              ]}
            />

            <AudienceCard
              title={t("home.roles.doctor.title")}
              description={t("home.roles.doctor.description")}
              accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              bullets={[
                t("home.roles.doctor.bullet1"),
                t("home.roles.doctor.bullet2"),
                t("home.roles.doctor.bullet3"),
              ]}
            />
          </div>
        </section>

        <section className="overflow-hidden border-y border-slate-200/70 bg-slate-50/80 py-14 dark:border-slate-800 dark:bg-slate-950/60 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col gap-4 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <SectionBadge>{t("home.features.badge")}</SectionBadge>
                <h2 className="mt-5 max-w-full break-words text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
                  {t("home.features.title")}
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400 sm:leading-8">
                {t("home.features.description")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <FeatureCard
                icon={Bot}
                title={t("home.features.assistant.title")}
                description={t("home.features.assistant.body")}
              />
              <FeatureCard
                icon={Map}
                title={t("home.features.search.title")}
                description={t("home.features.search.body")}
              />
              <FeatureCard
                icon={CalendarDays}
                title={t("home.features.booking.title")}
                description={t("home.features.booking.body")}
              />
              <FeatureCard
                icon={FileText}
                title={t("home.features.community.title")}
                description={t("home.features.community.body")}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-8 max-w-3xl sm:mb-12">
            <SectionBadge>{t("home.workflow.badge")}</SectionBadge>
            <h2 className="mt-5 max-w-full break-words text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
              {t("home.workflow.title")}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-400 sm:text-lg sm:leading-8">
              {t("home.workflow.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <WorkflowStep
              index="01"
              title={t("home.workflow.step1.title")}
              description={t("home.workflow.step1.body")}
            />
            <WorkflowStep
              index="02"
              title={t("home.workflow.step2.title")}
              description={t("home.workflow.step2.body")}
            />
            <WorkflowStep
              index="03"
              title={t("home.workflow.step3.title")}
              description={t("home.workflow.step3.body")}
            />
          </div>
        </section>

        <section className="pb-20 sm:pb-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 px-5 py-8 shadow-[0_40px_120px_-70px_rgba(15,23,42,0.8)] dark:border-slate-800 sm:rounded-[36px] sm:px-10 sm:py-10 lg:px-12">
              <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-300">{t("home.cta.kicker")}</p>
                  <h2 className="mt-4 max-w-full break-words text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl">
                    {t("home.cta.title")}
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                    {t("home.cta.body")}
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  {user ? (
                    <button
                      onClick={() =>
                        openDashboardWindow(
                          accountType === "doctor" ? "Dashboard Docteur" : "Dashboard Patient",
                          accountType === "doctor" ? "appointments" : "overview"
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3.5 text-base font-semibold text-slate-950 transition hover:bg-slate-100"
                    >
                      {t("home.cta.openSpace")}
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <AnimatedButton href="/signup" className="inline-flex items-center justify-center px-6 py-4 text-base">
                      {t("home.cta.startNow")}
                    </AnimatedButton>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <DashboardWindow
        dashboardWindow={dashboardWindow}
        setDashboardWindow={setDashboardWindow}
      />

      <footer className="border-t border-slate-200/80 bg-white/90 py-10 dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex flex-col items-center gap-4 text-center lg:flex-row lg:text-left">
            <Logo size="lg" />
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("home.footer.tagline")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500 dark:text-slate-400 lg:justify-end">
            <Link href="/ai-assistant" className="transition hover:text-slate-900 dark:hover:text-white">{t("common.aiAssistant")}</Link>
            <Link href="/community" className="transition hover:text-slate-900 dark:hover:text-white">{t("common.community")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
