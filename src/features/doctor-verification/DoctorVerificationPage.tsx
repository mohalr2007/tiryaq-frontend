"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  FileText,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Upload,
  Clock,
  ArrowRight,
  Info
} from "lucide-react";
import { getStableAuthUser, supabase } from "@/utils/supabase/client";
import { normalizeDoctorVerificationStatus } from "@/utils/governance";
import { fetchDirectBackend } from "@/utils/directBackend";

type VerificationStatePayload = {
  profile: {
    id: string;
    account_type: "doctor" | "patient" | null;
    full_name: string | null;
    specialty: string | null;
    doctor_verification_status: string | null;
    is_doctor_verified: boolean | null;
    doctor_verification_note: string | null;
    doctor_verification_requested_at: string | null;
    moderation_status: string | null;
    moderation_reason: string | null;
  };
  verification: {
    requestMessage: string | null;
    requestedAt: string | null;
    verificationStatus: "pending" | "approved" | "rejected";
    verificationNote: string | null;
    verifiedAt: string | null;
    verifiedByAdmin: string | null;
  } | null;
  files: Array<{
    id: string;
    documentType: "clinic_document" | "medical_certificate" | "other";
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    uploadedAt: string;
    url: string | null;
  }>;
};

function formatDateTime(value: string | null | undefined) {
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

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DoctorVerificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [state, setState] = useState<VerificationStatePayload | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [clinicDocuments, setClinicDocuments] = useState<File[]>([]);
  const [medicalCertificates, setMedicalCertificates] = useState<File[]>([]);
  const [otherDocuments, setOtherDocuments] = useState<File[]>([]);

  const clinicInputRef = useRef<HTMLInputElement | null>(null);
  const medicalInputRef = useRef<HTMLInputElement | null>(null);
  const otherInputRef = useRef<HTMLInputElement | null>(null);

  const verificationStatus = useMemo(
    () =>
      normalizeDoctorVerificationStatus(
        state?.profile.doctor_verification_status ?? state?.verification?.verificationStatus
      ),
    [state]
  );

  const canSubmitRequest = useMemo(() => {
    if (!state) {
      return false;
    }

    if (verificationStatus === "approved") {
      return false;
    }

    if (
      verificationStatus === "pending" &&
      state.verification?.requestedAt &&
      (state.files?.length ?? 0) > 0
    ) {
      return false;
    }

    return true;
  }, [state, verificationStatus]);

  const loadState = async () => {
    setLoading(true);
    setErrorMessage(null);
    let authenticatedUserId: string | null = null;

    try {
      const { user, error } = await getStableAuthUser();
      if (error || !user) {
        router.replace("/login");
        return;
      }
      authenticatedUserId = user.id;

      const response = await fetchDirectBackend(
        "/api/doctor-verification/status",
        {
          cache: "no-store",
        },
        {
          auth: true,
          fallbackPath: "/api/doctor-verification/status",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | (VerificationStatePayload & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Impossible de charger votre dossier de vérification.");
      }

      if (payload.profile.account_type !== "doctor") {
        router.replace("/patient-dashboard");
        return;
      }

      if (
        payload.profile.moderation_status === "permanently_blocked" ||
        payload.profile.moderation_status === "temporarily_blocked"
      ) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      setState(payload);
      setRequestMessage(payload.verification?.requestMessage ?? "");
    } catch (error) {
      const { data: fallbackProfile } =
        authenticatedUserId == null
          ? { data: null as VerificationStatePayload["profile"] | null }
          : await supabase
              .from("profiles")
              .select(
                "id, account_type, full_name, specialty, doctor_verification_status, is_doctor_verified, doctor_verification_note, doctor_verification_requested_at, moderation_status, moderation_reason",
              )
              .eq("id", authenticatedUserId)
              .single();

      if (fallbackProfile?.account_type === "doctor") {
        setState({
          profile: {
            id: fallbackProfile.id,
            account_type: fallbackProfile.account_type,
            full_name: fallbackProfile.full_name ?? null,
            specialty: fallbackProfile.specialty ?? null,
            doctor_verification_status: fallbackProfile.doctor_verification_status ?? null,
            is_doctor_verified: fallbackProfile.is_doctor_verified ?? null,
            doctor_verification_note: fallbackProfile.doctor_verification_note ?? null,
            doctor_verification_requested_at: fallbackProfile.doctor_verification_requested_at ?? null,
            moderation_status: fallbackProfile.moderation_status ?? null,
            moderation_reason: fallbackProfile.moderation_reason ?? null,
          },
          verification: null,
          files: [],
        });
      }

      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de charger la page de vérification."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilesChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<File[]>>
  ) => {
    const nextFiles = Array.from(event.target.files ?? []);
    setter(nextFiles);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmitRequest) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.set("requestMessage", requestMessage);
      clinicDocuments.forEach((file) => formData.append("clinicDocuments", file));
      medicalCertificates.forEach((file) => formData.append("medicalCertificates", file));
      otherDocuments.forEach((file) => formData.append("otherDocuments", file));

      const response = await fetchDirectBackend(
        "/api/doctor-verification/request",
        {
          method: "POST",
          body: formData,
        },
        {
          auth: true,
          fallbackPath: "/api/doctor-verification/request",
        },
      );

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Impossible d'envoyer votre dossier.");
      }

      setSuccessMessage("Votre demande de validation a bien été envoyée à l'admin.");
      setClinicDocuments([]);
      setMedicalCertificates([]);
      setOtherDocuments([]);
      if (clinicInputRef.current) clinicInputRef.current.value = "";
      if (medicalInputRef.current) medicalInputRef.current.value = "";
      if (otherInputRef.current) otherInputRef.current.value = "";
      await loadState();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible d'envoyer la demande de validation."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-[#030712] flex items-center justify-center">
        <div className="flex items-center gap-4 rounded-3xl border border-white/20 bg-white/40 dark:bg-white/5 px-8 py-6 shadow-2xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Chargement du statut de vérification...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-white px-4 py-12 text-slate-900 dark:from-slate-900 dark:via-[#081528] dark:to-[#030712] dark:text-white font-sans selection:bg-blue-500/30">
      {/* Premium Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] h-[50%] w-[50%] rounded-full bg-blue-400/20 blur-[120px] dark:bg-blue-600/10" />
        <div className="absolute top-[20%] -right-[10%] h-[50%] w-[50%] rounded-full bg-cyan-400/20 blur-[120px] dark:bg-cyan-600/10" />
      </div>

      <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
        {/* Header Section */}
        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/60 p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/10 opacity-50 dark:from-white/5 dark:to-transparent" />
          
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/50 px-3 py-1 mb-4 dark:border-blue-500/20 dark:bg-blue-500/10">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">
                  Validation praticien
                </p>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
                Vérification <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Médicale</span>
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                Afin de garantir la sécurité des patients, TERIAQ certifie les profils médecins. 
                Envoyez vos justificatifs pour débloquer le statut <strong>Médecin Vérifié</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {verificationStatus === "approved" ? (
                <Link
                  href="/doctor-dashboard"
                  className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-500 hover:shadow-blue-500/25 focus:ring-4 focus:ring-blue-500/20 active:scale-95"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] transition-transform duration-700 group-hover:translate-x-[100%]" />
                  <BadgeCheck className="h-5 w-5" />
                  Ouvrir mon dashboard
                </Link>
              ) : (
                <Link
                  href="/doctor-dashboard"
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/60 bg-white/50 px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-md transition-all hover:border-slate-300 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 active:scale-95"
                >
                  <Clock className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
                  Passer pour plus tard
                  <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 dark:group-hover:text-slate-200" />
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Messaging */}
        {errorMessage ? (
          <div className="animate-in slide-in-from-top-2 rounded-2xl border border-rose-200/60 bg-rose-50/80 px-6 py-4 text-sm font-medium text-rose-800 shadow-sm backdrop-blur-md dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="animate-in slide-in-from-top-2 rounded-2xl border border-emerald-200/60 bg-emerald-50/80 px-6 py-4 text-sm font-medium text-emerald-800 shadow-sm backdrop-blur-md dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            {successMessage}
          </div>
        ) : null}

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            
            {/* Status Article */}
            <article className="relative overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/60 p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.05)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Statut du profil
                  </p>
                  <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
                    {state?.profile.full_name || "Docteur"}{state?.profile.specialty ? ` · ${state.profile.specialty}` : ""}
                  </h2>
                </div>
                <span
                  className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-widest backdrop-blur-md ${
                    verificationStatus === "approved"
                      ? "bg-emerald-500/15 text-emerald-700 border border-emerald-200/50 dark:border-emerald-500/20 dark:text-emerald-300"
                      : verificationStatus === "rejected"
                      ? "bg-rose-500/15 text-rose-700 border border-rose-200/50 dark:border-rose-500/20 dark:text-rose-300"
                      : "bg-amber-500/15 text-amber-700 border border-amber-200/50 dark:border-amber-500/20 dark:text-amber-300"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${verificationStatus === 'approved' ? 'bg-emerald-500' : verificationStatus === 'rejected' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'}`}></span>
                  {verificationStatus}
                </span>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200/60 bg-white/50 p-5 backdrop-blur-sm dark:border-white/5 dark:bg-white/5">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Demande envoyée
                  </p>
                  <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                    {formatDateTime(state?.verification?.requestedAt ?? state?.profile.doctor_verification_requested_at)}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200/60 bg-white/50 p-5 backdrop-blur-sm dark:border-white/5 dark:bg-white/5">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Dernière décision
                  </p>
                  <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                    {formatDateTime(state?.verification?.verifiedAt)}
                  </p>
                  {state?.verification?.verifiedByAdmin ? (
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      par l&apos;admin
                    </p>
                  ) : null}
                </div>
              </div>

              {state?.verification?.verificationNote || state?.profile.doctor_verification_note ? (
                <div className="mt-6 rounded-3xl border border-blue-200/60 bg-blue-50/50 p-6 text-sm leading-relaxed text-slate-700 backdrop-blur-sm dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-slate-200">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">
                    <Info className="h-4 w-4" />
                    Note de l&apos;administrateur
                  </p>
                  <p className="mt-3 text-base">
                    {state?.verification?.verificationNote ?? state?.profile.doctor_verification_note}
                  </p>
                </div>
              ) : null}
            </article>

            {/* Upload Article */}
            <article className="relative overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/60 p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.05)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-blue-600/10 p-3.5 text-blue-600 dark:bg-cyan-500/10 dark:text-cyan-300">
                  {verificationStatus === "approved" ? (
                    <ShieldCheck className="h-7 w-7" />
                  ) : (
                    <ShieldAlert className="h-7 w-7" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">
                    {verificationStatus === "approved"
                      ? "Accès docteur validé"
                      : verificationStatus === "rejected"
                      ? "Dossier à corriger"
                      : "Soumettre votre dossier"}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300 max-w-lg">
                    {verificationStatus === "approved"
                      ? "Vous êtes maintenant autorisé à utiliser l’espace docteur complet de Teriaq."
                      : verificationStatus === "rejected"
                      ? "L’admin a refusé le précédent dossier. Vous pouvez renvoyer un nouveau dossier avec des pièces corrigées."
                      : state?.verification?.requestedAt && (state?.files?.length ?? 0) > 0
                      ? "Votre dossier est en attente de revue. Les envois sont gelés jusqu’à la décision de l'administration."
                      : state?.verification?.requestedAt
                      ? "Une demande existe déjà mais aucun fichier actif n'est enregistré côté admin. Vous pouvez renvoyer un dossier complet."
                      : "Ajoutez vos justificatifs puis envoyez la demande. Au moins un papier de clinique et un certificat médical sont obligatoires."}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                    Message à l’administrateur (optionnel)
                  </span>
                  <textarea
                    value={requestMessage}
                    onChange={(event) => setRequestMessage(event.target.value)}
                    disabled={!canSubmitRequest}
                    rows={3}
                    className="w-full rounded-[1.5rem] border border-slate-200/80 bg-white/50 px-5 py-4 text-sm text-slate-800 outline-none backdrop-blur-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-blue-400 dark:focus:bg-white/10"
                    placeholder="Précisez tout détail utile pour faciliter votre validation..."
                  />
                </label>

                <div className="grid gap-5 md:grid-cols-2">
                  {/* Documents Section */}
                  <label className="group relative block overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/50 p-5 backdrop-blur-sm transition-all hover:border-blue-300 hover:bg-blue-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Papiers de la clinique
                    </span>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      PDF, PNG ou JPG. Obligatoire.
                    </p>
                    <input
                      ref={clinicInputRef}
                      type="file"
                      multiple
                      accept=".pdf,image/png,image/jpeg,image/webp"
                      onChange={(event) => handleFilesChange(event, setClinicDocuments)}
                      disabled={!canSubmitRequest}
                      className="mt-4 block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-bold file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 file:dark:bg-blue-500/20 file:dark:text-blue-300 hover:file:dark:bg-blue-500/30 transition-all cursor-pointer"
                    />
                    {clinicDocuments.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {clinicDocuments.map((file) => (
                          <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-900/80 dark:text-slate-300">
                            <FileText className="h-3 w-3 text-blue-500" />
                            <span className="truncate">{file.name}</span>
                            <span className="ml-auto text-slate-400">{formatFileSize(file.size)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </label>

                  <label className="group relative block overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/50 p-5 backdrop-blur-sm transition-all hover:border-blue-300 hover:bg-blue-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Certificat médical
                    </span>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      PDF, PNG ou JPG. Obligatoire.
                    </p>
                    <input
                      ref={medicalInputRef}
                      type="file"
                      multiple
                      accept=".pdf,image/png,image/jpeg,image/webp"
                      onChange={(event) => handleFilesChange(event, setMedicalCertificates)}
                      disabled={!canSubmitRequest}
                      className="mt-4 block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-bold file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 file:dark:bg-blue-500/20 file:dark:text-blue-300 hover:file:dark:bg-blue-500/30 transition-all cursor-pointer"
                    />
                    {medicalCertificates.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {medicalCertificates.map((file) => (
                          <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-900/80 dark:text-slate-300">
                            <FileText className="h-3 w-3 text-blue-500" />
                            <span className="truncate">{file.name}</span>
                            <span className="ml-auto text-slate-400">{formatFileSize(file.size)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </label>
                </div>

                <label className="group relative block overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/50 p-5 backdrop-blur-sm transition-all hover:border-blue-300 hover:bg-blue-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Autres documents
                  </span>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Photos, diplômes supplémentaires... Optionnel.
                  </p>
                  <input
                    ref={otherInputRef}
                    type="file"
                    multiple
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={(event) => handleFilesChange(event, setOtherDocuments)}
                    disabled={!canSubmitRequest}
                    className="mt-4 block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-xs file:font-bold file:text-slate-700 hover:file:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 file:dark:bg-white/10 file:dark:text-slate-300 hover:file:dark:bg-white/20 transition-all cursor-pointer"
                  />
                  {otherDocuments.length > 0 && (
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {otherDocuments.map((file) => (
                        <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-900/80 dark:text-slate-300">
                          <FileText className="h-3 w-3 text-slate-500" />
                          <span className="truncate">{file.name}</span>
                          <span className="ml-auto text-slate-400">{formatFileSize(file.size)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </label>

                <button
                  type="submit"
                  disabled={submitting || !canSubmitRequest}
                  className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-blue-600 px-6 py-4 text-sm font-bold text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/30 focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none active:scale-[0.98]"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] transition-transform duration-700 group-hover:translate-x-[100%]" />
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 transition-transform group-hover:-translate-y-1" />}
                  {verificationStatus === "rejected" ? "Renvoyer la demande" : "Transmettre le dossier"}
                </button>
              </form>
            </article>
          </div>

          <aside className="space-y-8">
            <article className="relative overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/60 p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.05)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <FileText className="h-4 w-4" />
                Fichiers transmis
              </p>
              <div className="mt-6 space-y-4">
                {(state?.files ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300/80 bg-slate-50/50 px-6 py-10 text-center dark:border-white/10 dark:bg-white/5">
                    <FileText className="h-8 w-8 text-slate-300 mb-3 dark:text-slate-600" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      Aucun document enregistré.
                    </p>
                  </div>
                ) : (
                  state?.files.map((file) => (
                    <div key={file.id} className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white/80 p-4 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-500/10 dark:text-cyan-400">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-cyan-300 transition-colors">
                            {file.fileName}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-white/10">
                              {file.documentType}
                            </span>
                            <span>{formatFileSize(file.fileSizeBytes)}</span>
                          </div>
                          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                            Envoyé le {formatDateTime(file.uploadedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="relative overflow-hidden rounded-[2.5rem] border border-blue-100 bg-blue-50/50 p-8 shadow-sm backdrop-blur-xl dark:border-blue-900/30 dark:bg-blue-950/20">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400">
                <ShieldCheck className="h-4 w-4" />
                Règles de conformité
              </p>
              <ul className="mt-5 space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 text-xs font-bold">1</span>
                  <span>Vous pouvez utiliser le dashboard sans vérification, mais certaines fonctionnalités clés resteront verrouillées.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 text-xs font-bold">2</span>
                  <span>Les données médicales sont isolées sur des serveurs sécurisés inaccessibles au grand public.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 text-xs font-bold">3</span>
                  <span>En cas de refus, les documents peuvent être remplacés pour une nouvelle évaluation.</span>
                </li>
              </ul>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}
