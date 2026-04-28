'use client';
/* eslint-disable @next/next/no-img-element */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Home,
  Inbox,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserPlus,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import type {
  AdminBlockedEmail,
  AdminCommunityReport,
  AdminDoctorDocumentType,
  AdminDoctorStatus,
  AdminManagedDoctor,
  AdminManagedDoctorDetails,
  AdminModerationActionType,
  AdminPortalOverview,
  AdminPortalRole,
  AdminUserPublic,
} from "./types";

const ThemeToggle = dynamic(() => import("@/components/ThemeToggle"), {
  ssr: false,
});

type SessionUser = {
  id: string;
  username: string;
  fullName: string | null;
  role: AdminPortalRole;
};

type AdminPortalPageProps = {
  initialUser?: SessionUser | null;
};

type LoginState = {
  username: string;
  password: string;
};

type CreateAdminState = {
  username: string;
  fullName: string;
  password: string;
  role: AdminPortalRole;
};

const defaultOverview: AdminPortalOverview = {
  totalDoctors: 0,
  pendingDoctors: 0,
  approvedDoctors: 0,
  rejectedDoctors: 0,
  totalAdmins: 0,
  openReports: 0,
  blockedEmails: 0,
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  let payload: ({ error?: string } & T) | null = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText) as { error?: string } & T;
    } catch {
      throw new Error("Réponse API invalide.");
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? "Erreur API.");
  }

  if (!payload) {
    throw new Error("Réponse API vide ou invalide.");
  }

  return payload as T;
}

function initialsFromName(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return "DR";
  }

  return normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Non défini";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Non défini";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 KB";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function doctorStatusClasses(status: AdminDoctorStatus) {
  if (status === "approved") {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-100";
  }

  if (status === "rejected") {
    return "border-rose-400/30 bg-rose-500/15 text-rose-100";
  }

  return "border-amber-400/30 bg-amber-500/15 text-amber-100";
}

function moderationStatusClasses(status: string) {
  if (status === "warned") {
    return "border-amber-400/30 bg-amber-500/15 text-amber-100";
  }
  if (status === "temporarily_blocked") {
    return "border-orange-400/30 bg-orange-500/15 text-orange-100";
  }
  if (status === "permanently_blocked") {
    return "border-rose-400/30 bg-rose-500/15 text-rose-100";
  }

  return "border-cyan-400/25 bg-cyan-500/10 text-cyan-100";
}

function reportStatusClasses(status: string) {
  if (status === "actioned") {
    return "border-rose-400/30 bg-rose-500/15 text-rose-100";
  }
  if (status === "dismissed") {
    return "border-slate-500/30 bg-slate-500/15 text-slate-200";
  }
  if (status === "reviewed") {
    return "border-blue-400/30 bg-blue-500/15 text-blue-100";
  }
  return "border-amber-400/30 bg-amber-500/15 text-amber-100";
}

function documentTypeLabel(documentType: AdminDoctorDocumentType) {
  if (documentType === "clinic_document") {
    return "Papiers de clinique";
  }
  if (documentType === "medical_certificate") {
    return "Certificat médical";
  }
  return "Autre pièce";
}

function moderationActionLabel(actionType: AdminModerationActionType) {
  if (actionType === "warning") {
    return "Avertir";
  }
  if (actionType === "temporary_block") {
    return "Bloc temporaire";
  }
  if (actionType === "permanent_block") {
    return "Bloc définitif";
  }
  return "Fausse alerte";
}

