"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle, History, Loader2, MapPin, MessageSquare,
  Send, Sparkles, Star, Trash2, User, Plus, Settings, FileText, Paperclip, Home, Menu,
  Move, RotateCcw, ZoomIn, ZoomOut, CheckCircle, Navigation, X, Users
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useLunaChat } from "./useLunaChat";
import DoctorDetailsModal from "./DoctorDetailsModal";
import DoctorPublicLinks from "@/components/DoctorPublicLinks";
import type { RecommendedDoctor } from "./types";
import { hasDirectBackendOrigin } from "@/utils/directBackend";

import { clearExpiredVacationFlag, isDoctorOnVacation } from "@/utils/doctorAvailability";

const MOFID_LOGO_SRC = "/images/mofid.jpg";

function MofidLogo({
  className = "",
  imageClassName = "",
}: {
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div className={`overflow-hidden bg-white shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-700/70 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MOFID_LOGO_SRC}
        alt="MOFID"
        className={`h-full w-full object-cover ${imageClassName}`}
      />
    </div>
  );
}

function buildMessageKey(
  msg: { role: string; content: string; timestamp?: number; attachments?: Array<{ name: string }> },
  index: number
) {
  const attachmentKey = msg.attachments?.map((attachment) => attachment.name).join("|") ?? "no-attachments";
  return `${msg.role}-${msg.timestamp ?? "no-time"}-${msg.content.slice(0, 24)}-${attachmentKey}-${index}`;
}

function buildSessionKey(
  session: { id?: string | null; title?: string | null; updated_at?: string | null },
  index: number
) {
  const base =
    session.id?.trim() ||
    session.title?.trim() ||
    session.updated_at?.trim() ||
    `session-${index}`;
  return `${base}-${index}`;
}

function buildDoctorKey(doctor: RecommendedDoctor, index: number) {
  const base =
    doctor.id?.trim() ||
    doctor.full_name?.trim() ||
    doctor.address?.trim() ||
    `doctor-${index}`;
  return `${base}-${index}`;
}

type PendingAttachment = {
  id: string;
  file: File;
  kind: "image" | "pdf";
  previewUrl: string | null;
};

const MAX_AI_IMAGE_FILE_BYTES = 8 * 1024 * 1024;
const MAX_AI_PROXY_SAFE_IMAGE_FILE_BYTES = 4 * 1024 * 1024;
const MAX_AI_PDF_FILE_BYTES = 5 * 1024 * 1024;
const MAX_AI_PROXY_SAFE_PDF_FILE_BYTES = 2 * 1024 * 1024;



// ── Inline markdown renderer ────────────────────────────────
function MsgContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <span key={`line-${li}`}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((seg, si) =>
            seg.startsWith("**") && seg.endsWith("**") && seg.length > 4
              ? <strong key={`${li}-b-${si}`} className="font-bold text-slate-900 dark:text-white">{seg.slice(2, -2)}</strong>
              : <span key={`${li}-s-${si}`}>{seg}</span>
          )}
          {li < lines.length - 1 && <br key={`br-${li}`} />}
        </span>
      ))}
    </>
  );
}

function getMessageDirection(text: string) {
  return /[\u0600-\u06FF]/.test(text) ? "rtl" : "ltr";
}

function tr(language: string, fr: string, en: string, ar: string) {
  if (language === "ar") return ar;
  if (language === "en") return en;
  return fr;
}

function getPreferredName(fullName: string | null | undefined) {
  const normalized = fullName?.trim().replace(/\s+/g, " ") ?? "";
  if (!normalized) {
    return null;
  }

  return normalized.split(" ")[0] ?? normalized;
}

function getAvatarInitials(fullName: string | null | undefined, fallback = "MO") {
  const normalized = fullName?.trim().replace(/\s+/g, " ") ?? "";
  if (!normalized) {
    return fallback;
  }

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function isFemaleGender(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "femme" || normalized === "female" || normalized === "أنثى";
}

function formatGreetingName(
  language: string,
  fullName: string | null | undefined,
  userRole: "patient" | "doctor" | null,
  userGender: string | null | undefined
) {
  const firstName = getPreferredName(fullName);
  if (!firstName) {
    return null;
  }

  if (userRole !== "doctor") {
    return firstName;
  }

  if (language === "ar") {
    return `${isFemaleGender(userGender) ? "دكتورة" : "دكتور"} ${firstName}`;
  }

  if (language === "en") {
    return `Doctor ${firstName}`;
  }

  return `${isFemaleGender(userGender) ? "Docteure" : "Docteur"} ${firstName}`;
}

function getTimeBasedGreeting(
  language: string,
  fullName: string | null | undefined,
  userRole: "patient" | "doctor" | null,
  userGender: string | null | undefined
) {
  const displayName = formatGreetingName(language, fullName, userRole, userGender);
  const hour = new Date().getHours();
  const isMorning = hour < 12;

  if (language === "ar") {
    return isMorning
      ? `صباح الخير${displayName ? ` ${displayName}` : ""}`
      : `مساء الخير${displayName ? ` ${displayName}` : ""}`;
  }

  if (language === "en") {
    return isMorning
      ? `Good morning${displayName ? `, ${displayName}` : ""}.`
      : `Good afternoon${displayName ? `, ${displayName}` : ""}.`;
  }

  return isMorning
    ? `Bonjour${displayName ? ` ${displayName}` : ""}.`
    : `Bon après-midi${displayName ? ` ${displayName}` : ""}.`;
}

function AssistantHero({
  language,
  userRole,
  userName,
  userGender,
  location,
  locationBlocked,
  locationStatus,
  discussionDoctorsCount,
  onRequestLocation,
  onShowDoctors,
  onResetChat,
  onShowHistory,
}: {
  language: string;
  userRole: "patient" | "doctor" | null;
  userName: string | null;
  userGender: string | null;
  location: { lat: number; lng: number } | null;
  locationBlocked: boolean;
  locationStatus: string;
  discussionDoctorsCount: number;
  onRequestLocation: () => void;
  onShowDoctors: () => void;
  onResetChat: () => void;
  onShowHistory: () => void;
}) {
  const isDoctor = userRole === "doctor";
  const eyebrow = tr(
    language,
    isDoctor ? "MOFID assistant médical TERIAQ" : "MOFID assistant médical TERIAQ",
    isDoctor ? "MOFID medical assistant" : "MOFID medical assistant",
    "موفيد المساعد الطبي لترياق"
  );
  const greeting = getTimeBasedGreeting(language, userName, userRole, userGender);
  const headline = isDoctor
    ? tr(
        language,
        "Analyse de cas, synthèse clinique et préparation de notes professionnelles.",
        "Case review, clinical synthesis, and polished medical notes.",
        "تحليل الحالات، تلخيص المعلومات السريرية، وتجهيز ملاحظات مهنية."
      )
    : tr(
        language,
        "Orientation médicale et recherche de praticiens adaptés.",
        "Medical guidance and practitioner discovery.",
        "توجيه طبي واقتراح أطباء مناسبين."
      );
  const description = isDoctor
    ? tr(
        language,
        "Décrivez un cas, joignez des images ou des PDF et laissez l'assistant structurer vos idées sans casser votre rythme de consultation.",
        "Describe a case, attach images or PDFs, and let the assistant structure your thinking without slowing your consultation flow.",
        "صف الحالة، وأرفق الصور أو ملفات PDF، ودع المساعد يرتب أفكارك من دون تعطيل سير الاستشارة."
      )
    : tr(
        language,
        "Décrivez vos symptômes, ajoutez des documents médicaux et utilisez votre position uniquement si vous souhaitez des médecins proches.",
        "Describe your symptoms, attach medical documents, and use your location only when you want nearby doctors.",
        "اشرح الأعراض، وأرفق الوثائق الطبية، واستعمل موقعك فقط إذا أردت أطباء قريبين منك."
      );
  const featurePills = isDoctor
    ? [
        tr(language, "Jusqu'à 5 images + PDF", "Up to 5 images + PDFs", "حتى 5 صور وملفات PDF"),
        tr(language, "Réponses dans la langue du message", "Replies in your message language", "الرد بلغة رسالتك"),
        tr(language, "Pensé pour la consultation", "Built for consultation flow", "مصمم لسير الاستشارة"),
      ]
    : [
        tr(language, "Jusqu'à 5 images + PDF", "Up to 5 images + PDFs", "حتى 5 صور وملفات PDF"),
        tr(language, "Médecins proches jusqu'à 100 km", "Nearby doctors up to 100 km", "أطباء قريبون حتى 100 كم"),
        tr(language, "Suggestions selon la spécialité", "Suggestions by specialty", "اقتراحات حسب التخصص"),
      ];
  const locationCtaLabel = location
    ? tr(language, "Mettre à jour ma position", "Update my location", "تحديث موقعي")
    : locationBlocked
      ? tr(language, "Activer la localisation", "Enable location", "تفعيل الموقع")
      : tr(language, "Utiliser ma localisation", "Use my location", "استخدام موقعي");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="relative overflow-hidden rounded-[30px] border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(241,245,249,0.92))] p-4 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.5)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_30%),linear-gradient(135deg,rgba(9,12,25,0.98),rgba(15,23,42,0.95))] sm:rounded-[36px] sm:p-6 md:p-10">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.28),transparent_62%)] dark:bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.16),transparent_62%)] lg:block" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/75 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-blue-700 backdrop-blur dark:border-blue-500/20 dark:bg-slate-900/75 dark:text-blue-200">
              <Sparkles size={12} />
              {eyebrow}
            </div>
            <h2 className="mt-5 font-serif text-[2rem] leading-[0.98] tracking-tight text-slate-950 dark:text-white sm:mt-6 sm:text-5xl lg:text-6xl">
              {greeting}
            </h2>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-800 dark:text-slate-100 sm:text-lg sm:leading-8">
              {headline}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-300 sm:leading-7">
              {description}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {featurePills.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="flex w-full max-w-md flex-col gap-3">
            {isDoctor ? (
              <>
                <button
                  type="button"
                  onClick={onResetChat}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[22px] bg-slate-950 px-5 py-4 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <Plus size={16} />
                  {tr(language, "Nouvelle consultation", "New consultation", "استشارة جديدة")}
                </button>
                <button
                  type="button"
                  onClick={onShowHistory}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[22px] border border-slate-200 bg-white/80 px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <History size={16} />
                  {tr(language, "Ouvrir l'historique", "Open history", "فتح السجل")}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onRequestLocation}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[22px] bg-slate-950 px-5 py-4 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <MapPin size={16} />
                  {locationCtaLabel}
                </button>
                <button
                  type="button"
                  onClick={onShowDoctors}
                  disabled={discussionDoctorsCount === 0}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[22px] border border-slate-200 bg-white/80 px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Users size={16} />
                  {discussionDoctorsCount > 0
                    ? tr(
                        language,
                        `${discussionDoctorsCount} médecin(s) proposés`,
                        `${discussionDoctorsCount} suggested doctor(s)`,
                        `${discussionDoctorsCount} طبيب/أطباء مقترحين`
                      )
                    : tr(language, "Les suggestions apparaîtront ici", "Suggestions will appear here", "ستظهر الاقتراحات هنا")}
                </button>
                <p className="px-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
                  {location
                    ? tr(
                        language,
                        "Votre position reste privée et sert uniquement à affiner les médecins proches.",
                        "Your position stays private and is only used to refine nearby doctors.",
                        "يبقى موقعك خاصاً ويُستخدم فقط لتحسين اقتراح الأطباء القريبين."
                      )
                    : locationStatus}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DoctorCard({
  doctor, index, onView
}: { 
  doctor: RecommendedDoctor; 
  index: number; 
  onView: (d: RecommendedDoctor) => void;
}) {
  const { t, language } = useI18n();
  const normalizedDoctor = clearExpiredVacationFlag(doctor);
  const avgRating = normalizedDoctor.rating ?? 0;
  const totalReviews = normalizedDoctor.reviews ?? 0;
  const unavailable = !normalizedDoctor.is_accepting_appointments || isDoctorOnVacation(normalizedDoctor);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.5 }}
      className={`group relative overflow-hidden rounded-[30px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-35px_rgba(59,130,246,0.35)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] dark:hover:shadow-blue-500/10 ${unavailable ? "opacity-80" : ""}`}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-blue-500/10 via-sky-400/5 to-emerald-400/10 dark:from-blue-500/12 dark:via-transparent dark:to-emerald-400/10" />
      <div className="relative">
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="relative shrink-0">
              {normalizedDoctor.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={normalizedDoctor.avatar_url}
                  alt={normalizedDoctor.full_name || "Doctor"}
                  className="h-20 w-20 rounded-[24px] object-cover border border-white/80 shadow-md dark:border-slate-700"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/70 bg-white/80 text-2xl font-black text-blue-600 shadow-md dark:border-slate-700 dark:bg-slate-900/80 dark:text-blue-300">
                  {(normalizedDoctor.full_name ?? "DR").substring(0, 2).toUpperCase()}
                </div>
              )}
              {!unavailable ? (
                <div className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-sm dark:border-slate-950">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              ) : null}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-black text-slate-950 dark:text-white">
                  Dr. {normalizedDoctor.full_name}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                  <CheckCircle size={10} />
                  {t("ai.assistant.verified")}
                </span>
              </div>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                {normalizedDoctor.specialty || t("common.doctor")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
            <Star size={13} className="fill-current text-amber-500" />
            {avgRating > 0 ? avgRating.toFixed(1) : t("ai.assistant.new")}
            <span className="text-slate-400">({totalReviews})</span>
          </span>
          {normalizedDoctor.distanceKm != null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Navigation size={13} />
              {normalizedDoctor.distanceKm.toFixed(1)} km
            </span>
          ) : null}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              unavailable
                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
            }`}
          >
            <div className={`h-2 w-2 rounded-full ${unavailable ? "bg-amber-500" : "bg-emerald-500"}`} />
            {unavailable ? tr(language, "Indisponible", "Unavailable", "غير متاح") : tr(language, "Disponible", "Available", "متاح")}
          </span>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
          <div className="flex items-start gap-2.5">
            <MapPin size={15} className="mt-1 shrink-0 text-slate-400 dark:text-slate-500" />
            <span>{normalizedDoctor.address || tr(language, "Adresse non renseignée", "Address unavailable", "العنوان غير متوفر")}</span>
          </div>
        </div>

        <DoctorPublicLinks doctor={normalizedDoctor} className="mt-4" />

        <div className="mt-5">
          <button
            onClick={() => onView(doctor)}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t("ai.assistant.viewDetails")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Layout ─────────────────────────────────────────────
export default function AiAssistantView({ 
  embedded = false, 
  onToggleNav
}: { 
  embedded?: boolean; 
  onToggleNav?: () => void;
  isNavVisible?: boolean;
}) {
  const {
    messages, isThinking, analysis, suggestedDoctors,
    location, locationStatus, locationBlocked, userRole, userName, userAvatarUrl,
    userGender,
    isAnalyzingAttachment, history, sendMessage, requestLocation, resetChat, loadPastSession,
  } = useLunaChat();
  const { t, language } = useI18n();

  const [showProposedDoctors, setShowProposedDoctors] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  const discussionDoctors = suggestedDoctors;

  const [inputText, setInputText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [doctorToView, setDoctorToView] = useState<RecommendedDoctor | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<{ src: string; name: string } | null>(null);
  const [selectedImageZoom, setSelectedImageZoom] = useState(1);
  const directBackendAvailable = hasDirectBackendOrigin();
  const maxAiImageFileBytes = directBackendAvailable
    ? MAX_AI_IMAGE_FILE_BYTES
    : MAX_AI_PROXY_SAFE_IMAGE_FILE_BYTES;
  const maxAiPdfFileBytes = directBackendAvailable
    ? MAX_AI_PDF_FILE_BYTES
    : MAX_AI_PROXY_SAFE_PDF_FILE_BYTES;
  const [isPanningImage, setIsPanningImage] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const hasUserMessages = messages.some((message) => message.role === "user");
  const showLandingHero = !hasUserMessages;
  const composerPlaceholder =
    userRole === "doctor"
      ? tr(
          language,
          "Décrivez un cas, posez votre question clinique ou ajoutez des images et PDF...",
          "Describe a case, ask a clinical question, or add images and PDFs...",
          "صف الحالة أو اطرح سؤالك السريري أو أرفق الصور وملفات PDF..."
        )
      : tr(
          language,
          "Expliquez vos symptômes, posez votre question ou ajoutez des images et PDF...",
          "Explain your symptoms, ask your question, or add images and PDFs...",
          "اشرح الأعراض أو اطرح سؤالك أو أرفق الصور وملفات PDF..."
        );
  const composerCaption = tr(
    language,
    "Jusqu'à 5 pièces jointes. Images et PDF uniquement.",
    "Up to 5 attachments. Images and PDFs only.",
    "حتى 5 مرفقات. الصور وملفات PDF فقط."
  );
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const imageViewportRef = useRef<HTMLDivElement>(null);
  const imagePanStateRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const historyStatusMessage = history.isPersistenceDegraded
    ? tr(
        language,
        "Historique distant indisponible pour le moment. Le cache local reste actif.",
        "Remote history is temporarily unavailable. Local cache is still active.",
        "سجل المحادثات البعيد غير متاح حالياً، لكن التخزين المحلي ما زال يعمل."
      )
    : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, suggestedDoctors]);

  useEffect(() => {
    if (!selectedImagePreview || !imageViewportRef.current) {
      return;
    }

    const viewport = imageViewportRef.current;
    requestAnimationFrame(() => {
      viewport.scrollTo({
        left: Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2),
        top: Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2),
      });
    });
  }, [selectedImagePreview, selectedImageZoom]);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      pendingAttachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, []);

  const handleSend = async () => {
    if (isThinking || isAnalyzingAttachment) return;
    if (!inputText.trim() && pendingAttachments.length === 0) return;
    const t = inputText;
    const attachmentsToSend = [...pendingAttachments];
    const files = attachmentsToSend.map((attachment) => ({
      file: attachment.file,
      previewUrl: attachment.previewUrl,
      kind: attachment.kind,
    }));
    setAttachmentError(null);
    setInputText("");
    setPendingAttachments([]);
    await sendMessage(t, files);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  const handlePickAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachmentError(null);
    setPendingAttachments((previous) => {
      const target = previous.find((attachment) => attachment.id === attachmentId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return previous.filter((attachment) => attachment.id !== attachmentId);
    });
  };

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setAttachmentError(null);
    setPendingAttachments((previous) => {
      const remainingSlots = Math.max(0, 5 - previous.length);
      const supportedFiles = files.filter(
        (file) => file.type.startsWith("image/") || file.type === "application/pdf"
      );
      const oversizedFiles = supportedFiles.filter((file) =>
        file.type === "application/pdf"
          ? file.size > maxAiPdfFileBytes
          : file.size > maxAiImageFileBytes,
      );

      if (supportedFiles.length !== files.length) {
        setAttachmentError("Seuls les fichiers image et PDF sont autorisés.");
      }

      if (oversizedFiles.length > 0) {
        const file = oversizedFiles[0];
        setAttachmentError(
          file.type === "application/pdf"
            ? `Les PDF doivent rester sous ${directBackendAvailable ? "5" : "2"} MB pour l'analyse AI.`
            : `Les images doivent rester sous ${directBackendAvailable ? "8" : "4"} MB avant compression.`,
        );
      }

      if (remainingSlots === 0) {
        setAttachmentError("Vous avez déjà atteint la limite de 5 pièces jointes.");
        return previous;
      }

      if (supportedFiles.length > remainingSlots) {
        setAttachmentError(`Vous pouvez envoyer jusqu'à 5 pièces jointes maximum. ${remainingSlots} emplacement(s) restant(s).`);
      }

      const acceptedFiles = supportedFiles
        .filter((file) => !oversizedFiles.includes(file))
        .slice(0, remainingSlots);

      const nextAttachments: PendingAttachment[] = acceptedFiles.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        kind: file.type === "application/pdf" ? "pdf" : "image",
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      }));

      return [...previous, ...nextAttachments];
    });
    event.target.value = "";
  };

  const startImagePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (selectedImageZoom <= 1 || !imageViewportRef.current) {
      return;
    }

    const viewport = imageViewportRef.current;
    imagePanStateRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsPanningImage(true);
    viewport.setPointerCapture?.(event.pointerId);
  };

  const moveImagePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imagePanStateRef.current.active || !imageViewportRef.current) {
      return;
    }

    const viewport = imageViewportRef.current;
    const deltaX = event.clientX - imagePanStateRef.current.startX;
    const deltaY = event.clientY - imagePanStateRef.current.startY;
    viewport.scrollLeft = imagePanStateRef.current.scrollLeft - deltaX;
    viewport.scrollTop = imagePanStateRef.current.scrollTop - deltaY;
  };

  const endImagePan = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (event && imageViewportRef.current) {
      imageViewportRef.current.releasePointerCapture?.(event.pointerId);
    }
    imagePanStateRef.current.active = false;
    setIsPanningImage(false);
  };

  // ── Sidebar Component ───────────────────────────────────────
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 dark:bg-slate-950 dark:border-slate-800 shrink-0 w-[260px] lg:w-[300px] shadow-sm">
      {/* Home Button & Logo Area */}
      <div className="px-6 py-6 border-b border-transparent">
        <Link href="/" className="mb-6 inline-flex flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-blue-400 transition">
          <Home size={16} /> <span>{t("ai.assistant.home")}</span>
        </Link>
        <div className="flex items-center gap-3">
          <MofidLogo className="h-10 w-10 rounded-2xl shadow-md shadow-blue-500/20" />
          <div>
            <h1 className="text-[19px] font-black leading-tight tracking-[0.16em] text-slate-900 dark:text-white">
              MOFID
            </h1>
            <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {userRole === "doctor"
                ? tr(language, "Assistant clinique", "Clinical assistant", "مساعد سريري")
                : tr(language, "Concierge médical", "Medical concierge", "مرافق طبي")}
            </p>
          </div>
        </div>
      </div>

      {/* Start New Session */}
      <div className="px-5 mb-8">
        <button 
          onClick={() => { resetChat(); setMobileNavOpen(false); }} 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all"
        >
          <Plus size={18} />
          {t("ai.assistant.newConsultation")}
        </button>
      </div>

      {/* Tabs */}
      <div className="px-3 flex flex-col gap-1 mb-6">
        <p className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t("ai.assistant.navigation")}</p>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-medium text-sm transition-all shadow-sm border border-blue-100 dark:border-blue-800/30">
          <MessageSquare size={16} className="text-blue-600 dark:text-blue-400" />
          {t("ai.assistant.newConsultation")}
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white font-medium text-sm transition-all">
          <FileText size={16} /> {t("ai.assistant.medicalRecords")}
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white font-medium text-sm transition-all">
          <History size={16} /> {t("dashboard.patient.appointments")}
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white font-medium text-sm transition-all">
          <Settings size={16} /> {t("dashboard.patient.settings")}
        </button>
      </div>


      {/* Past Conversations */}
      <div className="px-3 flex-1 overflow-y-auto">
        <p className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
          {userRole === "doctor" ? t("ai.assistant.doctorHistory") : t("ai.assistant.pastConversations")}
        </p>
        <div className="flex flex-col gap-1">
          {historyStatusMessage ? (
            <p className="px-3 py-2 text-xs leading-5 text-amber-600 dark:text-amber-300">
              {historyStatusMessage}
            </p>
          ) : null}
          {history.isLoadingHistory ? (
            <div className="px-3 py-4 flex items-center justify-center">
              <Loader2 size={16} className="animate-spin text-slate-400 dark:text-slate-500" />
            </div>
          ) : history.sessions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">
              {historyStatusMessage ?? t("ai.assistant.noHistory")}
            </p>
          ) : (
            history.sessions.map((session, sIdx) => (
              <div key={buildSessionKey(session, sIdx)} className="group relative flex items-center justify-between">
                <button
                  onClick={() => { void loadPastSession(session.id); setMobileNavOpen(false); }}
                  className="w-full text-left truncate px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/50 font-medium text-sm transition pr-8"
                >
                  {session.title || session.specialty || "Conversation"}
                </button>
                <button onClick={() => void history.deleteSession(session.id)}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition">
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Card */}
      <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/20">
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold overflow-hidden shadow-sm">
             <User size={18} />
          </div>
          <div className="flex-1">
            <p className="text-slate-900 dark:text-white text-sm font-bold">
              {userRole === "doctor" ? t("ai.assistant.doctorAccount") : t("ai.assistant.patientAccount")}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
              {userRole === "doctor" ? t("ai.assistant.doctorDesc") : t("ai.assistant.patientDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ── History Panel UI ───────────────────────────────────────
  const renderHistoryPanel = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <History size={18} className="text-blue-600 dark:text-blue-400" /> {t("ai.assistant.history")}
        </h2>
        <button onClick={() => setShowHistoryPanel(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-white p-1">
          <Menu size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {historyStatusMessage ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            {historyStatusMessage}
          </div>
        ) : null}
        {history.isLoadingHistory ? (
           <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : history.sessions.length === 0 ? (
           <p className="text-sm text-slate-500 text-center py-4">
             {historyStatusMessage ?? t("ai.assistant.noHistory")}
           </p>
        ) : (
          history.sessions.map((session, sIdx) => (
            <div key={buildSessionKey(session, sIdx)} className="group relative flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-800 shadow-sm">
              <button
                onClick={() => { void loadPastSession(session.id); setShowHistoryPanel(false); }}
                className="flex-1 text-left truncate text-slate-700 dark:text-slate-300 hover:text-blue-600 font-medium text-sm pr-6"
              >
                {session.title || session.specialty || "Conversation"}
              </button>
              <button onClick={() => void history.deleteSession(session.id)}
                className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 transition">
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative flex ${embedded ? 'h-full' : 'h-screen'} overflow-hidden overflow-x-hidden bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(241,245,249,0.94))] text-slate-800 selection:bg-blue-200 selection:text-blue-900 dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.1),transparent_28%),linear-gradient(180deg,rgba(2,6,23,1),rgba(3,7,18,1))] dark:text-slate-200 dark:selection:bg-blue-900 dark:selection:text-blue-100`}>
      
      {/* Modals */}
      <AnimatePresence>
        {userRole === "patient" && doctorToView && (
          <DoctorDetailsModal doctor={doctorToView} onClose={() => setDoctorToView(null)} />
        )}
        {selectedImagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedImagePreview(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="flex max-h-[88vh] w-full max-w-[min(92vw,980px)] flex-col overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 text-sm text-slate-300">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-100">{selectedImagePreview.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Taille contrôlée pour tout le site. Utilisez le zoom puis déplacez l&apos;image dans le cadre.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-1.5 py-1">
                    <button
                      type="button"
                      onClick={() => setSelectedImageZoom((current) => Math.max(0.75, Number((current - 0.25).toFixed(2))))}
                      className="rounded-full p-2 text-slate-200 transition hover:bg-slate-800"
                      title="Réduire"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <span className="min-w-12 text-center text-xs font-semibold text-slate-300">
                      {Math.round(selectedImageZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedImageZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))))}
                      className="rounded-full p-2 text-slate-200 transition hover:bg-slate-800"
                      title="Agrandir"
                    >
                      <ZoomIn size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedImageZoom(1)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                    title="Réinitialiser"
                  >
                    <RotateCcw size={14} />
                    Réinitialiser
                  </button>
                  <button
                    onClick={() => setSelectedImagePreview(null)}
                    className="rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                  >
                    Fermer
                  </button>
                </div>
              </div>
              <div
                ref={imageViewportRef}
                className={`relative flex h-[min(72vh,760px)] items-center justify-center overflow-auto bg-slate-950 p-4 ${
                  selectedImageZoom > 1 ? (isPanningImage ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
                }`}
                onPointerDown={startImagePan}
                onPointerMove={moveImagePan}
                onPointerUp={endImagePan}
                onPointerLeave={() => endImagePan()}
              >
                <div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-slate-300">
                  <Move size={12} />
                  Déplacez l&apos;image après zoom
                </div>
                <div className="flex min-h-full min-w-full items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedImagePreview.src}
                    alt={selectedImagePreview.name}
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    className="rounded-2xl object-contain shadow-[0_18px_60px_-30px_rgba(15,23,42,0.85)]"
                    style={{
                      width: selectedImageZoom > 1 ? `${selectedImageZoom * 100}%` : "auto",
                      maxWidth: selectedImageZoom > 1 ? "none" : "min(100%, 860px)",
                      maxHeight: selectedImageZoom > 1 ? "none" : "min(68vh, 700px)",
                    }}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar — hidden when embedded in dashboard */}
          {!embedded && (
        <div className="hidden md:flex h-full">
          {renderSidebarContent()}
        </div>
      )}

      {/* Mobile Sliding Nav Overlay — only when not embedded */}
      {!embedded && (
        <>
          <AnimatePresence>
            {mobileNavOpen && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
                onClick={() => setMobileNavOpen(false)}
              />
            )}
          </AnimatePresence>
          <div className={`fixed top-0 bottom-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            {renderSidebarContent()}
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-h-0 relative bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_40%),linear-gradient(to_bottom,_rgba(255,255,255,0.98),_rgba(248,250,252,0.9))] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_34%),linear-gradient(to_bottom,_rgba(2,6,23,0.98),_rgba(2,6,23,0.96))]">
      
        {/* History Slide Panel */}
        <AnimatePresence>
          {showHistoryPanel && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className={`absolute inset-0 z-40 bg-slate-900/20 backdrop-blur-sm flex justify-end`}
              onClick={() => setShowHistoryPanel(false)}
            >
              <motion.div
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="w-[300px] h-full shadow-2xl shrink-0 border-l border-slate-200 dark:border-slate-800" 
                onClick={(e) => e.stopPropagation()}
              >
                {renderHistoryPanel()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Banner Blocked Overlay */}
        <AnimatePresence>
          {locationBlocked && userRole === "patient" && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#eab308] text-slate-900 px-5 py-2.5 rounded-full flex items-center justify-center gap-2 shadow-2xl"
            >
              <MapPin size={14} className="shrink-0" />
              <span className="text-xs font-bold font-sans">
                Location blocked. Enable in browser to find nearby doctors.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Emergency Overlay */}
        <AnimatePresence>
          {analysis?.isEmergency && (
             <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-2.5 rounded-full flex items-center justify-center gap-2 shadow-2xl"
           >
             <AlertTriangle size={15} className="animate-pulse" />
             <span className="text-xs font-bold tracking-widest uppercase">Emergency — Call 15 / 112 !!</span>
           </motion.div>
          )}
        </AnimatePresence>

        {/* Proposed Doctors Sidebar (Slide-over) */}
        <AnimatePresence>
          {showProposedDoctors && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-slate-900/20 backdrop-blur-sm"
                onClick={() => setShowProposedDoctors(false)}
              />
              <motion.div 
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute top-0 right-0 bottom-0 w-full max-w-sm z-[60] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
              >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                      <Users size={20} className="text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 dark:text-white leading-tight">{tr(language, "Médecins proposés", "Proposed Doctors", "الأطباء المقترحون")}</h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{tr(language, "Dans cette discussion", "In this chat", "في هذه الجلسة")}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowProposedDoctors(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition text-slate-400">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {discussionDoctors.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <MofidLogo className="mb-4 h-14 w-14 rounded-[20px]" />
                      <p className="text-sm text-slate-400">{tr(language, "Aucun médecin n'a encore été proposé.", "No doctors have been proposed yet.", "لم يتم اقتراح أي طبيب بعد.")}</p>
                    </div>
                  ) : (
                    discussionDoctors.map((doc, idx) => (
                      <DoctorCard 
                        key={`side-${doc.id}-${idx}`}
                        doctor={doc}
                        index={idx}
                        onView={setDoctorToView}
                      />
                    ))
                  )}
                </div>
                
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] text-slate-400 italic text-center leading-relaxed">
                    {tr(language, "Ces médecins ont été identifiés par l'IA comme pertinents pour votre demande.", "These doctors were identified by AI as relevant to your request.", "تم تحديد هؤلاء الأطباء بواسطة الذكاء الاصطناعي كمرتبطين بطلبك.")}
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Unified Universal Header */}
        <div className="flex-none border-b border-slate-200/60 bg-white/55 px-3 py-3 backdrop-blur-2xl dark:border-slate-800/60 dark:bg-slate-950/55 sm:px-4 md:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {(onToggleNav || !embedded) && (
              <button 
                onClick={() => onToggleNav ? onToggleNav() : setMobileNavOpen(true)} 
                className={`${embedded ? 'flex' : 'md:hidden'} min-h-[44px] min-w-[44px] items-center justify-center text-slate-600 dark:text-blue-400 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-slate-700`}
                title={tr(language, "Menu", "Menu", "القائمة")}
              >
                <Menu size={20}/>
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <MofidLogo className="h-8 w-8 rounded-2xl shadow-lg shadow-blue-500/20" />
              <div className="hidden sm:block">
                <p className="text-sm font-black leading-none tracking-[0.18em] text-slate-900 dark:text-white">
                  MOFID
                </p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                  {userRole === "doctor"
                    ? tr(language, "Assistant clinique", "Clinical assistant", "مساعد سريري")
                    : tr(language, "Concierge santé", "Health concierge", "مرافق صحي")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:justify-end md:gap-3">
            <Link
              href="/"
              className="flex min-h-[44px] shrink-0 items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-all border border-transparent"
              title={t("ai.assistant.home")}
            >
              <Home size={14} />
              <span className="hidden md:inline">{t("ai.assistant.home")}</span>
            </Link>

            {/* Discussion Doctors Button */}
            <button 
              onClick={() => setShowProposedDoctors(!showProposedDoctors)} 
              disabled={discussionDoctors.length === 0}
              className={`flex min-h-[44px] shrink-0 items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${showProposedDoctors ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/20' : 'text-slate-500 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30'}`}
              title={tr(language, "Médecins de la discussion", "Discussion doctors", "أطباء الجلسة الحالية")}
            >
              <Users size={14} />
              <span className="hidden lg:inline">{tr(language, "Médecins", "Doctors", "الأطباء")}</span>
              {discussionDoctors.length > 0 && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{discussionDoctors.length}</span>}
            </button>

            <button 
              onClick={() => setShowHistoryPanel(true)} 
              className="flex min-h-[44px] shrink-0 items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent"
            >
              <History size={14} />
              <span className="hidden md:inline">{t("ai.assistant.history")}</span>
            </button>

            <button 
              onClick={resetChat} 
              className="flex min-h-[44px] shrink-0 items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">{t("ai.assistant.newConsultation")}</span>
            </button>
          </div>
          </div>
        </div>

        {userRole === "patient" && !showLandingHero ? (
          <div className="flex-none border-b border-slate-200/70 bg-white/60 px-4 py-3 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/60 md:px-8">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:text-white"
                onClick={() => {
                  if (locationBlocked) setShowLocationModal(true);
                  else requestLocation();
                }}
              >
                <MapPin size={12} />
                {location
                  ? tr(language, "Position active ≤100 km", "Location active ≤100 km", "الموقع مفعل ≤100 كم")
                  : locationStatus}
              </button>
              <button
                type="button"
                disabled={discussionDoctors.length === 0}
                onClick={() => setShowProposedDoctors(true)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:text-white"
              >
                <Users size={12} />
                {discussionDoctors.length > 0
                  ? tr(
                      language,
                      `${discussionDoctors.length} médecin(s) proposés`,
                      `${discussionDoctors.length} suggested doctor(s)`,
                      `${discussionDoctors.length} طبيب/أطباء مقترحين`
                    )
                  : tr(language, "Aucun médecin proposé pour l'instant", "No suggested doctors yet", "لا يوجد أطباء مقترحون حالياً")}
              </button>
            </div>
          </div>
        ) : null}

        {/* Chat Area Scrollable */}
        <div className="flex-1 overflow-y-auto bg-transparent px-3 py-5 pb-8 sm:px-4 sm:py-8 sm:pb-12 md:px-8 lg:px-14 xl:px-20">
          {showLandingHero ? (
            <div className="mb-8">
              <AssistantHero
                language={language}
                userRole={userRole}
                userName={userName}
                userGender={userGender}
                location={location}
                locationBlocked={locationBlocked}
                locationStatus={locationStatus}
                discussionDoctorsCount={discussionDoctors.length}
                onRequestLocation={() => {
                  if (locationBlocked) setShowLocationModal(true);
                  else requestLocation();
                }}
                onShowDoctors={() => setShowProposedDoctors(true)}
                onResetChat={resetChat}
                onShowHistory={() => setShowHistoryPanel(true)}
              />
            </div>
          ) : null}
          
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => {
              const inlineDoctors = msg.suggestedDoctors ?? [];
              const hasInlineDoctors =
                msg.role === "assistant" && inlineDoctors.length > 0;

              return (
              <motion.div key={buildMessageKey(msg, idx)} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                className={`mx-auto flex w-full max-w-5xl items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                
                {/* Avatar */}
                {msg.role === "assistant" ? (
                  <MofidLogo className="mt-1 h-9 w-9 shrink-0 rounded-xl shadow-md shadow-blue-600/20" />
                ) : (
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    {userAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={userAvatarUrl}
                        alt={userName || tr(language, "Utilisateur", "User", "مستخدم")}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-black tracking-[0.18em] text-blue-700 dark:text-blue-300">
                        {getAvatarInitials(userName, "ME")}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Bubble */}
                <div className={`${hasInlineDoctors ? "flex-1 max-w-[min(92vw,1060px)]" : "w-fit max-w-[min(84vw,760px)] sm:max-w-[72%] xl:max-w-[64%]"} space-y-2.5`}>
                  <div
                    className={`w-fit rounded-[20px] px-4 py-3 text-[14px] leading-7 shadow-sm ${
                      hasInlineDoctors ? "max-w-[min(84vw,760px)] sm:max-w-[72%] xl:max-w-[64%]" : ""
                    } ${msg.role === "assistant" ? "bg-white border border-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-tl-sm dark:border-slate-800" : "bg-blue-50 border border-blue-100 dark:bg-blue-900/40 text-slate-900 dark:text-blue-50 rounded-tr-sm dark:border-blue-800/50"}`}
                  >
                  {msg.attachments?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {msg.attachments.map((attachment, attachmentIndex) => (
                        <div
                          key={`${attachment.name}-${attachmentIndex}`}
                          className={`max-w-[320px] overflow-hidden rounded-[18px] border ${msg.role === "assistant" ? "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70" : "border-blue-200 bg-white/80 dark:border-blue-800 dark:bg-slate-950/40"}`}
                        >
                          {attachment.kind === "image" && attachment.previewUrl ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedImageZoom(1);
                                setSelectedImagePreview({ src: attachment.previewUrl ?? "", name: attachment.name });
                              }}
                              className="block"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={attachment.previewUrl}
                                alt={attachment.name}
                                className="h-28 w-28 object-cover transition hover:scale-[1.02] md:h-32 md:w-32"
                              />
                            </button>
                          ) : (
                            <div className="flex items-center gap-3 p-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300">
                                <FileText size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {attachment.name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">PDF</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {msg.content ? (
                    <div dir={getMessageDirection(msg.content)} className="whitespace-pre-wrap break-words">
                      <MsgContent text={msg.content} />
                    </div>
                  ) : null}
                  </div>

                  {/* In-line suggested doctors */}
                  {hasInlineDoctors && (
                    <div className="mt-1 overflow-hidden rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.96))] p-3 shadow-[0_20px_50px_-35px_rgba(59,130,246,0.3)] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))]">
                      <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                              {t(location ? "ai.assistant.foundNearby" : "ai.assistant.foundGeneral", { count: inlineDoctors.length })}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-300">
                            {userRole === "patient"
                              ? tr(
                                  language,
                                  "Choisissez un praticien et ouvrez sa fiche complète pour voir ses informations.",
                                  "Choose a practitioner and open the full profile to view the details.",
                                  "اختر الطبيب المناسب وافتح بطاقته الكاملة للاطلاع على التفاصيل."
                                )
                              : tr(
                                  language,
                                  "Suggestions générées à partir de l'échange courant.",
                                  "Suggestions generated from the current conversation.",
                                  "اقتراحات تم توليدها من المحادثة الحالية."
                                )}
                          </p>
                        </div>
                        {userRole === "patient" ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (locationBlocked) setShowLocationModal(true);
                              else requestLocation();
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
                          >
                            <MapPin size={12} />
                            {location
                              ? tr(language, "Position active", "Location active", "الموقع مفعل")
                              : tr(language, "Utiliser ma position", "Use my location", "استخدام موقعي")}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {inlineDoctors.map((doc, dIdx) => (
                          <DoctorCard 
                            key={buildDoctorKey(doc, dIdx)} 
                            doctor={doc} 
                            index={dIdx} 
                            onView={setDoctorToView}
                          />
                        ))}
                      </div>
                      <div className="pt-4">
                        <p className="text-[11px] italic text-slate-400 dark:text-slate-500">
                          {t("ai.assistant.disclaimer")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </motion.div>
            )})}

          </AnimatePresence>

          {/* Thinking */}
          <AnimatePresence>
            {isThinking && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-start gap-4">
                <MofidLogo className="mt-1 h-9 w-9 shrink-0 rounded-full shadow-md shadow-blue-600/20" />
                <div className="flex min-w-[74px] items-center gap-1.5 rounded-[20px] rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }} transition={{ duration: 1.2, repeat: Infinity, delay }}
                      className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                  ))}
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium ml-2">{t("ai.assistant.thinking")}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} className="h-10" />
        </div>

        {/* Input Area (Fixed at bottom) */}
        <div className="flex-none border-t border-slate-200/50 bg-white/55 p-4 pb-8 backdrop-blur-2xl dark:border-slate-800/50 dark:bg-slate-950/55 md:px-8 lg:px-14 xl:px-20">
          <div className="mx-auto max-w-5xl">
            <div className="rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.94))] p-4 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] dark:shadow-blue-500/5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,application/pdf"
                multiple
                onChange={handleAttachmentChange}
                className="hidden"
              />

              {pendingAttachments.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {pendingAttachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="group flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                    >
                      {attachment.kind === "image" && attachment.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={attachment.previewUrl}
                          alt={attachment.file.name}
                          className="h-10 w-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300">
                          <FileText size={18} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="max-w-[170px] truncate font-medium text-slate-700 dark:text-slate-200">
                          {attachment.file.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {attachment.kind === "pdf" ? "PDF" : "Image"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveAttachment(attachment.id)}
                        className="rounded-full p-1 text-slate-400 transition hover:bg-white hover:text-rose-500 dark:hover:bg-slate-700"
                        aria-label={`Supprimer ${attachment.file.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {attachmentError ? (
                <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
                  {attachmentError}
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePickAttachment}
                  disabled={isAnalyzingAttachment || pendingAttachments.length >= 5}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 transition hover:text-blue-600 dark:bg-slate-800/70 dark:text-slate-500 dark:hover:text-blue-400 disabled:opacity-50"
                >
                   <Paperclip size={18} />
                </button>
                <div className="flex-1 rounded-[24px] border border-slate-200/80 bg-white/80 dark:border-slate-700 dark:bg-slate-900/75">
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      if (attachmentError && e.target.value.trim()) {
                        setAttachmentError(null);
                      }
                    }}
                    onKeyDown={handleKey}
                    placeholder={composerPlaceholder}
                    rows={2}
                    className="min-h-[92px] w-full resize-none bg-transparent px-4 pt-4 text-[15px] text-slate-900 outline-none placeholder:text-base placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500 no-scrollbar"
                  />
                  <div className="flex items-center justify-between gap-3 px-4 pb-3 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    <span>{composerCaption}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 uppercase tracking-[0.18em] dark:bg-slate-800">
                      {userRole === "doctor"
                        ? tr(language, "Mode docteur", "Doctor mode", "وضع الطبيب")
                        : tr(language, "Mode patient", "Patient mode", "وضع المريض")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleSend}
                  disabled={(!inputText.trim() && pendingAttachments.length === 0) || isThinking || isAnalyzingAttachment}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white transition hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                >
                  <Send size={18} className="translate-x-[1px]" />
                </button>
              </div>

              {pendingAttachments.length > 0 && (
                <div className="mt-3 px-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  {pendingAttachments.length}/5 • {composerCaption}
                </div>
              )}
            </div>
            
            {isAnalyzingAttachment && (
              <div className="mt-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2 animate-pulse">
                <Loader2 size={12} className="animate-spin" />
                Analyse des pièces jointes en cours...
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Location Modal */}
      <AnimatePresence>
        {userRole === "patient" && showLocationModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowLocationModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin size={32} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Localisation Bloquée</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                  L&apos;accès à votre position géographique est restreint. Pour vous recommander les médecins les plus proches :
                </p>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-left border border-slate-100 dark:border-slate-800">
                  <ol className="list-decimal list-inside text-sm text-slate-700 dark:text-slate-300 space-y-2">
                    <li>Cliquez sur l&apos;icône de cadenas (🔒) ou de réglages située en haut à gauche dans la barre d&apos;adresse de votre navigateur.</li>
                    <li>Cochez / Activez la permission <strong>Position (Localisation)</strong>.</li>
                    <li>Rechargez cette page.</li>
                  </ol>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
                >
                  J&apos;ai compris
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