function OverviewCard({
  label,
  value,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof UserRound;
  tone: string;
  onClick?: () => void;
}) {
  const Component = onClick ? "button" : "article";
  return (
    <Component
      onClick={onClick}
      className={`w-full text-left rounded-[28px] border p-5 shadow-[0_24px_80px_-55px_rgba(37,99,235,0.95)] ${tone} ${
        onClick ? "cursor-pointer hover:opacity-80 hover:scale-[1.02] transition-all" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.24em]">{label}</p>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-5 text-4xl font-black tracking-tight text-white">{value}</p>
    </Component>
  );
}

export default function AdminPortalPage({ initialUser = null }: AdminPortalPageProps) {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(initialUser);
  const [overview, setOverview] = useState<AdminPortalOverview>(defaultOverview);
  const [doctors, setDoctors] = useState<AdminManagedDoctor[]>([]);
  const [admins, setAdmins] = useState<AdminUserPublic[]>([]);
  const [reports, setReports] = useState<AdminCommunityReport[]>([]);
  const [blockedEmails, setBlockedEmails] = useState<AdminBlockedEmail[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<AdminManagedDoctorDetails | null>(null);
  const [doctorNotes, setDoctorNotes] = useState<Record<string, string>>({});

  const [loginState, setLoginState] = useState<LoginState>({ username: "", password: "" });
  const [createAdminState, setCreateAdminState] = useState<CreateAdminState>({
    username: "",
    fullName: "",
    password: "",
    role: "admin",
  });

  const [statusFilter, setStatusFilter] = useState<"all" | AdminDoctorStatus>("pending");
  const [search, setSearch] = useState("");

  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isLoadingDoctorDetails, setIsLoadingDoctorDetails] = useState(false);
  const [isUpdatingDoctor, setIsUpdatingDoctor] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [activeReportActionId, setActiveReportActionId] = useState<string | null>(null);
  const [activeBlockedEmailId, setActiveBlockedEmailId] = useState<string | null>(null);
  const [isBlockingEmail, setIsBlockingEmail] = useState(false);
  const [blockEmailAddress, setBlockEmailAddress] = useState("");
  const [blockEmailReason, setBlockEmailReason] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const autoRefreshInFlightRef = useRef(false);

  const hasSuperAdminAccess = sessionUser?.role === "super_admin";

  const displayedDoctors = useMemo(() => {
    return doctors.filter(doctor => {
      if (statusFilter !== "all" && doctor.verificationStatus !== statusFilter) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        doctor.fullName?.toLowerCase().includes(term) ||
        doctor.specialty?.toLowerCase().includes(term) ||
        doctor.address?.toLowerCase().includes(term)
      );
    });
  }, [doctors, statusFilter, search]);

  const filteredDoctorCountLabel = useMemo(() => {
    if (statusFilter === "all" && !search) {
      return `${displayedDoctors.length} docteur(s) chargés`;
    }
    return `${displayedDoctors.length} docteur(s) trouvés`;
  }, [displayedDoctors.length, statusFilter, search]);

  const selectedDoctorNote = selectedDoctor
    ? doctorNotes[selectedDoctor.id] ?? selectedDoctor.verificationNote ?? ""
    : "";

  const loadOverview = async () => {
    const payload = await parseJsonResponse<AdminPortalOverview>(
      await fetch("/api/admin-page/overview", { cache: "no-store" })
    );
    setOverview({
      ...defaultOverview,
      ...payload,
    });
  };

  const loadDoctors = async () => {
    const payload = await parseJsonResponse<{ doctors: AdminManagedDoctor[] }>(
      await fetch(`/api/admin-page/doctors?status=all`, { cache: "no-store" })
    );
    const nextDoctors = Array.isArray(payload.doctors) ? payload.doctors : [];
    setDoctors(nextDoctors);
    setDoctorNotes((current) => {
      const next = { ...current };
      nextDoctors.forEach((doctor) => {
        if (typeof next[doctor.id] === "undefined") {
          next[doctor.id] = doctor.verificationNote ?? "";
        }
      });
      return next;
    });
  };

  const loadAdmins = async () => {
    const payload = await parseJsonResponse<{ admins: AdminUserPublic[] }>(
      await fetch("/api/admin-page/admins", { cache: "no-store" })
    );
    setAdmins(Array.isArray(payload.admins) ? payload.admins : []);
  };

  const loadReports = async () => {
    const payload = await parseJsonResponse<{
      reports: AdminCommunityReport[];
      blockedEmails: AdminBlockedEmail[];
    }>(await fetch("/api/admin-page/reports", { cache: "no-store" }));
    setReports(Array.isArray(payload.reports) ? payload.reports : []);
    setBlockedEmails(Array.isArray(payload.blockedEmails) ? payload.blockedEmails : []);
  };

  const loadPortal = async ({ silent = false }: { silent?: boolean } = {}) => {
    setIsLoadingPortal(true);
    if (!silent) {
      setErrorMessage(null);
    }

    const results = await Promise.allSettled([
        loadOverview(),
        loadDoctors(),
        loadAdmins(),
        loadReports(),
    ]);

    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) =>
        result.reason instanceof Error ? result.reason.message : "Erreur inconnue du portail admin."
      );

    if (errors.length > 0) {
      setErrorMessage(Array.from(new Set(errors)).join(" | "));
    } else if (!silent) {
      setErrorMessage(null);
    }

    setIsLoadingPortal(false);
  };

  const loadDoctorDetails = async (doctorId: string, { silent = false }: { silent?: boolean } = {}) => {
    setIsLoadingDoctorDetails(true);
    if (!silent) {
      setErrorMessage(null);
    }

    try {
      const payload = await parseJsonResponse<{ doctor: AdminManagedDoctorDetails }>(
        await fetch(`/api/admin-page/doctors/${doctorId}`, { cache: "no-store" })
      );

      setSelectedDoctor(payload.doctor);
      setDoctorNotes((current) => ({
        ...current,
        [doctorId]: current[doctorId] ?? payload.doctor.verificationNote ?? "",
      }));
    } catch (error) {
      if (!silent) {
        setErrorMessage(
          error instanceof Error ? error.message : "Impossible d'ouvrir le détail de cette demande."
        );
      }
    } finally {
      setIsLoadingDoctorDetails(false);
    }
  };

  useEffect(() => {
    if (!initialUser) {
      return;
    }

    void loadPortal();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser?.id]);

  useEffect(() => {
    if (!sessionUser) {
      return;
    }

    const selectedDoctorId = selectedDoctor?.id ?? null;

    const runAutoRefresh = async () => {
      if (autoRefreshInFlightRef.current) {
        return;
      }

      autoRefreshInFlightRef.current = true;
      try {
        await loadPortal({ silent: true });
        if (selectedDoctorId) {
          await loadDoctorDetails(selectedDoctorId, { silent: true });
        }
      } finally {
        autoRefreshInFlightRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void runAutoRefresh();
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runAutoRefresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser, selectedDoctor?.id]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingLogin(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/admin-page/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginState),
      });

      const payload = await parseJsonResponse<{ ok: boolean; user: SessionUser }>(response);
      setSessionUser(payload.user);
      setSuccessMessage("Connexion admin ouverte avec succès.");
      setLoginState({ username: "", password: "" });
      await loadPortal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Connexion admin impossible.");
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin-page/logout", { method: "POST" });
    setSessionUser(null);
    setOverview(defaultOverview);
    setDoctors([]);
    setAdmins([]);
    setReports([]);
    setBlockedEmails([]);
    setSelectedDoctor(null);
    setErrorMessage(null);
    setSuccessMessage("Session admin fermée.");
  };

  const handleDoctorAction = async (
    doctorId: string,
    action: "approve" | "reject" | "pending"
  ) => {
    setIsUpdatingDoctor(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await parseJsonResponse<{ doctor: AdminManagedDoctor }>(
        await fetch(`/api/admin-page/doctors/${doctorId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: doctorNotes[doctorId] ?? "",
          }),
        })
      );

      setSuccessMessage(
        action === "approve"
          ? "Docteur validé avec succès."
          : action === "reject"
            ? "Docteur refusé. Il pourra renvoyer un dossier plus tard."
            : "Le dossier docteur a été remis en attente."
      );

      await loadPortal();
      await loadDoctorDetails(doctorId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de mettre à jour cette demande."
      );
    } finally {
      setIsUpdatingDoctor(false);
    }
  };

  const handleCreateAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const username = createAdminState.username.trim();
    const password = createAdminState.password;

    if (!username) {
      setErrorMessage("Le username admin est obligatoire.");
      return;
    }

    if (password.trim().length < 8) {
      setErrorMessage("Le mot de passe admin doit contenir au moins 8 caractères.");
      return;
    }

    setIsCreatingAdmin(true);

    try {
      await parseJsonResponse<{ admin: AdminUserPublic }>(
        await fetch("/api/admin-page/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...createAdminState,
            username,
          }),
        })
      );

      setCreateAdminState({
        username: "",
        fullName: "",
        password: "",
        role: "admin",
      });
      setSuccessMessage("Nouvel admin ajouté dans la base indépendante.");
      await Promise.all([loadAdmins(), loadOverview()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Création admin impossible.");
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleReportAction = async (
    report: AdminCommunityReport,
    actionType: AdminModerationActionType
  ) => {
    const askedReason =
      actionType === "false_alert"
        ? "Fausse alerte validée par l'admin"
        : window.prompt(
            `Motif admin pour "${moderationActionLabel(actionType)}"`,
            report.reason || ""
          );

    if (askedReason === null) {
      return;
    }

    setActiveReportActionId(report.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await parseJsonResponse<{ ok: boolean }>(
        await fetch(`/api/admin-page/reports/${report.reportType}/${report.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionType,
            reason: askedReason,
          }),
        })
      );

      setSuccessMessage(`Signalement traité: ${moderationActionLabel(actionType)}.`);
      await Promise.all([loadReports(), loadOverview()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de traiter ce signalement.");
    } finally {
      setActiveReportActionId(null);
    }
  };

  const handleReleaseBlockedEmail = async (blockedEmail: AdminBlockedEmail) => {
    const releaseNote = window.prompt(
      "Note de réouverture de cet email",
      blockedEmail.releaseNote ?? blockedEmail.reason ?? ""
    );

    if (releaseNote === null) {
      return;
    }

    setActiveBlockedEmailId(blockedEmail.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await parseJsonResponse<{ ok: boolean }>(
        await fetch(`/api/admin-page/blocked-emails/${blockedEmail.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ releaseNote }),
        })
      );

      setSuccessMessage("Email réautorisé avec succès.");
      await Promise.all([loadReports(), loadOverview()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de réautoriser cet email.");
    } finally {
      setActiveBlockedEmailId(null);
    }
  };

  const handleBlockEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBlockingEmail(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await parseJsonResponse<{ ok: boolean }>(
        await fetch("/api/admin-page/blocked-emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: blockEmailAddress, reason: blockEmailReason }),
        })
      );

      setSuccessMessage(`L'email ${blockEmailAddress} a été bloqué avec succès.`);
      setBlockEmailAddress("");
      setBlockEmailReason("");
      await Promise.all([loadReports(), loadOverview()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de bloquer cet email.");
    } finally {
      setIsBlockingEmail(false);
    }
  };



  if (!sessionUser) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.32),_transparent_35%),linear-gradient(180deg,_#050b18,_#0c1c39)] px-4 py-10 text-white">
        <ThemeToggle />
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
          <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-[34px] border border-white/10 bg-white/8 p-8 shadow-[0_30px_100px_-45px_rgba(37,99,235,0.95)] backdrop-blur">
              <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-cyan-100">
                Admin Portal
              </div>
              <h1 className="mt-6 text-4xl font-black tracking-tight text-white">
                TERIAQ Control Center
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-200/85">
                Espace indépendant pour valider les docteurs, contrôler les signalements de la communauté,
                gérer les admins et bloquer ou rétablir les emails sensibles sans toucher au dashboard normal.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Vérification docteur</p>
                  <p className="mt-3 text-sm text-slate-100">
                    PDF, images, certificats et pièces de clinique stockés côté admin.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Modération</p>
                  <p className="mt-3 text-sm text-slate-100">
                    Signalements communauté, avertissements, blocages et réouverture d&apos;emails.
                  </p>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
                >
                  <Home className="h-4 w-4" />
                  Retour accueil
                </Link>
              </div>
            </section>

            <section className="rounded-[34px] border border-white/10 bg-slate-950/75 p-8 shadow-[0_30px_100px_-45px_rgba(15,23,42,1)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Connexion sécurisée</p>
                  <h2 className="mt-3 text-2xl font-black text-white">Ouvrir l&apos;admin page</h2>
                </div>
                <div className="rounded-2xl border border-blue-400/30 bg-blue-500/15 p-3 text-blue-100">
                  <Shield className="h-6 w-6" />
                </div>
              </div>

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">Username admin</span>
                  <input
                    value={loginState.username}
                    onChange={(event) => setLoginState((current) => ({ ...current, username: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:bg-white/10"
                    placeholder="mohamed larabi"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">Mot de passe admin</span>
                  <input
                    type="password"
                    value={loginState.password}
                    onChange={(event) => setLoginState((current) => ({ ...current, password: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:bg-white/10"
                    placeholder="Votre mot de passe admin"
                  />
                </label>
                {errorMessage ? (
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {errorMessage}
                  </div>
                ) : null}
                {successMessage ? (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    {successMessage}
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={isSubmittingLogin}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingLogin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  Ouvrir le portail admin
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_30%),linear-gradient(180deg,_#050b18,_#0a1630,_#08101d)] px-4 py-6 text-white sm:px-6">
      <ThemeToggle />
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-5 shadow-[0_30px_100px_-55px_rgba(37,99,235,0.95)] backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-cyan-100">
                Admin page indépendante
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-white">TERIAQ Admin Control</h1>
              <p className="mt-2 text-sm text-slate-300">
                Vérification des docteurs, gestion des signalements, blocage d&apos;emails et création d&apos;admins.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Home className="h-4 w-4" />
                Accueil
              </Link>
              <button
                type="button"
                onClick={() => void loadPortal()}
                disabled={isLoadingPortal}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingPortal ? "animate-spin" : ""}`} />
                Actualiser
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white">
              {initialsFromName(sessionUser.fullName || sessionUser.username)}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{sessionUser.fullName || sessionUser.username}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                {sessionUser.role === "super_admin" ? "Super admin indépendant" : "Admin indépendant"}
              </p>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
            {successMessage}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <OverviewCard
            label="Docteurs total"
            value={overview.totalDoctors}
            icon={UserRound}
            tone="text-sky-200 bg-sky-500/10 border-sky-400/20"
            onClick={() => setStatusFilter("all")}
          />
          <OverviewCard
            label="En attente"
            value={overview.pendingDoctors}
            icon={Clock3}
            tone="text-amber-100 bg-amber-500/10 border-amber-400/20"
            onClick={() => setStatusFilter("pending")}
          />
          <OverviewCard
            label="Validés"
            value={overview.approvedDoctors}
            icon={UserCheck}
            tone="text-emerald-100 bg-emerald-500/10 border-emerald-400/20"
            onClick={() => setStatusFilter("approved")}
          />
          <OverviewCard
            label="Refusés"
            value={overview.rejectedDoctors}
            icon={XCircle}
            tone="text-rose-100 bg-rose-500/10 border-rose-400/20"
            onClick={() => setStatusFilter("rejected")}
          />
          <OverviewCard
            label="Signalements"
            value={overview.openReports}
            icon={ShieldAlert}
            tone="text-orange-100 bg-orange-500/10 border-orange-400/20"
            onClick={() => document.getElementById("reports-section")?.scrollIntoView({ behavior: 'smooth' })}
          />
          <OverviewCard
            label="Emails bloqués"
            value={overview.blockedEmails}
            icon={Ban}
            tone="text-fuchsia-100 bg-fuchsia-500/10 border-fuchsia-400/20"
            onClick={() => document.getElementById("blocked-emails-section")?.scrollIntoView({ behavior: 'smooth' })}
          />
          <OverviewCard
            label="Admins"
            value={overview.totalAdmins}
            icon={Shield}
            tone="text-cyan-100 bg-cyan-500/10 border-cyan-400/20"
            onClick={() => document.getElementById("admins-section")?.scrollIntoView({ behavior: 'smooth' })}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-6">
            <section className="rounded-[30px] border border-white/10 bg-slate-950/72 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Demandes docteurs</p>
                  <h2 className="mt-2 text-2xl font-black text-white">File de validation</h2>
                </div>
                <p className="text-sm text-slate-300">{filteredDoctorCountLabel}</p>
              </div>

              <div className="mt-5 flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/50 focus:bg-white/10"
                    placeholder="Chercher un docteur, spécialité ou adresse"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "all" | AdminDoctorStatus)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50"
                >
                  <option value="pending" className="bg-slate-900">En attente</option>
                  <option value="approved" className="bg-slate-900">Validés</option>
                  <option value="rejected" className="bg-slate-900">Refusés</option>
                  <option value="all" className="bg-slate-900">Tous</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadPortal()}
                  disabled={isLoadingPortal}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Charger
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {displayedDoctors.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/4 p-12 text-center text-slate-400">
                    <Inbox className="mx-auto mb-3 h-8 w-8 opacity-50" />
                    Aucun docteur ne correspond à ces critères.
                  </div>
                ) : null}

                {displayedDoctors.map((doctor) => (
                  <button
                    key={doctor.id}
                    type="button"
                    onClick={() => void loadDoctorDetails(doctor.id)}
                    className="w-full rounded-[28px] border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-blue-400/30 hover:bg-white/8"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        {doctor.avatarUrl ? (
                          <img
                            src={doctor.avatarUrl}
                            alt={doctor.fullName ?? "Docteur"}
                            className="h-14 w-14 rounded-3xl object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-600 text-base font-black text-white">
                            {initialsFromName(doctor.fullName || doctor.specialty || "DR")}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-lg font-black text-white">
                              {doctor.fullName || "Docteur sans nom"}
                            </p>
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${doctorStatusClasses(doctor.verificationStatus)}`}>
                              {doctor.verificationStatus}
                            </span>
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${moderationStatusClasses(doctor.moderationStatus)}`}>
                              {doctor.moderationStatus}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-cyan-200">
                            {doctor.specialty || "Spécialité non renseignée"}
                          </p>
                          <p className="mt-1 line-clamp-1 text-sm text-slate-300">
                            {doctor.address || "Adresse non renseignée"}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-3 lg:min-w-[360px]">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2">
                          <p className="font-bold uppercase tracking-[0.16em] text-slate-500">Dossier</p>
                          <p className="mt-1 text-slate-100">
                            {doctor.documentsCount} fichier(s)
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2">
                          <p className="font-bold uppercase tracking-[0.16em] text-slate-500">Demande</p>
                          <p className="mt-1 text-slate-100">{formatDateTime(doctor.requestedAt)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2">
                          <p className="font-bold uppercase tracking-[0.16em] text-slate-500">Décision</p>
                          <p className="mt-1 text-slate-100">{formatDateTime(doctor.verifiedAt)}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section id="reports-section" className="rounded-[30px] border border-white/10 bg-slate-950/72 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Communauté</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Signalements à traiter</h2>
                </div>
                <p className="text-sm text-slate-300">{reports.length} signalement(s)</p>
              </div>

              <div className="mt-6 space-y-3">
                {reports.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/4 p-8 text-center text-sm text-slate-400">
                    Aucun signalement dans la file admin.
                  </div>
                ) : null}

                {reports.map((report) => (
                  <article key={report.id} className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${reportStatusClasses(report.reportStatus)}`}>
                            {report.reportStatus}
                          </span>
                          <span className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">
                            {report.reportType === "post" ? "Publication" : "Commentaire"}
                          </span>
                        </div>

                        <p className="mt-3 text-sm font-bold text-white">
                          {report.subjectTitle || "Contenu signalé"}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-300">
                          {report.contentPreview || "Aucun aperçu disponible."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
                          <span>Signalé par: {report.reporterName || "Utilisateur inconnu"}</span>
                          <span>Ciblé: {report.targetUserName || "Utilisateur inconnu"}</span>
                          <span>Email: {report.targetUserEmail || "Non disponible"}</span>
                          <span>Date: {formatDateTime(report.createdAt)}</span>
                        </div>
                      </div>

                      {report.reportStatus === "open" ? (
                        <div className="grid gap-2 sm:grid-cols-2 xl:w-[320px]">
                          {(["warning", "temporary_block", "permanent_block", "false_alert"] as AdminModerationActionType[]).map((actionType) => (
                            <button
                              key={actionType}
                              type="button"
                              onClick={() => void handleReportAction(report, actionType)}
                              disabled={activeReportActionId === report.id}
                              className={`inline-flex items-center justify-center rounded-2xl px-3 py-2.5 text-xs font-bold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                actionType === "warning"
                                  ? "bg-amber-600 text-white hover:bg-amber-500"
                                  : actionType === "temporary_block"
                                    ? "bg-orange-600 text-white hover:bg-orange-500"
                                    : actionType === "permanent_block"
                                      ? "bg-rose-600 text-white hover:bg-rose-500"
                                      : "border border-white/10 bg-white/6 text-white hover:bg-white/10"
                              }`}
                            >
                              {activeReportActionId === report.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                moderationActionLabel(actionType)
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-slate-300 xl:w-[280px]">
                          Décision déjà prise le {formatDateTime(report.reviewedAt)}.
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section id="admins-section" className="rounded-[30px] border border-white/10 bg-slate-950/72 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Admins indépendants</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Base admin séparée</h2>
                </div>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-cyan-100">
                  <Shield className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {admins.map((admin) => (
                  <div key={admin.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{admin.fullName || admin.username}</p>
                        <p className="truncate text-xs uppercase tracking-[0.18em] text-slate-400">{admin.username}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-200">
                        {admin.role}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-400">
                      <span>Créé: {formatDateTime(admin.createdAt)}</span>
                      <span>Dernière connexion: {formatDateTime(admin.lastLoginAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-slate-950/72 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Nouvel admin</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Ajouter un admin</h2>
                </div>
                <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3 text-blue-100">
                  <UserPlus className="h-5 w-5" />
                </div>
              </div>

              {hasSuperAdminAccess ? (
                <form onSubmit={handleCreateAdmin} className="mt-5 space-y-4">
                  <input
                    value={createAdminState.fullName}
                    onChange={(event) => setCreateAdminState((current) => ({ ...current, fullName: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/50 focus:bg-white/10"
                    placeholder="Nom complet"
                  />
                  <input
                    value={createAdminState.username}
                    onChange={(event) => setCreateAdminState((current) => ({ ...current, username: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/50 focus:bg-white/10"
                    placeholder="Username admin"
                  />
                  <input
                    type="password"
                    value={createAdminState.password}
                    onChange={(event) => setCreateAdminState((current) => ({ ...current, password: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/50 focus:bg-white/10"
                    placeholder="Mot de passe temporaire"
                  />
                  <select
                    value={createAdminState.role}
                    onChange={(event) =>
                      setCreateAdminState((current) => ({
                        ...current,
                        role: event.target.value === "super_admin" ? "super_admin" : "admin",
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50"
                  >
                    <option value="admin" className="bg-slate-900">Admin</option>
                    <option value="super_admin" className="bg-slate-900">Super admin</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isCreatingAdmin}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Ajouter cet admin
                  </button>
                </form>
              ) : (
                <div className="mt-5 rounded-3xl border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                  Le compte connecté est admin simple. Seul le super admin peut créer d&apos;autres comptes admins.
                </div>
              )}
            </section>

            <section id="blocked-emails-section" className="rounded-[30px] border border-white/10 bg-slate-950/72 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Emails sensibles</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Blacklist / réouverture</h2>
                </div>
                <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3 text-fuchsia-100">
                  <Mail className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {blockedEmails.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/4 p-6 text-center text-sm text-slate-400">
                    Aucun email bloqué pour le moment.
                  </div>
                ) : null}

                {blockedEmails.map((blockedEmail) => (
                  <article key={blockedEmail.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{blockedEmail.email}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {blockedEmail.reason || "Aucun motif saisi"}
                          </p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${blockedEmail.status === "blocked" ? "border-rose-400/30 bg-rose-500/15 text-rose-100" : "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"}`}>
                          {blockedEmail.status}
                        </span>
                      </div>

                      <div className="grid gap-2 text-xs text-slate-400">
                        <span>Bloqué le: {formatDateTime(blockedEmail.blockedAt)}</span>
                        <span>Géré par: {blockedEmail.handledByAdminLabel || "Admin inconnu"}</span>
                        <span>Réouvert le: {formatDateTime(blockedEmail.releasedAt)}</span>
                      </div>

                      {blockedEmail.status === "blocked" ? (
                        <button
                          type="button"
                          onClick={() => void handleReleaseBlockedEmail(blockedEmail)}
                          disabled={activeBlockedEmailId === blockedEmail.id}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {activeBlockedEmailId === blockedEmail.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Réautoriser cet email
                        </button>
                      ) : (
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                          Cet email est déjà réouvert.
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">Bloquer un email manuellement</h3>
                <form onSubmit={handleBlockEmail} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    required
                    value={blockEmailAddress}
                    onChange={(e) => setBlockEmailAddress(e.target.value)}
                    placeholder="Adresse email à bloquer"
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-rose-400/50 focus:bg-white/10"
                  />
                  <input
                    type="text"
                    value={blockEmailReason}
                    onChange={(e) => setBlockEmailReason(e.target.value)}
                    placeholder="Raison (optionnel)"
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-rose-400/50 focus:bg-white/10"
                  />
                  <button
                    type="submit"
                    disabled={isBlockingEmail || !blockEmailAddress}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isBlockingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                    Bloquer
                  </button>
                </form>
              </div>
            </section>
          </div>
        </section>
      </div>

      {(selectedDoctor || isLoadingDoctorDetails) ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[34px] border border-white/10 bg-slate-950 shadow-[0_30px_120px_-45px_rgba(15,23,42,1)]">
            <button
              type="button"
              onClick={() => setSelectedDoctor(null)}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>

            {isLoadingDoctorDetails ? (
              <div className="flex min-h-[360px] items-center justify-center">
                <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-200">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Chargement du dossier docteur...
                </div>
              </div>
            ) : selectedDoctor ? (
              <div className="max-h-[92vh] overflow-y-auto">
                <div className="border-b border-white/10 bg-[linear-gradient(180deg,_rgba(37,99,235,0.95),_rgba(15,23,42,0.95))] px-6 py-6">
                  <div className="flex flex-col gap-4 pr-12 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      {selectedDoctor.avatarUrl ? (
                        <img
                          src={selectedDoctor.avatarUrl}
                          alt={selectedDoctor.fullName ?? "Docteur"}
                          className="h-20 w-20 rounded-[28px] object-cover ring-2 ring-white/20"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/15 text-2xl font-black text-white ring-2 ring-white/20">
                          {initialsFromName(selectedDoctor.fullName || selectedDoctor.specialty || "DR")}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-100/80">Dossier de validation</p>
                        <h3 className="mt-2 text-2xl font-black text-white">
                          {selectedDoctor.fullName || "Docteur sans nom"}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-blue-100">
                          {selectedDoctor.specialty || "Spécialité non renseignée"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${doctorStatusClasses(selectedDoctor.verificationStatus)}`}>
                            {selectedDoctor.verificationStatus}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${moderationStatusClasses(selectedDoctor.moderationStatus)}`}>
                            {selectedDoctor.moderationStatus}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                            {selectedDoctor.documentsCount} fichier(s)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-slate-200">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Décision admin</p>
                      <p className="mt-2">{selectedDoctor.verifiedByAdmin || "Aucune décision encore"}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(selectedDoctor.verifiedAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 px-6 py-6">
                  <section className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Email</p>
                      <p className="mt-2 text-sm text-white">{selectedDoctor.email || "Email indisponible"}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Adresse</p>
                      <p className="mt-2 text-sm text-white">{selectedDoctor.address || "Adresse non renseignée"}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Demande reçue</p>
                      <p className="mt-2 text-sm text-white">{formatDateTime(selectedDoctor.requestedAt)}</p>
                    </div>
                  </section>

                  <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-6">
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Message du docteur</p>
                        <p className="mt-3 text-sm leading-7 text-slate-200">
                          {selectedDoctor.requestMessage || "Aucun message ajouté avec la demande."}
                        </p>
                      </div>

                      {selectedDoctor.bio ? (
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Bio déclarée</p>
                          <p className="mt-3 text-sm leading-7 text-slate-200">
                            {selectedDoctor.bio}
                          </p>
                        </div>
                      ) : null}

                      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Documents admin</p>
                            <p className="mt-2 text-sm text-slate-300">
                              Les PDF et images restent stockés côté admin.
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3 text-slate-200">
                            <FileText className="h-5 w-5" />
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          {selectedDoctor.files.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/35 p-6 text-sm text-slate-400">
                              Aucun fichier joint pour le moment.
                            </div>
                          ) : null}

                          {selectedDoctor.files.map((file) => {
                            const isImage = file.mimeType.startsWith("image/");

                            return (
                              <div key={file.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/35">
                                {isImage && file.url ? (
                                  <img
                                    src={file.url}
                                    alt={file.fileName}
                                    className="h-48 w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-48 items-center justify-center bg-[linear-gradient(180deg,_rgba(37,99,235,0.24),_rgba(15,23,42,0.95))] text-center text-sm font-bold text-white">
                                    <div className="space-y-2 px-4">
                                      <FileText className="mx-auto h-8 w-8" />
                                      <p>{file.fileName}</p>
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-3 p-4">
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                      {documentTypeLabel(file.documentType)}
                                    </p>
                                    <p className="mt-2 text-sm font-semibold text-white">{file.fileName}</p>
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    <p>{formatFileSize(file.fileSizeBytes)}</p>
                                    <p>{formatDateTime(file.uploadedAt)}</p>
                                  </div>
                                  {file.url ? (
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                      Ouvrir le fichier
                                    </a>
                                  ) : (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-400">
                                      Lien temporaire indisponible.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Note admin</p>
                        <textarea
                          value={selectedDoctorNote}
                          onChange={(event) =>
                            setDoctorNotes((current) => ({
                              ...current,
                              [selectedDoctor.id]: event.target.value,
                            }))
                          }
                          rows={6}
                          className="mt-3 w-full rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/50 focus:bg-slate-950/60"
                          placeholder="Ajoutez une note interne avant la décision..."
                        />
                      </div>

                      {selectedDoctor.verificationStatus === "pending" ? (
                        <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-5">
                          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Décision</p>
                          <button
                            type="button"
                            onClick={() => void handleDoctorAction(selectedDoctor.id, "approve")}
                            disabled={isUpdatingDoctor}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUpdatingDoctor ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Valider ce docteur
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDoctorAction(selectedDoctor.id, "reject")}
                            disabled={isUpdatingDoctor}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUpdatingDoctor ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            Refuser cette demande
                          </button>
                          <p className="text-xs leading-6 text-slate-400">
                            Après refus, le docteur pourra renvoyer un nouveau dossier corrigé.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-200">
                            {selectedDoctor.verificationStatus === "approved" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-rose-300" />
                            )}
                            Dossier finalisé
                          </div>
                          <p className="mt-4 text-sm leading-7 text-slate-300">
                            Cette demande est clôturée. Les boutons d&apos;acceptation/refus sont masqués.
                            Si le docteur a été refusé, il peut soumettre un nouveau dossier de vérification plus tard.
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleDoctorAction(selectedDoctor.id, "pending")}
                            disabled={isUpdatingDoctor}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/12 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUpdatingDoctor ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            {selectedDoctor.verificationStatus === "approved"
                              ? "Retirer la validation et remettre en attente"
                              : "Rouvrir la demande en attente"}
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
