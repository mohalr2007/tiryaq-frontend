// made by larabi
"use client";
import AiAssistantView from "@/features/ai-assistant/AiAssistantView";
/* eslint-disable @next/next/no-img-element */
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getCachedSupabaseUser,
  getStableAuthUser,
  hasSupabaseAuthTokenSnapshot,
  supabase,
} from "../../utils/supabase/client";
import {
  clearExpiredVacationFlag,
  syncExpiredDoctorVacations,
} from "../../utils/doctorAvailability";
import { logAuditEvent, logPerformanceEvent } from "../../utils/telemetry";
import { getBrowserLocation } from "../../utils/location";
import {
  filterApprovedDoctors,
  getApprovedDoctorIdsSet,
} from "@/utils/approvedDoctorsClient";
import { Logo } from "../../components/Logo";
import { useI18n } from "@/lib/i18n";
import DoctorPublicLinks from "@/components/DoctorPublicLinks";
import ThemeToggle from "@/components/ThemeToggle";
import { type DoctorContactFields } from "@/utils/doctorContactChannels";
import { buildPrescriptionPublicUrl } from "@/utils/prescriptions/publicUrl";
import DoctorDetailsModal from "@/features/ai-assistant/DoctorDetailsModal";
import DoctorBookingModal from "@/features/ai-assistant/DoctorBookingModal";
import type { BookingSuccessResult } from "@/features/ai-assistant/booking";
import type { RecommendedDoctor } from "@/features/ai-assistant/types";
import {
  Calendar,
  Search,
  FileText,
  Star,
  MapIcon,
  MapPin,
  LogOut,
  Clock,
  ChevronRight,
  Activity,
  Settings,
  Crosshair,
  RefreshCw,
  Upload,
  Heart,
  Bookmark,
  MessageCircle,
  Send,
  Flag,
  Menu,
  X,
  Printer,
  Home,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import dynamicImport from "next/dynamic";

const MapComponent = dynamicImport(
  () => import("../../components/MapComponent"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 font-medium rounded-3xl">
        Chargement de la carte (OpenStreetMap gratuit)...
      </div>
    ),
  },
);

type BookingSelectionMode =
  | "patient_datetime"
  | "patient_date_only"
  | "doctor_datetime";
type SortOrder = "desc" | "asc";

type PatientProfile = {
  id: string;
  full_name: string | null;
  patient_registration_number: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  avatar_url: string | null;
  account_type: "patient" | "doctor" | null;
  specialty: string | null;
  email?: string | null;
  moderation_status?: string | null;
  moderation_reason?: string | null;
};

type DoctorSummary = DoctorContactFields & {
  id: string;
  full_name: string | null;
  specialty: string | null;
  address: string | null;
  avatar_url: string | null;
  gender: string | null;
  latitude: number | null;
  longitude: number | null;
  is_accepting_appointments: boolean | null;
  appointment_duration_minutes: number | null;
  max_appointments_per_day: number | null;
  vacation_start: string | null;
  vacation_end: string | null;
  is_on_vacation: boolean | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  appointment_booking_mode: BookingSelectionMode | null;
  google_maps_link: string | null;
};

const DOCTOR_SUMMARY_SELECT =
  "id, full_name, specialty, address, avatar_url, gender, latitude, longitude, is_accepting_appointments, appointment_duration_minutes, max_appointments_per_day, vacation_start, vacation_end, is_on_vacation, working_hours_start, working_hours_end, appointment_booking_mode, google_maps_link, contact_phone, contact_phone_enabled, contact_email, contact_email_enabled, facebook_url, facebook_enabled, instagram_url, instagram_enabled, x_url, x_enabled, whatsapp_url, whatsapp_enabled, telegram_url, telegram_enabled, linkedin_url, linkedin_enabled, gmail_url, gmail_enabled";

function formatPatientRegistrationNumber(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length !== 13) {
    return null;
  }

  return `${digits.slice(0, 6)} ${digits.slice(6, 12)} ${digits.slice(12)}`;
}

function toRecommendedDoctor(
  doctor: DoctorSummary,
  ratingRow?: DoctorRatingRow,
  distanceKm?: number | null,
): RecommendedDoctor {
  return {
    ...doctor,
    rating: ratingRow?.avg_rating ?? 0,
    reviews: ratingRow?.total_reviews ?? 0,
    distanceKm: distanceKm ?? null,
  };
}

type PatientAppointment = {
  id: string;
  created_at: string;
  appointment_date: string;
  status: string;
  doctor_id: string;
  booking_selection_mode: BookingSelectionMode | null;
  requested_date: string | null;
  requested_time: string | null;
  appointment_source: "patient_request" | "doctor_follow_up" | null;
  follow_up_visit_id: string | null;
  follow_up_dossier_id: string | null;
  follow_up_time_pending: boolean;
  follow_up_reminder_days: number | null;
  notes?: string | null;
  doctor: {
    full_name: string | null;
    specialty: string | null;
    address: string | null;
  } | null;
};

type PatientPrescription = {
  id: string;
  public_token: string;
  prescription_number: string;
  prescription_date: string;
  created_at: string;
  doctor_display_name: string;
  doctor_specialty: string | null;
  visit: {
    id: string;
    visit_date: string | null;
    visit_time: string | null;
  } | null;
};

type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
};

type PublicationImage = {
  id: string;
  image_url: string;
  sort_order: number;
};

type PatientArticle = {
  id: string;
  doctor_id: string;
  category: "conseil" | "maladie";
  title: string;
  content: string;
  created_at: string;
  likes_count: number;
  saves_count: number;
  comments_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
  images: PublicationImage[];
  comments: CommunityComment[];
  author: {
    full_name: string | null;
    specialty: string | null;
    avatar_url?: string | null;
    doctor_verification_status?: string | null;
    is_doctor_verified?: boolean | null;
  } | null;
};

type DoctorRatingRow = {
  doctor_id: string;
  avg_rating: number;
  total_reviews: number;
};

type ReviewEntry = {
  id: string;
  appointment_id: string;
  doctor_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

const DASHBOARD_QUERY_TIMEOUT_MS = 15000;

const SPECIALTY_TRANSLATIONS: Record<
  string,
  { fr: string; en: string; ar: string }
> = {
  ophtalmologue: {
    fr: "Ophtalmologue",
    en: "Ophthalmologist",
    ar: "طبيب عيون",
  },
  pediatre: { fr: "Pédiatre", en: "Pediatrician", ar: "طبيب أطفال" },
  pédiatre: { fr: "Pédiatre", en: "Pediatrician", ar: "طبيب أطفال" },
  dermatologue: { fr: "Dermatologue", en: "Dermatologist", ar: "طبيب جلدية" },
  cardiologue: { fr: "Cardiologue", en: "Cardiologist", ar: "طبيب قلب" },
  generaliste: {
    fr: "Médecin généraliste",
    en: "General practitioner",
    ar: "طبيب عام",
  },
  généraliste: {
    fr: "Médecin généraliste",
    en: "General practitioner",
    ar: "طبيب عام",
  },
  neurologue: { fr: "Neurologue", en: "Neurologist", ar: "طبيب أعصاب" },
  gynecologue: {
    fr: "Gynécologue",
    en: "Gynecologist",
    ar: "طبيب نساء وتوليد",
  },
  gynécologue: {
    fr: "Gynécologue",
    en: "Gynecologist",
    ar: "طبيب نساء وتوليد",
  },
  orthopediste: { fr: "Orthopédiste", en: "Orthopedist", ar: "طبيب عظام" },
  orthopédiste: { fr: "Orthopédiste", en: "Orthopedist", ar: "طبيب عظام" },
  orl: { fr: "ORL", en: "ENT specialist", ar: "طبيب أنف وأذن وحنجرة" },
  psychiatre: { fr: "Psychiatre", en: "Psychiatrist", ar: "طبيب نفسي" },
  urologue: { fr: "Urologue", en: "Urologist", ar: "طبيب مسالك بولية" },
};

function normalizeDoctorRelation(
  doctor:
    | PatientAppointment["doctor"]
    | PatientAppointment["doctor"][]
    | null
    | undefined,
): PatientAppointment["doctor"] {
  if (Array.isArray(doctor)) {
    return doctor[0] ?? null;
  }
  return doctor ?? null;
}

function normalizePrescriptionVisitRelation(
  visit:
    | PatientPrescription["visit"]
    | PatientPrescription["visit"][]
    | null
    | undefined,
): PatientPrescription["visit"] {
  if (Array.isArray(visit)) {
    return visit[0] ?? null;
  }

  return visit ?? null;
}

function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

async function runDashboardTask<T>(
  task: PromiseLike<T>,
  fallback: T,
  label: string,
): Promise<T> {
  try {
    return await withTimeout(task, DASHBOARD_QUERY_TIMEOUT_MS, label);
  } catch (error) {
    console.warn(`${label} failed in patient dashboard`, error);
    return fallback;
  }
}

function isDoctorOnVacation(doctor: DoctorSummary | null, date = new Date()) {
  if (!doctor) {
    return false;
  }

  if (doctor.vacation_end) {
    const vacationEnd = new Date(`${doctor.vacation_end}T23:59:59`);
    if (
      !Number.isNaN(vacationEnd.getTime()) &&
      date.getTime() > vacationEnd.getTime()
    ) {
      return false;
    }
  }

  if (doctor.is_on_vacation) {
    return true;
  }

  if (!doctor.vacation_start || !doctor.vacation_end) {
    return false;
  }

  const start = new Date(doctor.vacation_start);
  const end = new Date(doctor.vacation_end);
  end.setHours(23, 59, 59, 999);

  return date >= start && date <= end;
}

function computeDistanceKm(
  from: { lat: number; lng: number } | null,
  doctor: DoctorSummary | null,
): number | null {
  if (!from || doctor?.latitude == null || doctor?.longitude == null) {
    return null;
  }

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(doctor.latitude - from.lat);
  const dLon = toRadians(doctor.longitude - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(doctor.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function normalizeTimeValue(
  value: string | null | undefined,
  fallback: string,
) {
  if (!value) {
    return fallback;
  }

  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) {
    return fallback;
  }

  return `${match[1]}:${match[2]}`;
}

function getLocalIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildLocalDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function getSortableTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortItemsByDate<T>(
  items: T[],
  getDateValue: (item: T) => string | null | undefined,
  order: SortOrder = "desc",
) {
  return [...items].sort((left, right) => {
    const delta =
      getSortableTimestamp(getDateValue(left)) -
      getSortableTimestamp(getDateValue(right));
    return order === "asc" ? delta : -delta;
  });
}

function getAppointmentReminderDate(
  appointment: Pick<
    PatientAppointment,
    "appointment_date" | "requested_date" | "follow_up_time_pending"
  >,
) {
  if (
    (appointment.follow_up_time_pending || !appointment.appointment_date) &&
    appointment.requested_date
  ) {
    return new Date(`${appointment.requested_date}T00:00:00`);
  }

  return new Date(appointment.appointment_date);
}

type NoticeType = "success" | "error" | "info";

type AccountEligibilitySnapshot = {
  blocked?: boolean;
  emailBlocked?: boolean;
  restricted?: boolean;
  moderationStatus?: string | null;
  moderationReason?: string | null;
  block?: {
    id?: string;
    email?: string;
    reason?: string | null;
    blockedAt?: string | null;
    handledByAdminLabel?: string | null;
  } | null;
};

export default function PatientDashboard() {
  const { t, language } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get("embed") === "1";
  const locale =
    language === "ar" ? "ar-DZ" : language === "en" ? "en-US" : "fr-FR";
  const tr = (fr: string, en: string, ar: string) =>
    language === "ar" ? ar : language === "en" ? en : fr;
  const localizeSpecialty = (value: string | null | undefined) => {
    if (!value) {
      return tr("Médecin", "Doctor", "طبيب");
    }

    const normalized = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    const mapped = SPECIALTY_TRANSLATIONS[normalized];
    if (!mapped) {
      return value;
    }

    return tr(mapped.fr, mapped.en, mapped.ar);
  };
  const getVacationLabelLocalized = (doctor: DoctorSummary | null) => {
    if (doctor?.vacation_end) {
      const dateLabel = new Date(doctor.vacation_end).toLocaleDateString(
        locale,
      );
      return tr(
        `Ce docteur est en congé jusqu'au ${dateLabel}.`,
        `This doctor is on vacation until ${dateLabel}.`,
        `هذا الطبيب في عطلة إلى غاية ${dateLabel}.`,
      );
    }

    return tr(
      "Ce docteur est actuellement en congé.",
      "This doctor is currently on vacation.",
      "هذا الطبيب في عطلة حالياً.",
    );
  };

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [accountEligibility, setAccountEligibility] =
    useState<AccountEligibilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    const normalizedTab = tab === "articles" ? "community" : tab;
    const allowedTabs = new Set([
      "overview",
      "search",
      "appointments",
      "prescriptions",
      "community",
      "settings",
      "ai-assistant",
      "favorites",
    ]);
    return normalizedTab && allowedTabs.has(normalizedTab)
      ? normalizedTab
      : "overview";
  });
  const [favoriteDoctors, setFavoriteDoctors] = useState<DoctorSummary[]>([]);

  useEffect(() => {
    if (!profile?.id) return;
    const saved = localStorage.getItem(`tiryaq_favs_${profile.id}`);
    if (saved) {
      try {
        setFavoriteDoctors(JSON.parse(saved));
      } catch {
        setFavoriteDoctors([]);
      }
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) {
      localStorage.setItem(
        `tiryaq_favs_${profile.id}`,
        JSON.stringify(favoriteDoctors),
      );
    }
  }, [favoriteDoctors, profile?.id]);

  useEffect(() => {
    if (!profile?.email) {
      setAccountEligibility(null);
      return;
    }

    let isMounted = true;

    const refreshEligibility = async () => {
      try {
        const params = new URLSearchParams({ email: profile.email ?? "" });
        const response = await fetch(
          `/api/account-eligibility?${params.toString()}`,
          {
            cache: "no-store",
            credentials: "include",
            headers: { accept: "application/json" },
          },
        );

        if (!response.ok) {
          return;
        }

        const payload =
          (await response.json().catch(() => null)) as AccountEligibilitySnapshot | null;
        if (isMounted && payload) {
          setAccountEligibility(payload);
        }
      } catch {
        // Best effort only: dashboard banners keep using the last known moderation state.
      }
    };

    void refreshEligibility();

    const handleFocus = () => {
      void refreshEligibility();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void refreshEligibility();
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshEligibility();
    }, 15000);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [profile?.email]);

  const toggleFavoriteDoctor = (doc: DoctorSummary) => {
    setFavoriteDoctors((prev) => {
      const isFav = prev.some((f) => f.id === doc.id);
      if (isFav) return prev.filter((f) => f.id !== doc.id);
      return [...prev, doc];
    });
  };
  const [isDesktopNavVisible, setIsDesktopNavVisible] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [communityView, setCommunityView] = useState<"feed" | "saved">("feed");

  // Data
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<PatientPrescription[]>([]);
  const [articles, setArticles] = useState<PatientArticle[]>([]);
  const [doctorRatings, setDoctorRatings] = useState<
    Record<string, DoctorRatingRow>
  >({});
  const [reviewsByAppointmentId, setReviewsByAppointmentId] = useState<
    Record<string, ReviewEntry>
  >({});

  // Search & Filter & Geoloc
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [minimumRating, setMinimumRating] = useState(0);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchRadius, setSearchRadius] = useState(50);

  // Booking Modal
  const [selectedDoctorToBook, setSelectedDoctorToBook] =
    useState<DoctorSummary | null>(null);
  const [selectedDoctorDetails, setSelectedDoctorDetails] =
    useState<DoctorSummary | null>(null);
  const [selectedDoctorDetailsContext, setSelectedDoctorDetailsContext] =
    useState<"default" | "community">("default");
  const [appointmentToReview, setAppointmentToReview] =
    useState<PatientAppointment | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [settingsFullName, setSettingsFullName] = useState("");
  const [settingsAddress, setSettingsAddress] = useState("");
  const [settingsAvatarUrl, setSettingsAvatarUrl] = useState("");
  const [settingsLatitude, setSettingsLatitude] = useState<number | null>(null);
  const [settingsLongitude, setSettingsLongitude] = useState<number | null>(
    null,
  );
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [commentDraftsByPostId, setCommentDraftsByPostId] = useState<
    Record<string, string>
  >({});
  const [commentSubmittingPostId, setCommentSubmittingPostId] = useState<
    string | null
  >(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [appointmentsSortOrder, setAppointmentsSortOrder] =
    useState<SortOrder>("desc");
  const [prescriptionsSortOrder, setPrescriptionsSortOrder] =
    useState<SortOrder>("desc");
  const [notice, setNotice] = useState<{
    type: NoticeType;
    message: string;
  } | null>(null);
  const [isAutoSavingAccount, setIsAutoSavingAccount] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: "post" | "comment";
    id: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState("Contenu inapproprié");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [hasDeferredRefresh, setHasDeferredRefresh] = useState(false);
  const hasHydratedSettingsRef = useRef(false);
  const hasCompletedInitialLoadRef = useRef(false);
  const accountSettingsSnapshotRef = useRef("");
  const noticeTimerRef = useRef<number | null>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const manualRefreshTimerRef = useRef<number | null>(null);
  const activeTabRef = useRef(activeTab);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const getSortButtonClasses = (isActive: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition ${
      isActive
        ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;
  const sortedAppointments = sortItemsByDate(
    appointments,
    (appointment) => appointment.created_at,
    appointmentsSortOrder,
  );
  const sortedPrescriptions = sortItemsByDate(
    prescriptions,
    (prescription) => prescription.created_at,
    prescriptionsSortOrder,
  );
  const shouldDeferAutoRefresh =
    activeTab === "search" ||
    activeTab === "settings" ||
    activeTab === "ai-assistant";
  const upcomingTrackedAppointments = appointments.filter((appointment) => {
    if (
      appointment.status === "cancelled" ||
      appointment.status === "completed"
    ) {
      return false;
    }

    const reminderDate = getAppointmentReminderDate(appointment);
    return (
      !Number.isNaN(reminderDate.getTime()) &&
      reminderDate.getTime() >= Date.now()
    );
  });
  const pinnedAppointmentsWithin48h = sortItemsByDate(
    upcomingTrackedAppointments.filter((appointment) => {
      const diff =
        getAppointmentReminderDate(appointment).getTime() - Date.now();
      return diff >= 0 && diff <= 48 * 60 * 60 * 1000;
    }),
    (appointment) => appointment.appointment_date,
    "asc",
  );
  const urgentAppointmentsWithinHour = sortItemsByDate(
    upcomingTrackedAppointments.filter((appointment) => {
      if (appointment.follow_up_time_pending) {
        return false;
      }

      const diff =
        new Date(appointment.appointment_date).getTime() - Date.now();
      return diff >= 0 && diff <= 60 * 60 * 1000;
    }),
    (appointment) => appointment.appointment_date,
    "asc",
  );
  const todayAppointments = sortItemsByDate(
    upcomingTrackedAppointments.filter((appointment) => {
      const reminderDate = getAppointmentReminderDate(appointment);
      return reminderDate.toDateString() === new Date().toDateString();
    }),
    (appointment) => appointment.appointment_date,
    "asc",
  );
  const appointmentsAwaitingReview = sortItemsByDate(
    appointments.filter(
      (appointment) =>
        appointment.status === "completed" &&
        !reviewsByAppointmentId[appointment.id],
    ),
    (appointment) => appointment.created_at,
    "desc",
  );

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const normalizedTab = tab === "articles" ? "community" : tab;
    const allowedTabs = new Set([
      "overview",
      "search",
      "appointments",
      "prescriptions",
      "community",
      "settings",
      "ai-assistant",
      "favorites",
    ]);
    if (normalizedTab && allowedTabs.has(normalizedTab)) {
      setActiveTab(normalizedTab);
    }
  }, [searchParams]);

  const showNotice = (message: string, type: NoticeType = "info") => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }

    setNotice({ message, type });
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 4200);
  };

  const queueRealtimeRefresh = () => {
    if (
      activeTabRef.current === "search" ||
      activeTabRef.current === "settings" ||
      activeTabRef.current === "ai-assistant"
    ) {
      setHasDeferredRefresh(true);
      return;
    }

    if (realtimeRefreshTimerRef.current) {
      return;
    }
    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      setRefreshCounter((current) => current + 1);
      realtimeRefreshTimerRef.current = null;
      setHasDeferredRefresh(false);
    }, 450);
  };

  const inferNoticeType = (text: string): NoticeType => {
    const lower = text.toLowerCase();
    if (
      lower.includes("erreur") ||
      lower.includes("impossible") ||
      lower.includes("invalid") ||
      lower.includes("refus")
    ) {
      return "error";
    }
    if (
      lower.includes("succès") ||
      lower.includes("merci") ||
      lower.includes("mis à jour") ||
      lower.includes("envoy")
    ) {
      return "success";
    }
    return "info";
  };

  const alert = (message: unknown) => {
    const text = String(message ?? "Une erreur est survenue.");
    showNotice(text, inferNoticeType(text));
  };

  const computeAccountSettingsSnapshot = (
    name: string,
    address: string,
    avatar: string,
    latitude: number | null,
    longitude: number | null,
  ) =>
    JSON.stringify({
      full_name: name.trim() || null,
      address: address.trim() || null,
      avatar_url: avatar.trim() || null,
      latitude,
      longitude,
    });

  const fetchDoctorRatings = async (doctorIds: string[]) => {
    if (doctorIds.length === 0) {
      return {};
    }

    const { data, error } = await supabase
      .from("doctor_ratings")
      .select("doctor_id, avg_rating, total_reviews")
      .in("doctor_id", doctorIds);

    if (error || !data) {
      return {};
    }

    return data.reduce<Record<string, DoctorRatingRow>>((accumulator, row) => {
      accumulator[row.doctor_id] = {
        doctor_id: row.doctor_id,
        avg_rating: Number(row.avg_rating ?? 0),
        total_reviews: Number(row.total_reviews ?? 0),
      };
      return accumulator;
    }, {});
  };

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const startedAt = performance.now();
      let shouldKeepLoadingForRedirect = false;
      const shouldShowBlockingLoader = !hasCompletedInitialLoadRef.current;
      const hasTokenSnapshot = hasSupabaseAuthTokenSnapshot();

      try {
        if (isMounted && shouldShowBlockingLoader) {
          setLoading(true);
        }

        await syncExpiredDoctorVacations();
        const { user, error: authError } = await runDashboardTask(
          getStableAuthUser(),
          { user: getCachedSupabaseUser(), error: null },
          "auth.user",
        );

        if (authError?.includes("Refresh Token Not Found")) {
          shouldKeepLoadingForRedirect = true;
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        if (!user) {
          if (hasTokenSnapshot) {
            showNotice(
              tr(
                "La session est en cours de restauration. Réessayez dans quelques secondes.",
                "Your session is being restored. Please try again in a few seconds.",
                "تتم الآن استعادة الجلسة. يرجى المحاولة بعد بضع ثوانٍ.",
              ),
              "info",
            );
            return;
          }

          shouldKeepLoadingForRedirect = true;
          router.replace("/login");
          return;
        }

        let userProfile: PatientProfile | null = null;

        try {
          const profileResponse = await withTimeout(
            supabase
              .from("profiles")
              .select(
                "id, full_name, patient_registration_number, address, latitude, longitude, avatar_url, account_type, specialty, moderation_status, moderation_reason",
              )
              .eq("id", user.id)
              .single(),
            DASHBOARD_QUERY_TIMEOUT_MS,
            "profiles.patient",
          );

          if (!profileResponse.error && profileResponse.data) {
            userProfile = profileResponse.data as PatientProfile;
          }
        } catch (error) {
          console.warn("Full patient profile query failed, trying fallback", error);
        }

        // Fallback: governance columns may not exist yet
        if (!userProfile) {
          try {
            const fallbackResponse = await withTimeout(
              supabase
                .from("profiles")
                .select(
                  "id, full_name, patient_registration_number, address, latitude, longitude, avatar_url, account_type, specialty",
                )
                .eq("id", user.id)
                .single(),
              DASHBOARD_QUERY_TIMEOUT_MS,
              "profiles.patient.fallback",
            );

            if (!fallbackResponse.error && fallbackResponse.data) {
              userProfile = {
                ...fallbackResponse.data,
                moderation_status: null,
                moderation_reason: null,
              } as PatientProfile;
            }
          } catch (error) {
            console.warn("Fallback patient profile query also failed", error);
          }
        }

        if (userProfile === null) {
          if (hasTokenSnapshot) {
            showNotice(
              tr(
                "Le profil est momentanément indisponible. La page va réessayer automatiquement.",
                "Your profile is temporarily unavailable. The page will retry automatically.",
                "الملف الشخصي غير متاح مؤقتاً. ستتم إعادة المحاولة تلقائياً.",
              ),
              "error",
            );
            return;
          }

          shouldKeepLoadingForRedirect = true;
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        if (!isMounted) {
          return;
        }

        if (userProfile.account_type === "doctor") {
          shouldKeepLoadingForRedirect = true;
          router.replace("/doctor-dashboard");
          return;
        }

        setProfile({
          id: user.id,
          full_name: userProfile.full_name,
          patient_registration_number: userProfile.patient_registration_number,
          address: userProfile.address,
          latitude: userProfile.latitude,
          longitude: userProfile.longitude,
          avatar_url: userProfile.avatar_url,
          account_type: userProfile.account_type ?? "patient",
          specialty: userProfile.specialty,
          email: user.email,
          moderation_status: userProfile.moderation_status ?? null,
          moderation_reason: userProfile.moderation_reason ?? null,
        });
        if (!hasHydratedSettingsRef.current) {
          setSettingsFullName(userProfile.full_name ?? "");
          setSettingsAddress(userProfile.address ?? "");
          setSettingsAvatarUrl(userProfile.avatar_url ?? "");
          setSettingsLatitude(userProfile.latitude ?? null);
          setSettingsLongitude(userProfile.longitude ?? null);
          accountSettingsSnapshotRef.current = computeAccountSettingsSnapshot(
            userProfile.full_name ?? "",
            userProfile.address ?? "",
            userProfile.avatar_url ?? "",
            userProfile.latitude ?? null,
            userProfile.longitude ?? null,
          );
          hasHydratedSettingsRef.current = true;
        }

        const initialLat = userProfile.latitude;
        const initialLng = userProfile.longitude;

        if (typeof initialLat === "number" && typeof initialLng === "number") {
          setUserLocation({ lat: initialLat, lng: initialLng });
        }

        const [docs, appts, fetchedPrescriptions, posts, reviews] =
          await Promise.all([
            runDashboardTask(
              fetchDoctors(
                initialLat ?? undefined,
                initialLng ?? undefined,
                searchRadius,
              ),
              [],
              "fetchDoctors",
            ),
            runDashboardTask(
              supabase
                .from("appointments")
                .select(
                  "id, created_at, appointment_date, status, doctor_id, booking_selection_mode, requested_date, requested_time, appointment_source, follow_up_visit_id, follow_up_dossier_id, follow_up_time_pending, follow_up_reminder_days, notes, doctor:profiles!doctor_id(full_name, specialty, address)",
                )
                .eq("patient_id", user.id)
                .order("created_at", { ascending: false })
                .then(({ data }) => data ?? []),
              [],
              "appointments.patient",
            ),
            runDashboardTask(
              supabase
                .from("visit_prescriptions")
                .select(
                  "id, public_token, prescription_number, prescription_date, created_at, doctor_display_name, doctor_specialty, visit:dossier_visits!visit_id(id, visit_date, visit_time)",
                )
                .eq("patient_id", user.id)
                .order("created_at", { ascending: false })
                .then(({ data, error }) => {
                  if (error) {
                    console.warn(
                      "visit_prescriptions unavailable in patient dashboard",
                      error.message,
                    );
                    return [];
                  }
                  return data ?? [];
                }),
              [],
              "visit_prescriptions.patient",
            ),
            runDashboardTask(
              supabase
                .from("community_posts")
                .select(
                  "id, doctor_id, category, title, content, created_at, author:profiles!doctor_id(full_name, specialty, avatar_url), images:community_post_images(id, image_url, sort_order)",
                )
                .eq("is_hidden", false)
                .order("created_at", { ascending: false })
                .then(({ data }) => data ?? []),
              [],
              "community_posts.patient",
            ),
            runDashboardTask(
              supabase
                .from("reviews")
                .select(
                  "id, appointment_id, doctor_id, rating, comment, created_at",
                )
                .eq("patient_id", user.id)
                .then(({ data }) => data ?? []),
              [],
              "reviews.patient",
            ),
          ]);

        if (!isMounted) {
          return;
        }

        const normalizedAppointments: PatientAppointment[] = appts.map(
          (appointment) => ({
            id: appointment.id,
            created_at: appointment.created_at ?? appointment.appointment_date,
            appointment_date: appointment.appointment_date,
            status: appointment.status,
            doctor_id: appointment.doctor_id,
            booking_selection_mode: (appointment.booking_selection_mode ??
              "patient_datetime") as BookingSelectionMode,
            requested_date: appointment.requested_date ?? null,
            requested_time: appointment.requested_time ?? null,
            appointment_source:
              appointment.appointment_source ?? "patient_request",
            follow_up_visit_id: appointment.follow_up_visit_id ?? null,
            follow_up_dossier_id: appointment.follow_up_dossier_id ?? null,
            follow_up_time_pending: Boolean(appointment.follow_up_time_pending),
            follow_up_reminder_days: appointment.follow_up_reminder_days ?? 4,
            notes: appointment.notes ?? null,
            doctor: normalizeDoctorRelation(appointment.doctor),
          }),
        );

        const normalizedPrescriptions: PatientPrescription[] =
          fetchedPrescriptions.map((prescription) => ({
            id: prescription.id,
            public_token: prescription.public_token,
            prescription_number: prescription.prescription_number,
            prescription_date: prescription.prescription_date,
            created_at:
              prescription.created_at ?? prescription.prescription_date,
            doctor_display_name: prescription.doctor_display_name,
            doctor_specialty: prescription.doctor_specialty ?? null,
            visit: normalizePrescriptionVisitRelation(
              prescription.visit as
                | PatientPrescription["visit"]
                | PatientPrescription["visit"][]
                | null,
            ),
          }));

        const postIds = posts.map((post) => post.id);
        const [likesRows, savesRows, commentsRows] = postIds.length
          ? await Promise.all([
              runDashboardTask(
                supabase
                  .from("community_post_likes")
                  .select("post_id, user_id")
                  .in("post_id", postIds)
                  .then(({ data }) => data ?? []),
                [],
                "community_post_likes.patient",
              ),
              runDashboardTask(
                supabase
                  .from("community_post_saves")
                  .select("post_id, user_id")
                  .in("post_id", postIds)
                  .then(({ data }) => data ?? []),
                [],
                "community_post_saves.patient",
              ),
              runDashboardTask(
                supabase
                  .from("community_post_comments")
                  .select(
                    "id, post_id, user_id, content, created_at, user:profiles!user_id(full_name, avatar_url)",
                  )
                  .in("post_id", postIds)
                  .eq("is_hidden", false)
                  .order("created_at", { ascending: true })
                  .then(({ data }) => data ?? []),
                [],
                "community_post_comments.patient",
              ),
            ])
          : [[], [], []];

        const likesByPost = likesRows.reduce<
          Record<string, { count: number; likedByMe: boolean }>
        >((accumulator, like) => {
          if (!accumulator[like.post_id]) {
            accumulator[like.post_id] = { count: 0, likedByMe: false };
          }
          accumulator[like.post_id].count += 1;
          if (like.user_id === user.id) {
            accumulator[like.post_id].likedByMe = true;
          }
          return accumulator;
        }, {});

        const savesByPost = savesRows.reduce<
          Record<string, { count: number; savedByMe: boolean }>
        >((accumulator, save) => {
          if (!accumulator[save.post_id]) {
            accumulator[save.post_id] = { count: 0, savedByMe: false };
          }
          accumulator[save.post_id].count += 1;
          if (save.user_id === user.id) {
            accumulator[save.post_id].savedByMe = true;
          }
          return accumulator;
        }, {});

        const commentsByPost = commentsRows.reduce<
          Record<string, CommunityComment[]>
        >((accumulator, comment) => {
          if (!accumulator[comment.post_id]) {
            accumulator[comment.post_id] = [];
          }

          const commentAuthor = Array.isArray(comment.user)
            ? comment.user[0]
            : comment.user;
          accumulator[comment.post_id].push({
            id: comment.id,
            post_id: comment.post_id,
            user_id: comment.user_id,
            content: comment.content,
            created_at: comment.created_at,
            author_name:
              commentAuthor?.full_name ?? tr("Utilisateur", "User", "مستخدم"),
            author_avatar: commentAuthor?.avatar_url ?? null,
          });
          return accumulator;
        }, {});

        const normalizedArticles: PatientArticle[] = posts.map((post) => {
          const likesEntry = likesByPost[post.id] ?? {
            count: 0,
            likedByMe: false,
          };
          const savesEntry = savesByPost[post.id] ?? {
            count: 0,
            savedByMe: false,
          };
          const postComments = commentsByPost[post.id] ?? [];
          return {
            id: post.id,
            doctor_id: post.doctor_id,
            category: (post.category ?? "conseil") as "conseil" | "maladie",
            title: post.title,
            content: post.content,
            created_at: post.created_at,
            likes_count: likesEntry.count,
            saves_count: savesEntry.count,
            comments_count: postComments.length,
            liked_by_me: likesEntry.likedByMe,
            saved_by_me: savesEntry.savedByMe,
            images: (Array.isArray(post.images) ? post.images : [])
              .map((image) => ({
                id: image.id,
                image_url: image.image_url,
                sort_order: image.sort_order ?? 0,
              }))
              .sort((a, b) => a.sort_order - b.sort_order),
            comments: postComments,
            author: Array.isArray(post.author)
              ? (post.author[0] ?? null)
              : (post.author ?? null),
          };
        });

        const reviewsMap = reviews.reduce<Record<string, ReviewEntry>>(
          (accumulator, review) => {
            if (review.appointment_id) {
              accumulator[review.appointment_id] = {
                id: review.id,
                appointment_id: review.appointment_id,
                doctor_id: review.doctor_id,
                rating: review.rating,
                comment: review.comment ?? null,
                created_at: review.created_at,
              };
            }
            return accumulator;
          },
          {},
        );

        const ratingsMap = await runDashboardTask(
          fetchDoctorRatings(docs.map((doctor) => doctor.id)),
          {},
          "doctor_ratings.patient",
        );

        setDoctors(docs);
        setAppointments(normalizedAppointments);
        setPrescriptions(normalizedPrescriptions);
        setArticles(normalizedArticles);
        setReviewsByAppointmentId(reviewsMap);
        setDoctorRatings(ratingsMap);

        void logPerformanceEvent({
          actorId: user.id,
          pageKey: "dashboard_patient",
          metricName: "initial_data_load",
          metricMs: performance.now() - startedAt,
          context: {
            doctors_count: docs.length,
            appointments_count: normalizedAppointments.length,
            prescriptions_count: normalizedPrescriptions.length,
            posts_count: normalizedArticles.length,
          },
        });
      } catch (error) {
        console.error("Patient dashboard initial load failed", error);

        if (!isMounted) {
          return;
        }

        showNotice(
          tr(
            "Le tableau de bord a rencontré un problème au chargement. Le contenu disponible a été affiché quand même.",
            "The dashboard hit a loading problem. Available content was still shown.",
            "واجهت لوحة التحكم مشكلة أثناء التحميل. تم عرض المحتوى المتاح رغم ذلك.",
          ),
          "error",
        );
        setDoctors([]);
        setAppointments([]);
        setPrescriptions([]);
        setArticles([]);
        setReviewsByAppointmentId({});
        setDoctorRatings({});
      } finally {
        if (!shouldKeepLoadingForRedirect) {
          hasCompletedInitialLoadRef.current = true;
        }
        if (isMounted && !shouldKeepLoadingForRedirect) {
          setLoading(false);
        }
      }
    }
    void loadData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, refreshCounter]);

  const fetchDoctors = async (
    lat?: number,
    lng?: number,
    radius?: number,
  ): Promise<DoctorSummary[]> => {
    const startedAt = performance.now();
    const approvedDoctorIds = await getApprovedDoctorIdsSet();
    const approvedDoctorIdList = Array.from(approvedDoctorIds ?? []);

    if (approvedDoctorIdList.length === 0) {
      void logPerformanceEvent({
        actorId: profile?.id ?? null,
        pageKey: "dashboard_patient",
        metricName: "search_map_result_latency",
        metricMs: performance.now() - startedAt,
        context: { geolocated: false, result_count: 0, approvals_ready: false },
      });
      return [];
    }

    if (
      typeof lat === "number" &&
      typeof lng === "number" &&
      typeof radius === "number"
    ) {
      try {
        const { data: docs, error } = await withTimeout(
          supabase.rpc("get_nearby_doctors", {
            user_lat: lat,
            user_lon: lng,
            radius_km: radius,
          }),
          DASHBOARD_QUERY_TIMEOUT_MS,
          "get_nearby_doctors",
        );

        if (!error) {
          const mappedDocs = filterApprovedDoctors(
            (docs as DoctorSummary[] | null) ?? [],
            approvedDoctorIds,
          ).map((doctor) => ({
            ...clearExpiredVacationFlag(doctor),
            working_hours_start: normalizeTimeValue(
              doctor.working_hours_start,
              "08:00",
            ),
            working_hours_end: normalizeTimeValue(
              doctor.working_hours_end,
              "17:00",
            ),
          }));
          void logPerformanceEvent({
            actorId: profile?.id ?? null,
            pageKey: "dashboard_patient",
            metricName: "search_map_result_latency",
            metricMs: performance.now() - startedAt,
            context: {
              geolocated: true,
              radius_km: radius,
              result_count: mappedDocs.length,
            },
          });
          return mappedDocs;
        }

        console.warn(
          "get_nearby_doctors RPC failed, falling back to doctor list",
          error.message,
        );
      } catch (error) {
        console.warn(
          "get_nearby_doctors RPC failed, falling back to doctor list",
          error,
        );
      }
    }

    const docs = await runDashboardTask(
      supabase
        .from("profiles")
        .select(DOCTOR_SUMMARY_SELECT)
        .in("id", approvedDoctorIdList)
        .then(({ data }) => (data as DoctorSummary[] | null) ?? []),
      [],
      "profiles.doctors",
    );
    await syncExpiredDoctorVacations();
    const mappedDocs = docs.map((doctor) => ({
      ...clearExpiredVacationFlag(doctor),
      working_hours_start: normalizeTimeValue(
        doctor.working_hours_start,
        "08:00",
      ),
      working_hours_end: normalizeTimeValue(doctor.working_hours_end, "17:00"),
    }));
    void logPerformanceEvent({
      actorId: profile?.id ?? null,
      pageKey: "dashboard_patient",
      metricName: "search_map_result_latency",
      metricMs: performance.now() - startedAt,
      context: { geolocated: false, result_count: mappedDocs.length },
    });
    return mappedDocs;
  };

  const handleGeolocate = async () => {
    if (!profile) {
      return;
    }

    setIsResolvingLocation(true);
    try {
      const resolvedLocation = await getBrowserLocation(language);
      const nextAddress =
        resolvedLocation.address ||
        resolvedLocation.rawAddress ||
        settingsAddress ||
        profile.address ||
        "";

      setUserLocation({
        lat: resolvedLocation.latitude,
        lng: resolvedLocation.longitude,
      });
      setLocationAccuracy(resolvedLocation.accuracy);
      setSettingsAddress(nextAddress);
      setSettingsLatitude(resolvedLocation.latitude);
      setSettingsLongitude(resolvedLocation.longitude);
      setProfile((current) =>
        current
          ? {
              ...current,
              address: nextAddress || current.address,
              latitude: resolvedLocation.latitude,
              longitude: resolvedLocation.longitude,
            }
          : current,
      );

      const { error } = await supabase
        .from("profiles")
        .update({
          address: nextAddress || null,
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
        })
        .eq("id", profile.id);

      if (error) {
        throw error;
      }

      alert(
        tr(
          "Position GPS mise à jour avec succès.",
          "GPS location updated successfully.",
          "تم تحديث موقع GPS بنجاح.",
        ),
      );
    } catch {
      alert(
        tr(
          "Erreur de localisation. Activez le GPS et autorisez le navigateur.",
          "Location error. Enable GPS and allow your browser.",
          "خطأ في تحديد الموقع. فعّل GPS واسمح للمتصفح.",
        ),
      );
    } finally {
      setIsResolvingLocation(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    void fetchDoctors(userLocation?.lat, userLocation?.lng, searchRadius).then(
      async (docs) => {
        if (!isMounted) return;
        const ratingsMap = await fetchDoctorRatings(
          docs.map((doctor) => doctor.id),
        );
        if (!isMounted) return;
        setDoctors(docs);
        setDoctorRatings(ratingsMap);
      },
    );
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchRadius, userLocation?.lat, userLocation?.lng]);

  const handleSignOut = async () => {
    if (profile?.id) {
      await logAuditEvent({
        actorId: profile.id,
        action: "user_signed_out",
        entityType: "auth",
      });
    }
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const handleManualRefresh = () => {
    setHasDeferredRefresh(false);
    setIsManualRefreshing(true);
    if (manualRefreshTimerRef.current) {
      window.clearTimeout(manualRefreshTimerRef.current);
    }
    manualRefreshTimerRef.current = window.setTimeout(() => {
      setIsManualRefreshing(false);
      manualRefreshTimerRef.current = null;
    }, 850);
    setRefreshCounter((current) => current + 1);
  };

  useEffect(() => {
    if (shouldDeferAutoRefresh) {
      return;
    }

    const intervalMs =
      activeTab === "appointments" || activeTab === "prescriptions"
        ? 90000
        : activeTab === "community"
          ? 120000
          : 180000;
    const timerId = setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      setRefreshCounter((current) => current + 1);
    }, intervalMs);
    return () => clearInterval(timerId);
  }, [activeTab, shouldDeferAutoRefresh]);

  useEffect(() => {
    if (shouldDeferAutoRefresh || !hasDeferredRefresh) {
      return;
    }

    setHasDeferredRefresh(false);
    setRefreshCounter((current) => current + 1);
  }, [hasDeferredRefresh, shouldDeferAutoRefresh]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
      if (manualRefreshTimerRef.current) {
        window.clearTimeout(manualRefreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    const appointmentsChannel = supabase
      .channel(`patient-appointments-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `patient_id=eq.${profile.id}`,
        },
        () => {
          queueRealtimeRefresh();
        },
      )
      .subscribe();

    const prescriptionsChannel = supabase
      .channel(`patient-prescriptions-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "visit_prescriptions",
          filter: `patient_id=eq.${profile.id}`,
        },
        () => {
          queueRealtimeRefresh();
        },
      )
      .subscribe();

    const globalRefreshChannel = supabase
      .channel(`patient-global-refresh-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        queueRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews" },
        queueRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_posts" },
        queueRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_post_comments" },
        queueRealtimeRefresh,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(appointmentsChannel);
      void supabase.removeChannel(prescriptionsChannel);
      void supabase.removeChannel(globalRefreshChannel);
    };
  }, [profile?.id]);

  const openDoctorDetails = (doctor: DoctorSummary) => {
    setSelectedDoctorDetailsContext("default");
    setSelectedDoctorDetails(doctor);
  };

  const openCommunityDoctorDetails = async (doctorId: string) => {
    const existingDoctor = doctors.find((doctor) => doctor.id === doctorId);
    if (existingDoctor) {
      setSelectedDoctorDetailsContext("community");
      setSelectedDoctorDetails(existingDoctor);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(DOCTOR_SUMMARY_SELECT)
      .eq("id", doctorId)
      .eq("account_type", "doctor")
      .maybeSingle();

    if (error || !data) {
      showNotice(
        tr(
          "Impossible d'ouvrir la fiche du docteur pour le moment.",
          "Unable to open the doctor's profile right now.",
          "تعذر فتح بطاقة الطبيب حالياً.",
        ),
        "error",
      );
      return;
    }

    const fetchedDoctor = clearExpiredVacationFlag(data as DoctorSummary);
    const normalizedDoctor: DoctorSummary = {
      ...fetchedDoctor,
      working_hours_start: normalizeTimeValue(
        fetchedDoctor.working_hours_start,
        "08:00",
      ),
      working_hours_end: normalizeTimeValue(
        fetchedDoctor.working_hours_end,
        "17:00",
      ),
    };

    setSelectedDoctorDetailsContext("community");
    setSelectedDoctorDetails(normalizedDoctor);
  };

  const closeDoctorDetails = () => {
    setSelectedDoctorDetails(null);
    setSelectedDoctorDetailsContext("default");
  };

  const bookFromDetails = (doctor: DoctorSummary) => {
    setSelectedDoctorDetailsContext("default");
    setSelectedDoctorDetails(null);
    openBookingModal(doctor);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!profile) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert(
        tr(
          "Veuillez choisir un fichier image (JPG, PNG, WebP...).",
          "Please choose an image file (JPG, PNG, WebP...).",
          "يرجى اختيار ملف صورة (JPG أو PNG أو WebP).",
        ),
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(
        tr(
          "La taille maximale autorisée est de 5 MB.",
          "Maximum allowed size is 5 MB.",
          "الحد الأقصى المسموح به هو 5 MB.",
        ),
      );
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${profile.id}/${Date.now()}-${safeFilename}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(filePath, file, {
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        throw new Error(
          tr(
            "Impossible de récupérer l'URL publique de l'image.",
            "Unable to get the public image URL.",
            "تعذر الحصول على رابط الصورة العام.",
          ),
        );
      }

      setSettingsAvatarUrl(publicUrlData.publicUrl);
      showNotice(
        tr(
          "Photo téléversée avec succès.",
          "Photo uploaded successfully.",
          "تم رفع الصورة بنجاح.",
        ),
        "success",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Échec du téléversement de la photo.";
      alert(tr("Erreur", "Error", "خطأ") + ": " + message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const persistAccountSettings = async ({
    silent = false,
  }: { silent?: boolean } = {}) => {
    if (!profile) {
      return false;
    }

    const payload = {
      full_name: settingsFullName.trim() || null,
      address: settingsAddress.trim() || null,
      avatar_url: settingsAvatarUrl.trim() || null,
      latitude: settingsLatitude,
      longitude: settingsLongitude,
    };
    const snapshot = computeAccountSettingsSnapshot(
      settingsFullName,
      settingsAddress,
      settingsAvatarUrl,
      settingsLatitude,
      settingsLongitude,
    );
    if (snapshot === accountSettingsSnapshotRef.current) {
      setIsAutoSavingAccount(false);
      return true;
    }

    setIsSavingAccount(true);
    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", profile.id);
    setIsSavingAccount(false);
    setIsAutoSavingAccount(false);

    if (error) {
      showNotice(`${tr("Erreur", "Error", "خطأ")}: ${error.message}`, "error");
      return false;
    }

    accountSettingsSnapshotRef.current = snapshot;
    setProfile((current) =>
      current
        ? {
            ...current,
            ...payload,
          }
        : current,
    );

    if (!silent) {
      await logAuditEvent({
        actorId: profile.id,
        action: "profile_updated",
        entityType: "profile",
        entityId: profile.id,
        metadata: { context: "patient_settings" },
      });
      showNotice(
        tr("Profil mis à jour.", "Profile updated.", "تم تحديث الملف الشخصي."),
        "success",
      );
    }

    return true;
  };

  const handleSaveAccountSettings = async () => {
    await persistAccountSettings();
  };

  useEffect(() => {
    if (
      !profile?.id ||
      !hasHydratedSettingsRef.current ||
      activeTab !== "settings"
    ) {
      return;
    }

    const snapshot = computeAccountSettingsSnapshot(
      settingsFullName,
      settingsAddress,
      settingsAvatarUrl,
      settingsLatitude,
      settingsLongitude,
    );
    if (snapshot === accountSettingsSnapshotRef.current) {
      return;
    }

    setIsAutoSavingAccount(true);
    const timerId = window.setTimeout(() => {
      void persistAccountSettings({ silent: true });
    }, 700);

    return () => {
      window.clearTimeout(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profile?.id,
    activeTab,
    settingsFullName,
    settingsAddress,
    settingsAvatarUrl,
    settingsLatitude,
    settingsLongitude,
  ]);

  const toggleLikePost = async (postId: string) => {
    if (!profile) {
      return;
    }

    const targetPost = articles.find((post) => post.id === postId);
    if (!targetPost) {
      return;
    }

    if (targetPost.liked_by_me) {
      const { error } = await supabase
        .from("community_post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", profile.id);
      if (error) {
        alert(tr("Erreur", "Error", "خطأ") + ": " + error.message);
        return;
      }

      setArticles((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                liked_by_me: false,
                likes_count: Math.max(0, post.likes_count - 1),
              }
            : post,
        ),
      );
      return;
    }

    const { error } = await supabase.from("community_post_likes").insert({
      post_id: postId,
      user_id: profile.id,
    });

    if (error) {
      alert(tr("Erreur", "Error", "خطأ") + ": " + error.message);
      return;
    }

    setArticles((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, liked_by_me: true, likes_count: post.likes_count + 1 }
          : post,
      ),
    );

    await logAuditEvent({
      actorId: profile.id,
      action: "community_post_liked",
      entityType: "community_post_like",
      entityId: postId,
      metadata: { post_id: postId },
    });
  };

  const toggleSavePost = async (postId: string) => {
    if (!profile) {
      return;
    }

    const targetPost = articles.find((post) => post.id === postId);
    if (!targetPost) {
      return;
    }

    if (targetPost.saved_by_me) {
      const { error } = await supabase
        .from("community_post_saves")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", profile.id);
      if (error) {
        alert(tr("Erreur", "Error", "خطأ") + ": " + error.message);
        return;
      }

      setArticles((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                saved_by_me: false,
                saves_count: Math.max(0, post.saves_count - 1),
              }
            : post,
        ),
      );
      return;
    }

    const { error } = await supabase.from("community_post_saves").insert({
      post_id: postId,
      user_id: profile.id,
    });

    if (error) {
      alert(tr("Erreur", "Error", "خطأ") + ": " + error.message);
      return;
    }

    setArticles((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, saved_by_me: true, saves_count: post.saves_count + 1 }
          : post,
      ),
    );
  };

  const reportPost = async (postId: string) => {
    setReportTarget({ type: "post", id: postId });
    setReportReason(
      tr("Contenu inapproprié", "Inappropriate content", "محتوى غير مناسب"),
    );
  };

  const reportComment = async (commentId: string) => {
    setReportTarget({ type: "comment", id: commentId });
    setReportReason(
      tr("Commentaire inapproprié", "Inappropriate comment", "تعليق غير مناسب"),
    );
  };

  const closeReportModal = () => {
    if (isSubmittingReport) {
      return;
    }
    setReportTarget(null);
    setReportReason(
      tr("Contenu inapproprié", "Inappropriate content", "محتوى غير مناسب"),
    );
  };

  const submitReport = async () => {
    if (!profile || !reportTarget) {
      return;
    }

    const reason = reportReason.trim();
    if (!reason) {
      showNotice(
        tr(
          "Merci de préciser la raison du signalement.",
          "Please provide a report reason.",
          "يرجى تحديد سبب الإبلاغ.",
        ),
        "error",
      );
      return;
    }

    setIsSubmittingReport(true);
    try {
      if (reportTarget.type === "post") {
        const { error } = await supabase.from("community_post_reports").insert({
          post_id: reportTarget.id,
          reporter_id: profile.id,
          reason,
        });
        if (error) {
          throw error;
        }

        await logAuditEvent({
          actorId: profile.id,
          action: "community_post_reported",
          entityType: "community_post_report",
          metadata: { post_id: reportTarget.id },
        });
      } else {
        const { error } = await supabase
          .from("community_comment_reports")
          .insert({
            comment_id: reportTarget.id,
            reporter_id: profile.id,
            reason,
          });
        if (error) {
          throw error;
        }

        await logAuditEvent({
          actorId: profile.id,
          action: "community_comment_reported",
          entityType: "community_comment_report",
          metadata: { comment_id: reportTarget.id },
        });
      }

      showNotice(
        tr(
          "Signalement envoyé. Merci.",
          "Report sent. Thank you.",
          "تم إرسال البلاغ. شكراً لك.",
        ),
        "success",
      );
      setReportTarget(null);
      setReportReason(
        tr("Contenu inapproprié", "Inappropriate content", "محتوى غير مناسب"),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer le signalement.";
      showNotice(
        `${tr("Erreur signalement", "Report error", "خطأ في البلاغ")}: ${message}`,
        "error",
      );
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const submitCommunityComment = async (postId: string) => {
    if (!profile) {
      return;
    }

    const draft = (commentDraftsByPostId[postId] ?? "").trim();
    if (!draft) {
      return;
    }

    setCommentSubmittingPostId(postId);
    const { data, error } = await supabase
      .from("community_post_comments")
      .insert({
        post_id: postId,
        user_id: profile.id,
        content: draft,
      })
      .select(
        "id, post_id, user_id, content, created_at, user:profiles!user_id(full_name, avatar_url)",
      )
      .single();
    setCommentSubmittingPostId(null);

    if (error || !data) {
      alert(
        tr("Erreur", "Error", "خطأ") +
          ": " +
          (error?.message ??
            tr(
              "Impossible d'envoyer le commentaire.",
              "Unable to send the comment.",
              "تعذر إرسال التعليق.",
            )),
      );
      return;
    }

    const commentAuthor = Array.isArray(data.user) ? data.user[0] : data.user;
    const normalizedComment: CommunityComment = {
      id: data.id,
      post_id: data.post_id,
      user_id: data.user_id,
      content: data.content,
      created_at: data.created_at,
      author_name:
        commentAuthor?.full_name ??
        profile.full_name ??
        tr("Utilisateur", "User", "مستخدم"),
      author_avatar: commentAuthor?.avatar_url ?? profile.avatar_url ?? null,
    };

    setCommentDraftsByPostId((current) => ({
      ...current,
      [postId]: "",
    }));

    setArticles((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [...post.comments, normalizedComment],
              comments_count: post.comments_count + 1,
            }
          : post,
      ),
    );
  };

  const openBookingModal = (doctor: DoctorSummary) => {
    setSelectedDoctorToBook(doctor);
  };

  const closeBookingModal = () => {
    setSelectedDoctorToBook(null);
  };

  const openReviewModal = (appointment: PatientAppointment) => {
    setAppointmentToReview(appointment);
    setReviewRating(5);
    setReviewComment("");
  };

  const closeReviewModal = () => {
    setAppointmentToReview(null);
  };

  const submitReview = async () => {
    if (!appointmentToReview || !profile) {
      return;
    }

    setIsSubmittingReview(true);
    try {
      const { data: newReview, error } = await supabase
        .from("reviews")
        .insert({
          appointment_id: appointmentToReview.id,
          patient_id: profile.id,
          doctor_id: appointmentToReview.doctor_id,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
        })
        .select("id, appointment_id, doctor_id, rating, comment, created_at")
        .single();

      if (error) {
        throw error;
      }

      if (newReview?.appointment_id) {
        setReviewsByAppointmentId((current) => ({
          ...current,
          [newReview.appointment_id]: {
            id: newReview.id,
            appointment_id: newReview.appointment_id,
            doctor_id: newReview.doctor_id,
            rating: newReview.rating,
            comment: newReview.comment ?? null,
            created_at: newReview.created_at,
          },
        }));
      }

      const updatedRatings = await fetchDoctorRatings([
        appointmentToReview.doctor_id,
      ]);
      setDoctorRatings((current) => ({ ...current, ...updatedRatings }));

      closeReviewModal();
      await logAuditEvent({
        actorId: profile.id,
        action: "review_submitted",
        entityType: "review",
        entityId: newReview.id,
        metadata: {
          appointment_id: appointmentToReview.id,
          doctor_id: appointmentToReview.doctor_id,
          rating: reviewRating,
        },
      });
      alert(
        tr(
          "Merci, votre avis a été enregistré.",
          "Thank you, your review has been saved.",
          "شكراً لك، تم حفظ تقييمك.",
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible d'envoyer l'avis.";
      alert(tr("Erreur", "Error", "خطأ") + ": " + message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleBookingSuccess = async (
    doctor: DoctorSummary,
    result: BookingSuccessResult,
  ) => {
    if (!profile) {
      return;
    }

    setAppointments((current) =>
      [
        ...current,
        {
          id: result.appointment.id,
          created_at: new Date().toISOString(),
          appointment_date: result.appointment.appointment_date,
          status: result.appointment.status,
          doctor_id: result.appointment.doctor_id,
          booking_selection_mode: (result.appointment.booking_selection_mode ??
            "patient_datetime") as BookingSelectionMode,
          requested_date: result.appointment.requested_date ?? null,
          requested_time: result.appointment.requested_time ?? null,
          appointment_source: "patient_request" as const,
          follow_up_visit_id: null,
          follow_up_dossier_id: null,
          follow_up_time_pending: false,
          follow_up_reminder_days: 4,
          notes: null,
          doctor: {
            full_name: doctor.full_name,
            specialty: doctor.specialty,
            address: doctor.address,
          },
        },
      ].sort(
        (left, right) =>
          getSortableTimestamp(right.created_at) -
          getSortableTimestamp(left.created_at),
      ),
    );

    await logAuditEvent({
      actorId: profile.id,
      action: "appointment_created",
      entityType: "appointment",
      entityId: result.appointment.id,
      metadata: {
        doctor_id: doctor.id,
        booking_mode: result.bookingMode,
      },
    });

    closeBookingModal();
    startTransition(() => setActiveTab("appointments"));

    if (result.bookingMode === "doctor_datetime") {
      alert(
        tr(
          "Demande envoyée. Le médecin vous proposera la date et l'heure.",
          "Request sent. The doctor will propose date and time.",
          "تم إرسال الطلب. سيقترح الطبيب التاريخ والوقت.",
        ),
      );
      return;
    }

    if (result.bookingMode === "patient_date_only") {
      alert(
        tr(
          "Demande envoyée. Le médecin fixera ensuite l'heure.",
          "Request sent. The doctor will define the time afterwards.",
          "تم إرسال الطلب. سيحدد الطبيب الساعة لاحقاً.",
        ),
      );
      return;
    }

    alert(
      tr(
        "Rendez-vous réservé avec succès.",
        "Appointment booked successfully.",
        "تم حجز الموعد بنجاح.",
      ),
    );
  };

  const specialties = Array.from(
    new Set(
      doctors.map((doc) => doc.specialty).filter((s): s is string => !!s),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const filteredDoctors = doctors.filter((doc) => {
    const normalizedSearch = deferredSearchQuery.trim().toLowerCase();
    const matchName = normalizedSearch
      ? doc.full_name?.toLowerCase().includes(normalizedSearch) ||
        doc.address?.toLowerCase().includes(normalizedSearch)
      : true;
    const matchSpec = selectedSpecialty
      ? doc.specialty === selectedSpecialty
      : true;
    const doctorAvgRating = doctorRatings[doc.id]?.avg_rating ?? 0;
    const matchMinRating = doctorAvgRating >= minimumRating;
    return matchName && matchSpec && matchMinRating;
  });
  const selectedDoctorDetailsForModal = selectedDoctorDetails
    ? toRecommendedDoctor(
        selectedDoctorDetails,
        doctorRatings[selectedDoctorDetails.id],
        computeDistanceKm(userLocation, selectedDoctorDetails),
      )
    : null;
  const selectedDoctorToBookForModal = selectedDoctorToBook
    ? toRecommendedDoctor(
        selectedDoctorToBook,
        doctorRatings[selectedDoctorToBook.id],
        computeDistanceKm(userLocation, selectedDoctorToBook),
      )
    : null;
  const isDoctorFlowModalOpen = Boolean(
    selectedDoctorDetailsForModal || selectedDoctorToBookForModal,
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "text-green-600 bg-green-100 border-green-200";
      case "pending":
        return "text-yellow-600 bg-yellow-100 border-yellow-200";
      case "cancelled":
        return "text-red-600 bg-red-100 border-red-200";
      case "completed":
        return "text-blue-600 bg-blue-100 border-blue-200";
      default:
        return "text-gray-600 bg-gray-100 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return tr("Confirmé", "Confirmed", "مؤكد");
      case "pending":
        return tr("En attente", "Pending", "قيد الانتظار");
      case "cancelled":
        return tr("Annulé", "Cancelled", "ملغى");
      case "completed":
        return tr("Terminé", "Completed", "مكتمل");
      default:
        return status;
    }
  };

  const getBookingModeLabel = (
    mode: BookingSelectionMode | null | undefined,
  ) => {
    switch (mode) {
      case "doctor_datetime":
        return tr(
          "Docteur décide date+heure",
          "Doctor chooses date+time",
          "الطبيب يحدد التاريخ والوقت",
        );
      case "patient_date_only":
        return tr(
          "Vous choisissez la date",
          "You choose the date",
          "أنت تختار التاريخ",
        );
      default:
        return tr(
          "Vous choisissez date+heure",
          "You choose date+time",
          "أنت تختار التاريخ والوقت",
        );
    }
  };

  const getAppointmentTimingLabel = (appointment: PatientAppointment) => {
    const mode = appointment.booking_selection_mode ?? "patient_datetime";

    if (appointment.follow_up_time_pending) {
      const followUpDateLabel = new Date(
        `${appointment.requested_date ?? getLocalIsoDate(new Date(appointment.appointment_date))}T00:00:00`,
      ).toLocaleDateString(locale, { dateStyle: "long" });
      return tr(
        `${followUpDateLabel} · heure à confirmer par le médecin.`,
        `${followUpDateLabel} · time will be confirmed by the doctor.`,
        `${followUpDateLabel} · سيتم تأكيد الساعة من طرف الطبيب.`,
      );
    }

    if (appointment.status !== "pending") {
      return new Date(appointment.appointment_date).toLocaleString(locale, {
        dateStyle: "long",
        timeStyle: "short",
      });
    }

    if (mode === "doctor_datetime") {
      return tr(
        "En attente de proposition complète du médecin.",
        "Waiting for the doctor's full proposal.",
        "بانتظار اقتراح كامل من الطبيب.",
      );
    }

    if (mode === "patient_date_only") {
      if (appointment.requested_date) {
        const requestedDateLabel = new Date(
          `${appointment.requested_date}T00:00:00`,
        ).toLocaleDateString(locale, { dateStyle: "long" });
        return tr(
          `${requestedDateLabel} · heure à définir par le médecin.`,
          `${requestedDateLabel} · time will be set by the doctor.`,
          `${requestedDateLabel} · سيتم تحديد الساعة من طرف الطبيب.`,
        );
      }
      return tr(
        "Date demandée transmise, heure à définir.",
        "Requested date sent, time pending.",
        "تم إرسال التاريخ المطلوب والساعة ستحدد لاحقاً.",
      );
    }

    return new Date(appointment.appointment_date).toLocaleString(locale, {
      dateStyle: "long",
      timeStyle: "short",
    });
  };

  const getAppointmentSourceLabel = (appointment: PatientAppointment) => {
    if (appointment.appointment_source === "doctor_follow_up") {
      return appointment.follow_up_time_pending
        ? tr(
            "Contrôle programmé par votre médecin · heure à confirmer",
            "Follow-up planned by your doctor · time pending",
            "متابعة مبرمجة من طبيبك · الساعة بانتظار التأكيد",
          )
        : tr(
            "Contrôle programmé par votre médecin",
            "Follow-up planned by your doctor",
            "متابعة مبرمجة من طبيبك",
          );
    }

    return null;
  };

  const getPrescriptionVisitLabel = (prescription: PatientPrescription) => {
    const visitDate = prescription.visit?.visit_date;
    const visitTime = normalizeTimeValue(prescription.visit?.visit_time, "");

    if (!visitDate) {
      const fallbackDate = new Date(
        `${prescription.prescription_date}T12:00:00`,
      );
      return Number.isNaN(fallbackDate.getTime())
        ? prescription.prescription_date
        : fallbackDate.toLocaleDateString(locale, { dateStyle: "long" });
    }

    if (visitTime) {
      return buildLocalDateTime(visitDate, visitTime).toLocaleString(locale, {
        dateStyle: "long",
        timeStyle: "short",
      });
    }

    return new Date(`${visitDate}T00:00:00`).toLocaleDateString(locale, {
      dateStyle: "long",
    });
  };

  const openPrescriptionCopy = (publicToken: string, print = false) => {
    if (typeof window === "undefined") {
      return;
    }

    const url = buildPrescriptionPublicUrl(publicToken, {
      configuredOrigin: process.env.NEXT_PUBLIC_APP_BASE_URL,
      runtimeOrigin: window.location.origin,
      print,
    });
    if (!url) {
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const navButtonClasses = (isActive: boolean) =>
    `group flex w-full min-h-[62px] items-center gap-3 rounded-[22px] border px-4 py-3 text-start transition-all duration-200 ${
      isActive
        ? "border-blue-200 bg-gradient-to-r from-blue-50 to-white text-blue-700 font-semibold shadow-[0_18px_40px_-28px_rgba(37,99,235,0.7)] dark:border-blue-500/25 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.94))] dark:text-slate-50 dark:shadow-[0_18px_40px_-28px_rgba(59,130,246,0.45)]"
        : "border-slate-200/80 bg-white/80 text-gray-600 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900/95"
    }`;

  const navIconClasses = (isActive: boolean) =>
    `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors ${
      isActive
        ? "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-300/60 dark:bg-blue-100 dark:text-blue-700"
        : "border-slate-200 bg-slate-50 text-slate-500 group-hover:border-slate-300 group-hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:group-hover:border-slate-500 dark:group-hover:bg-slate-700"
    }`;

  const mobileSectionTitle = (
    {
      overview: t("dashboard.patient.overview"),
      search: t("dashboard.patient.search"),
      appointments: t("dashboard.patient.appointments"),
      prescriptions: tr("Ordonnances", "Prescriptions", "الوصفات"),
      favorites: tr("Mes favoris", "My favorites", "المفضلات"),
      community: t("dashboard.patient.community"),
      settings: t("dashboard.patient.settings"),
      "ai-assistant": t("common.aiAssistant"),
    } as const
  )[activeTab];

  const visibleCommunityArticles =
    communityView === "saved"
      ? articles.filter((article) => article.saved_by_me)
      : articles;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  return (
    <div
      className={`h-screen overflow-hidden bg-gray-50 dark:bg-slate-950 ${isEmbedded ? "block" : "flex flex-col"} font-sans transition-colors duration-200`}
    >
      {!isEmbedded ? (
        <>
          {/* Mobile Overlay for Nav (Keeping this) */}
          {isMobileNavOpen ? (
            <button
              type="button"
              aria-label="Fermer la navigation"
              onClick={() => setIsMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm"
            />
          ) : null}
        </>
      ) : null}

      {/* Fixed Desktop Top Bar removed (merged into tabs) */}

      {/* Sidebar Content */}
      {!isEmbedded ? (
        <aside
          className={`fixed inset-y-0 start-0 z-50 flex w-[min(86vw,340px)] max-w-sm flex-col border-e border-gray-200 bg-white shadow-2xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-950 ${isMobileNavOpen ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full"} ${isDesktopNavVisible ? "md:translate-x-0 rtl:md:translate-x-0 ltr:md:translate-x-0" : "rtl:md:translate-x-full ltr:md:-translate-x-full"}`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-slate-800 md:p-6 md:pb-8">
            <Link href="/">
              <Logo className="scale-110 origin-left" />
            </Link>
            <div className="hidden items-center gap-3 md:flex">
              <Link
                href="/"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-900 text-slate-100 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.9)] transition hover:scale-[1.02] hover:bg-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                aria-label={tr("Accueil", "Home", "الرئيسية")}
                title={tr("Accueil", "Home", "الرئيسية")}
              >
                <Home size={18} />
              </Link>
              <button
                type="button"
                onClick={() => setIsDesktopNavVisible(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-900 text-slate-100 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.9)] transition hover:scale-[1.02] hover:bg-slate-800 md:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                aria-label="Masquer la navigation"
                title="Masquer la navigation"
              >
                <Menu size={18} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 shadow-sm transition hover:bg-slate-100 md:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Fermer la navigation"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-grow flex-col gap-2 overflow-y-auto p-4 md:p-6">
            <Link
              href="/"
              onClick={() => setIsMobileNavOpen(false)}
              className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 md:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                <Home size={18} />
              </span>
              <span>{t("common.home")}</span>
            </Link>
            <button
              onClick={() => {
                setActiveTab("overview");
                setIsMobileNavOpen(false);
              }}
              className={navButtonClasses(activeTab === "overview")}
            >
              <span className={navIconClasses(activeTab === "overview")}>
                <Activity size={18} />
              </span>
              <span>{t("dashboard.patient.overview")}</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("search");
                setIsMobileNavOpen(false);
              }}
              className={navButtonClasses(activeTab === "search")}
            >
              <span className={navIconClasses(activeTab === "search")}>
                <Search size={18} />
              </span>
              <span>{t("dashboard.patient.search")}</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("appointments");
                setIsMobileNavOpen(false);
              }}
              className={navButtonClasses(activeTab === "appointments")}
            >
              <span className={navIconClasses(activeTab === "appointments")}>
                <Calendar size={18} />
              </span>
              <span>{t("dashboard.patient.appointments")}</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("prescriptions");
                setIsMobileNavOpen(false);
              }}
              className={navButtonClasses(activeTab === "prescriptions")}
            >
              <span className={navIconClasses(activeTab === "prescriptions")}>
                <FileText size={18} />
              </span>
              <span>{tr("Ordonnances", "Prescriptions", "الوصفات")}</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("favorites");
                setIsMobileNavOpen(false);
              }}
              className={navButtonClasses(activeTab === "favorites")}
            >
              <span className={navIconClasses(activeTab === "favorites")}>
                <Heart size={18} />
              </span>
              <span>{tr("Mes favoris", "My favorites", "المفضلات")}</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("community");
                setIsMobileNavOpen(false);
              }}
              className={navButtonClasses(activeTab === "community")}
            >
              <span className={navIconClasses(activeTab === "community")}>
                <MessageCircle size={18} />
              </span>
              <span>{t("dashboard.patient.community")}</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("ai-assistant");
                setIsMobileNavOpen(false);
              }}
              className={navButtonClasses(activeTab === "ai-assistant")}
            >
              <span className={navIconClasses(activeTab === "ai-assistant")}>
                <img
                  src="/images/mofid.jpg"
                  alt="MOFID"
                  className="h-[18px] w-[18px] rounded-md object-cover"
                />
              </span>
              <span>MOFID (AI assistant)</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("settings");
                setIsMobileNavOpen(false);
              }}
              className={navButtonClasses(activeTab === "settings")}
            >
              <span className={navIconClasses(activeTab === "settings")}>
                <Settings size={18} />
              </span>
              <span>{t("dashboard.patient.settings")}</span>
            </button>
          </div>
          <div className="mt-auto border-t border-gray-100 p-4 dark:border-slate-800 md:p-6">
            <div className="mb-4 flex items-center gap-3 md:mb-6">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile?.full_name || tr("Patient", "Patient", "مريض")}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold uppercase border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                  {profile?.full_name?.substring(0, 2) || "PA"}
                </div>
              )}
              <div className="overflow-hidden flex flex-col justify-center">
                <div className="mb-0.5 flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate leading-tight">
                    {profile?.full_name ||
                      profile?.email?.split("@")[0] ||
                      tr("Mon compte", "My account", "حسابي")}
                  </p>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 uppercase tracking-wider shrink-0">
                    {profile?.account_type === "doctor"
                      ? tr("Docteur", "Doctor", "طبيب")
                      : tr("Patient", "Patient", "مريض")}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-500 truncate">
                  {profile?.account_type === "doctor"
                    ? localizeSpecialty(
                        profile?.specialty ??
                          tr(
                            "Spécialité non renseignée",
                            "Specialty not provided",
                            "التخصص غير محدد",
                          ),
                      )
                    : tr("Compte patient", "Patient account", "حساب مريض")}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-500 truncate">
                  {profile?.email}
                </p>
              </div>
            </div>
            <div className="mb-4 md:hidden">
              <ThemeToggle variant="inline" className="justify-between" />
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:hover:bg-red-950/20 md:justify-start md:px-0 md:py-0 md:border-0"
            >
              <LogOut size={16} /> <span>{t("common.signOut")}</span>
            </button>
          </div>
        </aside>
      ) : null}
      {/* Content wrapper: sidebar (above) + AI overlay + regular main tabs */}
      <div
        className={`relative flex min-w-0 flex-1 flex-col overflow-hidden transition-[margin,padding] duration-300 ${activeTab === "ai-assistant" ? (isDesktopNavVisible ? "md:ms-[340px] pt-0 md:pt-0" : "ms-0 md:ms-0 pt-0 md:pt-0") : isDesktopNavVisible ? "md:ms-[340px] pt-0 md:pt-0" : "ms-0 md:ms-0 pt-0 md:pt-0"}`}
      >
        {/* Unified Global Header for all non-AI tabs */}
        {activeTab !== "ai-assistant" && !isEmbedded && (
          <div className="flex-none flex items-center justify-between px-4 md:px-8 py-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3">
              {/* Menu button (Mobile) */}
              <button
                onClick={() => setIsMobileNavOpen(true)}
                className="md:hidden text-slate-600 dark:text-blue-400 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <Menu size={20} />
              </button>
              {/* Show Sidebar button (Desktop - if hidden) */}
              {!isDesktopNavVisible && (
                <div className="hidden items-center gap-3 md:flex">
                  <Link
                    href="/"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-900 text-slate-100 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.9)] transition hover:scale-[1.02] hover:bg-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    aria-label={tr("Accueil", "Home", "الرئيسية")}
                    title={tr("Accueil", "Home", "الرئيسية")}
                  >
                    <Home size={18} />
                  </Link>
                  <button
                    onClick={() => setIsDesktopNavVisible(true)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-900 text-slate-100 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.9)] transition hover:scale-[1.02] hover:bg-slate-800 md:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    aria-label="Afficher la navigation"
                    title="Afficher la navigation"
                  >
                    <Menu size={18} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <Logo className="scale-90 origin-left" />
                  <span className="hidden sm:inline-block h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate max-w-[120px]">
                    {mobileSectionTitle}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2" />
          </div>
        )}
        {/* AI Assistant always mounted — toggled via visibility to preserve state */}
        <div
          className={`relative z-10 flex-col flex-1 h-full min-h-0 transition-all duration-300 ${activeTab === "ai-assistant" ? "flex" : "hidden"}`}
        >
          <AiAssistantView
            embedded
            onToggleNav={() => {
              if (window.innerWidth >= 768) {
                setIsDesktopNavVisible(!isDesktopNavVisible);
              } else {
                setIsMobileNavOpen(true);
              }
            }}
            isNavVisible={isDesktopNavVisible}
          />
        </div>

        <main
          className={`flex-1 ${activeTab === "ai-assistant" ? "hidden" : isEmbedded ? "overflow-y-auto p-4 sm:p-5 md:p-6" : "overflow-y-auto p-4 sm:p-5 md:p-6 lg:p-8"}`}
        >
          <AnimatePresence mode="wait">
            {/* TAB: OVERVIEW */}
            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="mb-10">
                  {(() => {
                    const greetingName =
                      profile?.full_name?.split(" ")[0] ||
                      t("dashboard.patient.defaultName");
                    return (
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-50 mb-2">
                        {language === "ar"
                          ? `مرحباً، \u202A${greetingName}\u202C 👋`
                          : t("dashboard.patient.greeting", {
                              name: greetingName,
                            })}
                      </h1>
                    );
                  })()}
                  <p className="text-gray-500 dark:text-slate-400">
                    {t("dashboard.patient.welcome")}
                  </p>
                </div>

                {(() => {
                  const moderationStatus =
                    accountEligibility?.emailBlocked
                      ? "permanently_blocked"
                      : accountEligibility?.moderationStatus ??
                        profile?.moderation_status ??
                        "active";
                  const moderationReason =
                    accountEligibility?.block?.reason?.trim() ||
                    accountEligibility?.moderationReason?.trim() ||
                    profile?.moderation_reason?.trim() ||
                    null;
                  const isWarning = moderationStatus === "warned";
                  const isBlocked =
                    accountEligibility?.emailBlocked ||
                    moderationStatus === "temporarily_blocked" ||
                    moderationStatus === "permanently_blocked";

                  if (!isWarning && !isBlocked) {
                    return null;
                  }

                  return (
                    <div
                      className={`mb-8 rounded-[2rem] border p-6 ${
                        isWarning
                          ? "border-amber-200 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-950/20"
                          : "border-rose-200 bg-rose-50/70 dark:border-rose-500/25 dark:bg-rose-950/20"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                            isWarning
                              ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
                              : "bg-rose-100 text-rose-600 dark:bg-rose-900/35 dark:text-rose-300"
                          }`}
                        >
                          <AlertTriangle size={24} />
                        </div>
                        <div className="min-w-0">
                          <h3
                            className={`text-lg font-bold ${
                              isWarning
                                ? "text-amber-900 dark:text-amber-100"
                                : "text-rose-900 dark:text-rose-100"
                            }`}
                          >
                            {isWarning
                              ? tr(
                                  "Avertissement de l'administration",
                                  "Administrative warning",
                                  "تحذير من الإدارة",
                                )
                              : tr(
                                  "Compte bloqué ou restreint",
                                  "Account blocked or restricted",
                                  "الحساب محظور أو مقيّد",
                                )}
                          </h3>
                          <p
                            className={`mt-1 text-sm ${
                              isWarning
                                ? "text-amber-800/80 dark:text-amber-300/85"
                                : "text-rose-800/80 dark:text-rose-200/85"
                            }`}
                          >
                            {moderationReason ||
                              (isWarning
                                ? tr(
                                    "L'administration vous a envoyé un avertissement. Merci de respecter les règles de la communauté.",
                                    "The administration sent you a warning. Please respect the community rules.",
                                    "أرسلت لك الإدارة تحذيراً. يرجى احترام قواعد المجتمع.",
                                  )
                                : tr(
                                    "Votre compte a été limité par l'administration TERIAQ. Certaines actions peuvent être suspendues jusqu'à nouvelle décision.",
                                    "Your account has been limited by TERIAQ administration. Some actions may remain suspended until the next review.",
                                    "تم تقييد حسابك من طرف إدارة ترياق. قد تبقى بعض الإجراءات معلقة حتى قرار جديد.",
                                  ))}
                          </p>
                          {accountEligibility?.block?.handledByAdminLabel ? (
                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              {tr("Décision admin", "Admin decision", "قرار الإدارة")}:
                              {" "}
                              {accountEligibility.block.handledByAdminLabel}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {appointmentsAwaitingReview.length > 0 ||
                urgentAppointmentsWithinHour.length > 0 ||
                pinnedAppointmentsWithin48h.length > 0 ||
                todayAppointments.length > 0 ? (
                  <div className="mb-8 space-y-4">
                    {appointmentsAwaitingReview.length > 0 ? (
                      <div className="rounded-[2rem] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.96))] p-5 shadow-[0_24px_70px_-42px_rgba(16,185,129,0.35)] dark:border-emerald-500/20 dark:bg-[linear-gradient(135deg,rgba(6,44,33,0.96),rgba(15,23,42,0.98))]">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <Star size={13} />
                              {tr(
                                "Après la visite",
                                "After your visit",
                                "بعد الزيارة",
                              )}
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                              {tr(
                                "Vous pouvez noter votre médecin maintenant.",
                                "You can rate your doctor now.",
                                "يمكنك تقييم طبيبك الآن.",
                              )}
                            </h3>
                            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                              {tr(
                                "Dès qu'une consultation est terminée, ce rappel reste épinglé ici jusqu'à l'envoi de votre avis.",
                                "As soon as a consultation is completed, this reminder stays pinned here until you submit your review.",
                                "بمجرد انتهاء الاستشارة يبقى هذا التذكير مثبتاً هنا حتى ترسل تقييمك.",
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              openReviewModal(appointmentsAwaitingReview[0])
                            }
                            className="w-fit rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                          >
                            {tr("Noter maintenant", "Rate now", "قيّم الآن")}
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          {appointmentsAwaitingReview
                            .slice(0, 4)
                            .map((appointment) => (
                              <button
                                key={`review-${appointment.id}`}
                                type="button"
                                onClick={() => openReviewModal(appointment)}
                                className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/60 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-emerald-900/50 dark:hover:bg-emerald-950/20"
                              >
                                <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                                  Dr.{" "}
                                  {appointment.doctor?.full_name ??
                                    tr("Médecin", "Doctor", "طبيب")}
                                </p>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                  {getAppointmentTimingLabel(appointment)}
                                </p>
                                <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                  {tr(
                                    "Touchez pour laisser une note et un commentaire.",
                                    "Tap to leave a rating and a comment.",
                                    "اضغط لترك تقييم وتعليق.",
                                  )}
                                </p>
                              </button>
                            ))}
                        </div>
                      </div>
                    ) : null}

                    {urgentAppointmentsWithinHour.length > 0 ? (
                      <div className="rounded-[2rem] border border-rose-200 bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,255,255,0.96))] p-5 shadow-[0_24px_70px_-42px_rgba(244,63,94,0.45)] dark:border-rose-500/20 dark:bg-[linear-gradient(135deg,rgba(68,17,32,0.96),rgba(15,23,42,0.98))]">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                              <Clock size={13} />
                              {tr(
                                "Alerte immédiate",
                                "Immediate alert",
                                "تنبيه فوري",
                              )}
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                              {tr(
                                "Un rendez-vous commence dans moins d'une heure.",
                                "An appointment starts in less than one hour.",
                                "يوجد موعد يبدأ خلال أقل من ساعة.",
                              )}
                            </h3>
                            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                              {tr(
                                "Préparez vos documents et vérifiez l'adresse du cabinet avant de partir.",
                                "Prepare your documents and check the clinic address before leaving.",
                                "حضّر وثائقك وتحقق من عنوان العيادة قبل الانطلاق.",
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveTab("appointments")}
                            className="w-fit rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700"
                          >
                            {tr(
                              "Voir mes RDV",
                              "View my appointments",
                              "عرض مواعيدي",
                            )}
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3">
                          {urgentAppointmentsWithinHour
                            .slice(0, 3)
                            .map((appointment) => (
                              <div
                                key={`urgent-${appointment.id}`}
                                className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60"
                              >
                                <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                                  Dr.{" "}
                                  {appointment.doctor?.full_name ??
                                    tr("Médecin", "Doctor", "طبيب")}
                                </p>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                  {getAppointmentTimingLabel(appointment)}
                                </p>
                                {getAppointmentSourceLabel(appointment) ? (
                                  <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300">
                                    {getAppointmentSourceLabel(appointment)}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}

                    {pinnedAppointmentsWithin48h.length > 0 ? (
                      <div className="rounded-[2rem] border border-blue-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.98),rgba(255,255,255,0.96))] p-5 shadow-[0_24px_70px_-42px_rgba(59,130,246,0.35)] dark:border-blue-500/20 dark:bg-[linear-gradient(135deg,rgba(15,30,58,0.96),rgba(15,23,42,0.98))]">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                              <Calendar size={13} />
                              {tr(
                                "Rappels épinglés",
                                "Pinned reminders",
                                "تذكيرات مثبتة",
                              )}
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                              {tr(
                                "Vos rendez-vous des 48 prochaines heures.",
                                "Your appointments for the next 48 hours.",
                                "مواعيدك خلال الثماني والأربعين ساعة القادمة.",
                              )}
                            </h3>
                            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                              {tr(
                                "Ce bloc reste visible sur l'accueil pour ne rien manquer.",
                                "This block stays visible on the home dashboard so you do not miss anything.",
                                "يبقى هذا القسم ظاهراً في الصفحة الرئيسية حتى لا يفوتك أي موعد.",
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveTab("appointments")}
                            className="w-fit rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                          >
                            {tr(
                              "Ouvrir les RDV",
                              "Open appointments",
                              "فتح المواعيد",
                            )}
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          {pinnedAppointmentsWithin48h
                            .slice(0, 4)
                            .map((appointment) => (
                              <div
                                key={`48h-${appointment.id}`}
                                className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                                      Dr.{" "}
                                      {appointment.doctor?.full_name ??
                                        tr("Médecin", "Doctor", "طبيب")}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                      {getAppointmentTimingLabel(appointment)}
                                    </p>
                                  </div>
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-bold border ${getStatusColor(appointment.status)}`}
                                  >
                                    {getStatusLabel(appointment.status)}
                                  </span>
                                </div>
                                {getAppointmentSourceLabel(appointment) ? (
                                  <p className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                                    {getAppointmentSourceLabel(appointment)}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}

                    {todayAppointments.length > 0 ? (
                      <div className="rounded-[2rem] border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.96))] p-5 shadow-[0_24px_70px_-42px_rgba(245,158,11,0.35)] dark:border-amber-500/20 dark:bg-[linear-gradient(135deg,rgba(49,37,10,0.96),rgba(15,23,42,0.98))]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                              <Clock size={13} />
                              {tr("Aujourd'hui", "Today", "اليوم")}
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                              {tr(
                                "Les rendez-vous du jour avec heure affichée.",
                                "Today's appointments with their times.",
                                "مواعيد اليوم مع الساعة المعروضة.",
                              )}
                            </h3>
                          </div>
                          <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm dark:bg-slate-900/70 dark:text-slate-200">
                            {todayAppointments.length}{" "}
                            {tr("aujourd'hui", "today", "اليوم")}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3">
                          {todayAppointments.slice(0, 4).map((appointment) => (
                            <div
                              key={`today-${appointment.id}`}
                              className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60"
                            >
                              <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                                Dr.{" "}
                                {appointment.doctor?.full_name ??
                                  tr("Médecin", "Doctor", "طبيب")}
                              </p>
                              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                {getAppointmentTimingLabel(appointment)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                  <div
                    onClick={() => setActiveTab("search")}
                    className="group bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2rem] p-8 text-white shadow-2xl shadow-blue-500/30 dark:shadow-none cursor-pointer transform hover:scale-[1.03] transition-all relative overflow-hidden"
                  >
                    <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700">
                      <Search className="text-white" size={160} />
                    </div>
                    <div className="bg-white/20 w-14 h-14 rounded-2xl backdrop-blur-md flex items-center justify-center mb-6 border border-white/20">
                      <Search className="text-white" size={28} />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-2xl font-black mb-1">
                        {tr("Prendre RDV", "Book appointment", "حجز موعد")}
                      </h3>
                      <p className="text-blue-50/80 text-sm font-medium">
                        {tr(
                          "Recherchez un spécialiste près de chez vous",
                          "Find a nearby specialist",
                          "ابحث عن أخصائي قريب منك",
                        )}
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveTab("appointments")}
                    className="group bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none cursor-pointer transform hover:scale-[1.03] transition-all relative overflow-hidden"
                  >
                    <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 text-blue-500">
                      <Calendar size={160} />
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                      <Calendar size={28} />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-2xl font-black mb-1 text-slate-900 dark:text-slate-100">
                        {appointments.length}{" "}
                        {tr("RDV", "appointments", "موعد")}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                        {tr(
                          "Consultez votre historique et vos RDV à venir",
                          "View your history and upcoming appointments",
                          "راجع السجل والمواعيد القادمة",
                        )}
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveTab("community")}
                    className="group bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none cursor-pointer transform hover:scale-[1.03] transition-all relative overflow-hidden"
                  >
                    <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 text-purple-500">
                      <FileText size={160} />
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50">
                      <FileText size={28} />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-2xl font-black mb-1 text-slate-800 dark:text-slate-100">
                        {tr("Actualités", "News", "آخر المستجدات")}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                        {tr(
                          "Découvrez de nouveaux conseils santé",
                          "Discover new health guidance",
                          "اكتشف نصائح صحية جديدة",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: SEARCH DOCTORS */}
            {activeTab === "search" && (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
                    <MapIcon className="text-blue-600" />{" "}
                    {tr(
                      "Trouver un praticien",
                      "Find a practitioner",
                      "البحث عن ممارس",
                    )}
                  </h2>
                  <button
                    onClick={handleManualRefresh}
                    disabled={isManualRefreshing}
                    className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <RefreshCw
                      size={16}
                      className={isManualRefreshing ? "animate-spin" : ""}
                    />
                    {t("admin.refresh")}
                    {hasDeferredRefresh ? (
                      <span
                        className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  <div className="flex-1 relative">
                    <Search
                      className="absolute start-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder={tr(
                        "Nom du médecin, clinique...",
                        "Doctor name, clinic...",
                        "اسم الطبيب أو العيادة...",
                      )}
                      className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-slate-100"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="w-full">
                    <select
                      className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-gray-600 dark:text-slate-300 font-medium"
                      value={selectedSpecialty}
                      onChange={(e) => setSelectedSpecialty(e.target.value)}
                    >
                      <option value="">
                        {tr(
                          "Toutes les spécialités",
                          "All specialties",
                          "كل التخصصات",
                        )}
                      </option>
                      {specialties.map((specialtyOption) => (
                        <option key={specialtyOption} value={specialtyOption}>
                          {localizeSpecialty(specialtyOption)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full">
                    <select
                      className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-gray-600 dark:text-slate-300 font-medium"
                      value={minimumRating}
                      onChange={(event) =>
                        setMinimumRating(Number(event.target.value))
                      }
                    >
                      <option value={0}>
                        {tr(
                          "Note min: toutes",
                          "Min rating: all",
                          "الحد الأدنى للتقييم: الكل",
                        )}
                      </option>
                      <option value={3}>
                        {tr(
                          "Note min: 3.0+",
                          "Min rating: 3.0+",
                          "الحد الأدنى للتقييم: 3.0+",
                        )}
                      </option>
                      <option value={4}>
                        {tr(
                          "Note min: 4.0+",
                          "Min rating: 4.0+",
                          "الحد الأدنى للتقييم: 4.0+",
                        )}
                      </option>
                      <option value={4.5}>
                        {tr(
                          "Note min: 4.5+",
                          "Min rating: 4.5+",
                          "الحد الأدنى للتقييم: 4.5+",
                        )}
                      </option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <label className="text-xs font-semibold text-gray-500 mb-2 flex justify-between">
                      <span>
                        {tr(
                          "Rayon de recherche",
                          "Search radius",
                          "نطاق البحث",
                        )}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">
                        {searchRadius} km
                      </span>
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={500}
                      step={5}
                      value={searchRadius}
                      onChange={(e) => setSearchRadius(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>

                {/* OpenStreetMap Gratuite Integration (Leaflet) */}
                <div className="w-full h-80 bg-slate-200 dark:bg-slate-800 rounded-3xl mb-8 overflow-hidden relative shadow-inner">
                  <MapComponent
                    doctors={filteredDoctors}
                    userLocation={userLocation}
                    onDoctorClick={openDoctorDetails}
                    zoomControlPosition={
                      language === "ar" ? "topleft" : "topright"
                    }
                  />

                  {/* Bouton de geolocalisation */}
                  {!isDoctorFlowModalOpen ? (
                    <div
                      className={`absolute top-4 z-10 overflow-hidden ${language === "ar" ? "right-4" : "left-4"}`}
                    >
                      <button
                        onClick={() => {
                          void handleGeolocate();
                        }}
                        disabled={isResolvingLocation}
                        className="bg-white/90 dark:bg-slate-900/90 backdrop-blur p-3 rounded-xl shadow-md border border-gray-100 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 text-gray-600 dark:text-slate-300 transition flex items-center justify-center disabled:opacity-70"
                        title={tr(
                          "Me géolocaliser",
                          "Locate me",
                          "تحديد موقعي",
                        )}
                      >
                        <Crosshair
                          size={22}
                          className={
                            isResolvingLocation
                              ? "animate-pulse text-blue-500"
                              : userLocation
                                ? "text-blue-500"
                                : ""
                          }
                        />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredDoctors.map((doc) => {
                    const ratingRow = doctorRatings[doc.id];
                    const avgRating = ratingRow?.avg_rating ?? 0;
                    const totalReviews = ratingRow?.total_reviews ?? 0;
                    const filledStars = Math.round(avgRating);

                    return (
                      <div
                        key={doc.id}
                        onClick={() => openDoctorDetails(doc)}
                        className="bg-white dark:bg-slate-950 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl transition-shadow group relative overflow-hidden cursor-pointer"
                      >
                        <div className="absolute top-0 end-0 p-4 flex flex-col gap-2 items-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteDoctor(doc);
                            }}
                            className={`p-2 rounded-xl transition-all shadow-sm ${favoriteDoctors.some((f) => f.id === doc.id) ? "bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400 border border-rose-100 dark:border-rose-800" : "bg-white/80 dark:bg-slate-900/80 text-gray-400 dark:text-slate-600 border border-gray-100 dark:border-slate-800 hover:text-rose-500"}`}
                          >
                            <Heart
                              size={18}
                              className={
                                favoriteDoctors.some((f) => f.id === doc.id)
                                  ? "fill-current"
                                  : ""
                              }
                            />
                          </button>
                          <div className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-yellow-100 dark:border-yellow-800/50">
                            <div className="flex items-center gap-0.5 justify-center">
                              {Array.from({ length: 5 }).map((_, index) => (
                                <Star
                                  key={`${doc.id}-rating-${index}`}
                                  size={12}
                                  className={
                                    index < filledStars
                                      ? "fill-current text-yellow-500"
                                      : "text-yellow-300 dark:text-yellow-700"
                                  }
                                />
                              ))}
                            </div>
                            <p className="text-center mt-0.5">
                              {totalReviews > 0
                                ? `${avgRating.toFixed(1)} (${totalReviews})`
                                : tr("Nouveau", "New", "جديد")}
                            </p>
                          </div>
                        </div>
                        {doc.avatar_url ? (
                          <img
                            src={doc.avatar_url}
                            alt={
                              doc.full_name || tr("Docteur", "Doctor", "طبيب")
                            }
                            className="w-16 h-16 rounded-full object-cover mb-4 border-2 border-white dark:border-slate-800 shadow-sm"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-emerald-100 dark:from-blue-900 dark:to-emerald-900 rounded-full flex items-center justify-center text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 border-2 border-white dark:border-slate-800 shadow-sm transition-colors">
                            {doc.full_name?.substring(0, 2).toUpperCase() ||
                              "DR"}
                          </div>
                        )}
                        <h3 className="font-bold text-lg text-gray-900 dark:text-slate-100 mb-1">
                          Dr. {doc.full_name}{" "}
                          {doc.gender === "Homme" ||
                          doc.gender === "Male" ||
                          doc.gender === "ذكر"
                            ? "👨"
                            : doc.gender === "Femme" ||
                                doc.gender === "Female" ||
                                doc.gender === "أنثى"
                              ? "👩"
                              : ""}
                        </h3>
                        <p className="text-blue-600 dark:text-blue-400 font-medium text-sm mb-3">
                          {localizeSpecialty(doc.specialty)}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2 mb-4 line-clamp-1">
                          <MapPin size={14} className="shrink-0" />{" "}
                          {doc.address ||
                            tr(
                              "Adresse non renseignée",
                              "Address not provided",
                              "العنوان غير متوفر",
                            )}
                        </p>
                        <DoctorPublicLinks doctor={doc} className="mb-4" />

                        <a
                          href={
                            doc.google_maps_link ||
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(doc.address || "")}+${doc.latitude},${doc.longitude}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition mb-4 shadow-sm"
                        >
                          <MapPin size={18} />{" "}
                          {tr("Itinéraire", "Directions", "الاتجاهات")}
                        </a>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          {getBookingModeLabel(doc.appointment_booking_mode)}
                        </p>

                        {/* Affichage des états spéciaux (Congé / Désactivé) */}
                        {doc.is_accepting_appointments === false ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              alert(
                                tr(
                                  "Ce docteur a désactivé la prise de RDV temporairement.",
                                  "This doctor has temporarily disabled appointments.",
                                  "هذا الطبيب أوقف حجز المواعيد مؤقتاً.",
                                ),
                              );
                            }}
                            className="w-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 py-3 rounded-xl font-bold border border-slate-300 dark:border-slate-700 transition line-clamp-1 px-2"
                          >
                            ❌{" "}
                            {tr(
                              "Rendez-vous suspendus",
                              "Appointments suspended",
                              "المواعيد موقوفة",
                            )}
                          </button>
                        ) : isDoctorOnVacation(doc) ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              alert(getVacationLabelLocalized(doc));
                            }}
                            className="w-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 py-3 rounded-xl font-bold border border-orange-100 dark:border-orange-800 hover:bg-orange-100 transition truncate px-2"
                          >
                            🏖️ {tr("En congé", "On vacation", "في عطلة")}
                          </button>
                        ) : (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              openBookingModal(doc);
                            }}
                            className="w-full bg-slate-900 dark:bg-blue-600 text-white py-3 rounded-xl font-medium shadow-md shadow-slate-900/20 dark:shadow-blue-900/20 hover:bg-slate-800 dark:hover:bg-blue-500 transform hover:-translate-y-0.5 transition flex justify-center items-center gap-2"
                          >
                            {tr("Prendre RDV", "Book appointment", "حجز موعد")}{" "}
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {filteredDoctors.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-400">
                      <Search size={48} className="mx-auto mb-4 opacity-50" />
                      <p>
                        {tr(
                          "Aucun médecin trouvé pour cette recherche ou dans ce périmètre.",
                          "No doctor found for this search or within this area.",
                          "لم يتم العثور على طبيب ضمن هذا البحث أو هذا النطاق.",
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB: MY APPOINTMENTS */}
            {activeTab === "appointments" && (
              <motion.div
                key="appointments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                    <Calendar className="text-blue-600" />{" "}
                    {tr(
                      "Gérer mes rendez-vous",
                      "Manage my appointments",
                      "إدارة مواعيدي",
                    )}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        {tr("Tri", "Sort", "الترتيب")}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAppointmentsSortOrder("desc")}
                        className={getSortButtonClasses(
                          appointmentsSortOrder === "desc",
                        )}
                      >
                        {tr(
                          "Ajouts récents",
                          "Recent additions",
                          "أحدث الإضافات",
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAppointmentsSortOrder("asc")}
                        className={getSortButtonClasses(
                          appointmentsSortOrder === "asc",
                        )}
                      >
                        {tr(
                          "Ajouts anciens",
                          "Oldest additions",
                          "أقدم الإضافات",
                        )}
                      </button>
                    </div>
                    <button
                      onClick={handleManualRefresh}
                      disabled={isManualRefreshing}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <RefreshCw
                        size={16}
                        className={isManualRefreshing ? "animate-spin" : ""}
                      />{" "}
                      {t("admin.refresh")}
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-950 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                  {appointments.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Calendar
                          className="text-gray-300 dark:text-slate-600"
                          size={32}
                        />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">
                        {tr(
                          "Aucun rendez-vous",
                          "No appointments",
                          "لا توجد مواعيد",
                        )}
                      </h3>
                      <p className="text-gray-500 dark:text-slate-400 mb-6">
                        {tr(
                          "Vous n'avez pas encore planifié de consultation.",
                          "You have not scheduled any consultation yet.",
                          "لم تقم بجدولة أي استشارة بعد.",
                        )}
                      </p>
                      <button
                        onClick={() => setActiveTab("search")}
                        className="bg-blue-600 text-white px-6 py-2 rounded-full font-medium shadow hover:bg-blue-700 transition"
                      >
                        {tr(
                          "Trouver un médecin",
                          "Find a doctor",
                          "البحث عن طبيب",
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:border-slate-800">
                      {sortedAppointments.map((appt) => (
                        <div
                          key={appt.id}
                          className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
                              <Clock size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-900 dark:text-slate-100 text-lg">
                                Dr. {appt.doctor?.full_name}
                              </h4>
                              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                                {localizeSpecialty(appt.doctor?.specialty)}
                              </p>
                              <div className="text-sm text-gray-500 dark:text-slate-500 flex items-center gap-2">
                                <Calendar size={14} />{" "}
                                {getAppointmentTimingLabel(appt)}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {getBookingModeLabel(
                                  appt.booking_selection_mode,
                                )}
                              </p>
                              {getAppointmentSourceLabel(appt) ? (
                                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mt-1">
                                  {getAppointmentSourceLabel(appt)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(appt.status)}`}
                            >
                              {getStatusLabel(appt.status)}
                            </span>
                            {appt.status === "completed" &&
                              !reviewsByAppointmentId[appt.id] && (
                                <button
                                  onClick={() => openReviewModal(appt)}
                                  className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"
                                >
                                  <Star size={14} />{" "}
                                  {tr(
                                    "Laisser un avis",
                                    "Leave a review",
                                    "إضافة تقييم",
                                  )}
                                </button>
                              )}
                            {appt.status === "completed" &&
                              reviewsByAppointmentId[appt.id] && (
                                <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                                  {tr(
                                    "Avis envoyé",
                                    "Review sent",
                                    "تم إرسال التقييم",
                                  )}{" "}
                                  · {reviewsByAppointmentId[appt.id].rating}/5
                                </span>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB: PRESCRIPTIONS */}
            {activeTab === "prescriptions" && (
              <motion.div
                key="prescriptions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
                    <FileText className="text-blue-600" />
                    {tr("Mes ordonnances", "My prescriptions", "وصفاتي الطبية")}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        {tr("Tri", "Sort", "الترتيب")}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPrescriptionsSortOrder("desc")}
                        className={getSortButtonClasses(
                          prescriptionsSortOrder === "desc",
                        )}
                      >
                        {tr(
                          "Ajouts récents",
                          "Recent additions",
                          "أحدث الإضافات",
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrescriptionsSortOrder("asc")}
                        className={getSortButtonClasses(
                          prescriptionsSortOrder === "asc",
                        )}
                      >
                        {tr(
                          "Ajouts anciens",
                          "Oldest additions",
                          "أقدم الإضافات",
                        )}
                      </button>
                    </div>
                    <button
                      onClick={handleManualRefresh}
                      disabled={isManualRefreshing}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <RefreshCw
                        size={16}
                        className={isManualRefreshing ? "animate-spin" : ""}
                      />{" "}
                      {t("admin.refresh")}
                    </button>
                  </div>
                </div>

                {sortedPrescriptions.length === 0 ? (
                  <div className="rounded-[2.5rem] border border-slate-200/70 bg-white/80 p-14 text-center shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950/60 dark:shadow-none">
                    <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
                      <FileText
                        size={40}
                        className="text-blue-200 dark:text-blue-800"
                      />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {tr(
                        "Aucune ordonnance pour le moment",
                        "No prescriptions yet",
                        "لا توجد وصفات حالياً",
                      )}
                    </h3>
                    <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">
                      {tr(
                        "Les ordonnances créées par vos médecins apparaîtront ici avec la date de consultation et un accès direct à l'impression ou au PDF.",
                        "Prescriptions created by your doctors will appear here with the consultation date and direct access to printing or PDF export.",
                        "ستظهر هنا الوصفات التي ينشئها أطباؤك مع تاريخ الزيارة وإمكانية الطباعة أو تصدير PDF.",
                      )}
                    </p>
                    <button
                      onClick={() => setActiveTab("appointments")}
                      className="mt-8 rounded-2xl bg-blue-600 px-8 py-3 font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700"
                    >
                      {tr(
                        "Voir mes rendez-vous",
                        "View my appointments",
                        "عرض مواعيدي",
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-5 xl:grid-cols-2">
                    {sortedPrescriptions.map((prescription) => {
                      const prescriptionDate = new Date(
                        `${prescription.prescription_date}T12:00:00`,
                      );
                      const prescriptionDateLabel = Number.isNaN(
                        prescriptionDate.getTime(),
                      )
                        ? prescription.prescription_date
                        : prescriptionDate.toLocaleDateString(locale, {
                            dateStyle: "long",
                          });

                      return (
                        <div
                          key={prescription.id}
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            openPrescriptionCopy(prescription.public_token)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openPrescriptionCopy(prescription.public_token);
                            }
                          }}
                          className="group rounded-[2rem] border border-slate-200/70 bg-white/90 p-6 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_28px_90px_-46px_rgba(37,99,235,0.24)] focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-none dark:hover:border-blue-900/40"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-4">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
                                <FileText size={24} />
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">
                                  {tr(
                                    "Ordonnance",
                                    "Prescription",
                                    "وصفة طبية",
                                  )}{" "}
                                  #{prescription.prescription_number}
                                </p>
                                <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">
                                  Dr.{" "}
                                  {prescription.doctor_display_name ||
                                    tr("Médecin", "Doctor", "طبيب")}
                                </h3>
                                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                  {localizeSpecialty(
                                    prescription.doctor_specialty,
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/70">
                              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                                {tr("Créée le", "Issued on", "تاريخ الإصدار")}
                              </p>
                              <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                                {prescriptionDateLabel}
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                                {tr(
                                  "Consultation liée",
                                  "Linked visit",
                                  "الزيارة المرتبطة",
                                )}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {getPrescriptionVisitLabel(prescription)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                                {tr("Ouverture", "Access", "الوصول")}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {tr(
                                  "Cliquez pour ouvrir, imprimer ou exporter en PDF.",
                                  "Click to open, print, or export as PDF.",
                                  "اضغط للفتح أو الطباعة أو التصدير بصيغة PDF.",
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openPrescriptionCopy(prescription.public_token);
                              }}
                              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                            >
                              {tr(
                                "Ouvrir l'ordonnance",
                                "Open prescription",
                                "فتح الوصفة",
                              )}
                              <ChevronRight size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openPrescriptionCopy(
                                  prescription.public_token,
                                  true,
                                );
                              }}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Printer size={16} />
                              {tr(
                                "Impression rapide",
                                "Quick print",
                                "طباعة سريعة",
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB: FAVORITES */}
            {activeTab === "favorites" && (
              <motion.div
                key="favorites"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="mb-10">
                  <h2 className="flex items-center gap-3 text-3xl font-black text-slate-900 dark:text-slate-100">
                    <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center text-rose-600 dark:text-rose-400">
                      <Heart size={24} className="fill-current" />
                    </div>
                    {tr(
                      "Mes praticiens favoris",
                      "My favorite practitioners",
                      "أطبائي المفضلين",
                    )}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    {tr(
                      "Retrouvez ici les praticiens que vous avez ajoutés à vos favoris.",
                      "Find here the practitioners you've added to your favorites.",
                      "تجد هنا الممارسين الذين أضفتهم إلى مفضلاتك.",
                    )}
                  </p>
                </div>

                {favoriteDoctors.length === 0 ? (
                  <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md rounded-[2.5rem] p-16 text-center border border-slate-200/60 dark:border-slate-800 shadow-xl">
                    <div className="w-24 h-24 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-8">
                      <Heart
                        size={40}
                        className="text-rose-200 dark:text-rose-800"
                      />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-3">
                      {tr(
                        "Aucun favori pour le moment",
                        "No favorites yet",
                        "لا توجد مفضلات حالياً",
                      )}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-sm mx-auto font-medium">
                      {tr(
                        "Parcourez la liste des médecins et cliquez sur le coeur pour les ajouter à vos favoris.",
                        "Browse the list of doctors and click the heart to add them to your favorites.",
                        "تصفح قائمة الأطباء واضغط على القلب لإضافتهم إلى مفضلاتك.",
                      )}
                    </p>
                    <button
                      onClick={() => setActiveTab("search")}
                      className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 hover:scale-[1.02] transition-all"
                    >
                      {tr(
                        "Découvrir des praticiens",
                        "Discover practitioners",
                        "اكتشف الممارسين",
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {favoriteDoctors.map((doc) => {
                      return (
                        <div
                          key={`fav-${doc.id}`}
                          onClick={() => openDoctorDetails(doc)}
                          className="bg-white dark:bg-slate-950 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl transition-shadow group relative overflow-hidden cursor-pointer"
                        >
                          <div className="absolute top-0 end-0 p-4 flex flex-col gap-2 items-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavoriteDoctor(doc);
                              }}
                              className={`p-2 rounded-xl transition-all shadow-sm ${favoriteDoctors.some((f) => f.id === doc.id) ? "bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400 border border-rose-100 dark:border-rose-800" : "bg-white/80 dark:bg-slate-900/80 text-gray-400 dark:text-slate-600 border border-gray-100 dark:border-slate-800 hover:text-rose-500"}`}
                            >
                              <Heart
                                size={18}
                                className={
                                  favoriteDoctors.some((f) => f.id === doc.id)
                                    ? "fill-current"
                                    : ""
                                }
                              />
                            </button>
                            <div className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-yellow-100 dark:border-yellow-800/50">
                              <div className="flex items-center gap-0.5 justify-center">
                                {Array.from({ length: 5 }).map((_, index) => (
                                  <Star
                                    key={`${doc.id}-rating-fav-${index}`}
                                    size={12}
                                    className={
                                      index <
                                      Math.round(
                                        doctorRatings[doc.id]?.avg_rating ?? 0,
                                      )
                                        ? "fill-current text-yellow-500"
                                        : "text-yellow-300 dark:text-yellow-700"
                                    }
                                  />
                                ))}
                              </div>
                              <p className="text-center mt-0.5">
                                {doctorRatings[doc.id]?.total_reviews > 0
                                  ? `${doctorRatings[doc.id]?.avg_rating.toFixed(1)} (${doctorRatings[doc.id]?.total_reviews})`
                                  : tr("Nouveau", "New", "جديد")}
                              </p>
                            </div>
                          </div>
                          {doc.avatar_url ? (
                            <img
                              src={doc.avatar_url}
                              alt={
                                doc.full_name || tr("Docteur", "Doctor", "طبيب")
                              }
                              className="w-16 h-16 rounded-full object-cover mb-4 border-2 border-white dark:border-slate-800 shadow-sm"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-emerald-100 dark:from-blue-900 dark:to-emerald-900 rounded-full flex items-center justify-center text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 border-2 border-white dark:border-slate-800 shadow-sm transition-colors">
                              {doc.full_name?.substring(0, 2).toUpperCase() ||
                                "DR"}
                            </div>
                          )}
                          <h3 className="font-bold text-lg text-gray-900 dark:text-slate-100 mb-1">
                            Dr. {doc.full_name}{" "}
                            {doc.gender === "Homme" ||
                            doc.gender === "Male" ||
                            doc.gender === "ذكر"
                              ? "👨"
                              : doc.gender === "Femme" ||
                                  doc.gender === "Female" ||
                                  doc.gender === "أنثى"
                                ? "👩"
                                : ""}
                          </h3>
                          <p className="text-blue-600 dark:text-blue-400 font-medium text-sm mb-3">
                            {localizeSpecialty(doc.specialty)}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2 mb-4 line-clamp-1">
                            <MapPin size={14} className="shrink-0" />{" "}
                            {doc.address ||
                              tr(
                                "Adresse non renseignée",
                                "Address not provided",
                                "العنوان غير متوفر",
                              )}
                          </p>
                          <DoctorPublicLinks doctor={doc} className="mb-4" />

                          <a
                            href={
                              doc.google_maps_link ||
                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(doc.address || "")}+${doc.latitude},${doc.longitude}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition mb-4 shadow-sm"
                          >
                            <MapPin size={18} />{" "}
                            {tr("Itinéraire", "Directions", "الاتجاهات")}
                          </a>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            {getBookingModeLabel(doc.appointment_booking_mode)}
                          </p>

                          {/* Affichage des états spéciaux (Congé / Désactivé) */}
                          {doc.is_accepting_appointments === false ? (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                alert(
                                  tr(
                                    "Ce docteur a désactivé la prise de RDV temporairement.",
                                    "This doctor has temporarily disabled appointments.",
                                    "هذا الطبيب أوقف حجز المواعيد مؤقتاً.",
                                  ),
                                );
                              }}
                              className="w-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 py-3 rounded-xl font-bold border border-slate-300 dark:border-slate-700 transition line-clamp-1 px-2"
                            >
                              ❌{" "}
                              {tr(
                                "Rendez-vous suspendus",
                                "Appointments suspended",
                                "المواعيد موقوفة",
                              )}
                            </button>
                          ) : isDoctorOnVacation(doc) ? (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                alert(getVacationLabelLocalized(doc));
                              }}
                              className="w-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 py-3 rounded-xl font-bold border border-orange-100 dark:border-orange-800 hover:bg-orange-100 transition truncate px-2"
                            >
                              🏖️ {tr("En congé", "On vacation", "في عطلة")}
                            </button>
                          ) : (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openBookingModal(doc);
                              }}
                              className="w-full bg-slate-900 dark:bg-blue-600 text-white py-3 rounded-xl font-medium shadow-md shadow-slate-900/20 dark:shadow-blue-900/20 hover:bg-slate-800 dark:hover:bg-blue-500 transform hover:-translate-y-0.5 transition flex justify-center items-center gap-2"
                            >
                              {tr(
                                "Prendre RDV",
                                "Book appointment",
                                "حجز موعد",
                              )}{" "}
                              <ChevronRight size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB: ARTICLES */}
            {activeTab === "community" && (
              <motion.div
                key="community"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-col gap-3">
                    <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
                      <FileText className="text-blue-600" />{" "}
                      {t("dashboard.patient.communityTitle")}
                    </h2>
                    <div className="inline-flex w-fit items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => setCommunityView("feed")}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                          communityView === "feed"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {t("dashboard.patient.communityFeed")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCommunityView("saved")}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                          communityView === "saved"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {t("dashboard.patient.communitySaved")} (
                        {
                          articles.filter((article) => article.saved_by_me)
                            .length
                        }
                        )
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleManualRefresh}
                    disabled={isManualRefreshing}
                    className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <RefreshCw
                      size={16}
                      className={isManualRefreshing ? "animate-spin" : ""}
                    />{" "}
                    {t("admin.refresh")}
                  </button>
                </div>

                <div className="space-y-6">
                  {visibleCommunityArticles.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                      {communityView === "saved"
                        ? tr(
                            "Aucune publication sauvegardée pour le moment.",
                            "No saved posts yet.",
                            "لا توجد منشورات محفوظة حالياً.",
                          )
                        : tr(
                            "Aucune publication pour le moment.",
                            "No posts for now.",
                            "لا توجد منشورات حالياً.",
                          )}
                    </div>
                  ) : (
                    visibleCommunityArticles.map((article) => (
                      <article
                        key={article.id}
                        className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-6 lg:p-8 rounded-3xl border border-slate-100/50 dark:border-slate-800/50 shadow-xl shadow-blue-900/5 hover:shadow-blue-900/10 transition-all duration-300"
                      >
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                          <button
                            type="button"
                            onClick={() =>
                              void openCommunityDoctorDetails(article.doctor_id)
                            }
                            className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90"
                            title={tr(
                              "Ouvrir la fiche du docteur",
                              "Open doctor profile",
                              "فتح بطاقة الطبيب",
                            )}
                          >
                            {article.author?.avatar_url ? (
                              <img
                                src={article.author.avatar_url}
                                alt={
                                  article.author.full_name ||
                                  tr("Docteur", "Doctor", "طبيب")
                                }
                                className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300 uppercase">
                                {(
                                  article.author?.full_name?.substring(0, 2) ??
                                  "DR"
                                ).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                Dr.{" "}
                                {article.author?.full_name ??
                                  tr("Médecin", "Doctor", "طبيب")}
                                {((article.author?.is_doctor_verified ===
                                  false &&
                                  article.author?.doctor_verification_status !=
                                    null) ||
                                  (article.author
                                    ?.doctor_verification_status != null &&
                                    article.author
                                      .doctor_verification_status !==
                                      "approved")) && (
                                  <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 ml-2">
                                    {tr(
                                      "Non vérifié",
                                      "Not verified",
                                      "غير موثق",
                                    )}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {localizeSpecialty(
                                  article.author?.specialty ??
                                    tr(
                                      "Spécialité non renseignée",
                                      "Specialty not provided",
                                      "التخصص غير محدد",
                                    ),
                                )}{" "}
                                ·{" "}
                                {new Date(
                                  article.created_at,
                                ).toLocaleDateString(locale)}
                              </p>
                            </div>
                          </button>
                          <span
                            className={`ml-auto inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              article.category === "maladie"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            }`}
                          >
                            {article.category === "maladie"
                              ? tr("Maladie", "Condition", "مرض")
                              : tr("Conseil", "Advice", "نصيحة")}
                          </span>
                        </div>

                        <h3 className="font-bold text-xl text-gray-900 dark:text-slate-100 mb-2">
                          {article.title}
                        </h3>
                        <p className="text-gray-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {article.content}
                        </p>
                        {article.images.length > 0 ? (
                          <div
                            className={`mt-4 grid gap-2 ${article.images.length === 1 ? "grid-cols-1" : article.images.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"}`}
                          >
                            {article.images.slice(0, 6).map((image, index) => (
                              <img
                                key={image.id}
                                src={image.image_url}
                                alt={`Publication ${article.title} - photo ${index + 1}`}
                                className="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                              />
                            ))}
                            {article.images.length > 6 ? (
                              <div className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                                +{article.images.length - 6}{" "}
                                {tr("photos", "photos", "صور")}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <button
                              onClick={() => void toggleLikePost(article.id)}
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                                article.liked_by_me
                                  ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                                  : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              <Heart
                                size={15}
                                className={
                                  article.liked_by_me ? "fill-current" : ""
                                }
                              />
                              {article.likes_count}
                            </button>
                            <button
                              onClick={() => void toggleSavePost(article.id)}
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                                article.saved_by_me
                                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                  : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              <Bookmark
                                size={15}
                                className={
                                  article.saved_by_me ? "fill-current" : ""
                                }
                              />
                              {article.saves_count}
                            </button>
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <MessageCircle size={15} />
                              {article.comments_count}
                            </span>
                            <button
                              onClick={() => void reportPost(article.id)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                              title={tr(
                                "Signaler cette publication",
                                "Report this post",
                                "الإبلاغ عن هذا المنشور",
                              )}
                            >
                              <Flag size={15} />
                              {tr("Signaler", "Report", "إبلاغ")}
                            </button>
                          </div>

                          <div className="mt-4 space-y-3">
                            {article.comments.length === 0 ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {tr(
                                  "Aucun commentaire pour le moment.",
                                  "No comments yet.",
                                  "لا توجد تعليقات حالياً.",
                                )}
                              </p>
                            ) : (
                              article.comments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                        {comment.author_name ??
                                          tr("Utilisateur", "User", "مستخدم")}
                                      </p>
                                      <p className="text-sm text-slate-600 dark:text-slate-300">
                                        {comment.content}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() =>
                                        void reportComment(comment.id)
                                      }
                                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                      title={tr(
                                        "Signaler ce commentaire",
                                        "Report this comment",
                                        "الإبلاغ عن هذا التعليق",
                                      )}
                                    >
                                      <Flag size={12} />
                                      {tr("Signaler", "Report", "إبلاغ")}
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              type="text"
                              value={commentDraftsByPostId[article.id] ?? ""}
                              onChange={(event) =>
                                setCommentDraftsByPostId((current) => ({
                                  ...current,
                                  [article.id]: event.target.value,
                                }))
                              }
                              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={tr(
                                "Écrire un commentaire...",
                                "Write a comment...",
                                "اكتب تعليقاً...",
                              )}
                            />
                            <button
                              onClick={() =>
                                void submitCommunityComment(article.id)
                              }
                              disabled={commentSubmittingPostId === article.id}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                            >
                              <Send size={14} />
                              {commentSubmittingPostId === article.id
                                ? "..."
                                : tr("Publier", "Post", "نشر")}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB: AI ASSISTANT — rendered above via fixed overlay, nothing here */}

            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="bg-white dark:bg-slate-950 rounded-3xl p-8 border border-gray-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto transition-colors">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                    <Settings className="text-blue-600" />{" "}
                    {t("dashboard.patient.accountSettings")}
                  </h2>
                  <p className="text-gray-500 dark:text-slate-400 mb-8">
                    {tr(
                      "Mettez à jour votre profil, y compris votre photo.",
                      "Update your profile, including your photo.",
                      "حدّث ملفك الشخصي بما في ذلك صورتك.",
                    )}
                  </p>
                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
                        {t("common.fullName")}
                      </label>
                      <input
                        type="text"
                        value={settingsFullName}
                        onChange={(event) =>
                          setSettingsFullName(event.target.value)
                        }
                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none mt-2 text-gray-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
                        {tr(
                          "Email de contact",
                          "Contact email",
                          "بريد التواصل",
                        )}
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={profile?.email || ""}
                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none mt-2 text-gray-800 dark:text-slate-100 font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
                        {tr(
                          "Immatriculation patient",
                          "Patient registration ID",
                          "رقم تعريف المريض",
                        )}
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={
                          formatPatientRegistrationNumber(
                            profile?.patient_registration_number,
                          ) ?? ""
                        }
                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none mt-2 text-gray-800 dark:text-slate-100 font-medium font-mono tracking-[0.2em]"
                      />
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {tr(
                          "Ce numéro vous identifie de façon unique, même si d'autres patients ont le même nom.",
                          "This number identifies you uniquely, even if other patients have the same name.",
                          "هذا الرقم يعرّفك بشكل فريد حتى لو وُجد مرضى آخرون بالاسم نفسه.",
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
                        {tr("Localisation", "Location", "الموقع")}
                      </label>
                      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                        <input
                          type="text"
                          value={settingsAddress}
                          onChange={(event) =>
                            setSettingsAddress(event.target.value)
                          }
                          className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none text-gray-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500"
                          placeholder={tr(
                            "Ex: Dar El Beida, Alger",
                            "Ex: Dar El Beida, Algiers",
                            "مثال: الدار البيضاء، الجزائر",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void handleGeolocate();
                          }}
                          disabled={isResolvingLocation}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm font-semibold text-blue-700 dark:text-blue-200 transition hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[190px] sm:w-auto"
                        >
                          <Crosshair
                            size={16}
                            className={
                              isResolvingLocation ? "animate-pulse" : ""
                            }
                          />
                          {isResolvingLocation
                            ? tr(
                                "Localisation en cours...",
                                "Detecting location...",
                                "جارٍ تحديد الموقع...",
                              )
                            : tr(
                                "Utiliser mon GPS",
                                "Use my GPS",
                                "استخدام GPS الخاص بي",
                              )}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {settingsLatitude != null && settingsLongitude != null
                          ? tr(
                              `Coordonnées enregistrées: ${settingsLatitude.toFixed(5)}, ${settingsLongitude.toFixed(5)}${locationAccuracy != null ? ` · précision ~${Math.round(locationAccuracy)} m` : ""}`,
                              `Saved coordinates: ${settingsLatitude.toFixed(5)}, ${settingsLongitude.toFixed(5)}${locationAccuracy != null ? ` · accuracy ~${Math.round(locationAccuracy)} m` : ""}`,
                              `الإحداثيات المحفوظة: ${settingsLatitude.toFixed(5)}، ${settingsLongitude.toFixed(5)}${locationAccuracy != null ? ` · الدقة حوالي ${Math.round(locationAccuracy)} م` : ""}`,
                            )
                          : tr(
                              "Le bouton GPS remplit automatiquement une position plus précise pour la carte.",
                              "The GPS button fills a more accurate position for the map.",
                              "زر GPS يملأ موقعاً أدق للخريطة.",
                            )}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
                        {tr(
                          "Photo de profil",
                          "Profile photo",
                          "صورة الملف الشخصي",
                        )}
                      </label>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
                          <Upload size={16} />
                          {isUploadingAvatar
                            ? tr(
                                "Téléversement...",
                                "Uploading...",
                                "جارٍ الرفع...",
                              )
                            : tr(
                                "Téléverser une photo",
                                "Upload photo",
                                "رفع صورة",
                              )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                void handleAvatarUpload(file);
                              }
                              event.currentTarget.value = "";
                            }}
                            disabled={isUploadingAvatar}
                          />
                        </label>
                        {settingsAvatarUrl ? (
                          <button
                            type="button"
                            onClick={() => setSettingsAvatarUrl("")}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                          >
                            {tr(
                              "Supprimer la photo",
                              "Remove photo",
                              "حذف الصورة",
                            )}
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {tr(
                          "Formats acceptés: JPG, PNG, WebP (max 5 MB).",
                          "Accepted formats: JPG, PNG, WebP (max 5 MB).",
                          "الصيغ المقبولة: JPG وPNG وWebP (الحد الأقصى 5 MB).",
                        )}
                      </p>
                      {settingsAvatarUrl ? (
                        <div className="mt-3 flex items-center gap-3">
                          <img
                            src={settingsAvatarUrl}
                            alt={tr(
                              "Aperçu profil",
                              "Profile preview",
                              "معاينة الملف",
                            )}
                            className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {tr(
                              "Aperçu de la photo",
                              "Photo preview",
                              "معاينة الصورة",
                            )}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                        {isAutoSavingAccount
                          ? tr(
                              "Sauvegarde automatique...",
                              "Auto-saving...",
                              "حفظ تلقائي...",
                            )
                          : tr(
                              "Sauvegarde automatique activée.",
                              "Auto-save enabled.",
                              "الحفظ التلقائي مفعّل.",
                            )}
                      </p>
                      <button
                        onClick={handleSaveAccountSettings}
                        disabled={isSavingAccount}
                        className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition shadow-md shadow-blue-600/20 disabled:opacity-60"
                      >
                        {isSavingAccount
                          ? tr(
                              "Enregistrement...",
                              "Saving...",
                              "جارٍ الحفظ...",
                            )
                          : tr(
                              "Enregistrer les modifications",
                              "Save changes",
                              "حفظ التغييرات",
                            )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedDoctorDetailsForModal ? (
              <DoctorDetailsModal
                doctor={selectedDoctorDetailsForModal}
                onClose={closeDoctorDetails}
                onBook={
                  selectedDoctorDetailsContext === "community"
                    ? undefined
                    : () => {
                        if (selectedDoctorDetails) {
                          bookFromDetails(selectedDoctorDetails);
                        }
                      }
                }
              />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {selectedDoctorToBookForModal ? (
              <DoctorBookingModal
                doctor={selectedDoctorToBookForModal}
                patientId={profile?.id ?? null}
                onClose={closeBookingModal}
                onSuccess={async (result) => {
                  if (!selectedDoctorToBook) {
                    return;
                  }
                  await handleBookingSuccess(selectedDoctorToBook, result);
                }}
              />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {appointmentToReview && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 16 }}
                  className="bg-white dark:bg-slate-950 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {tr(
                          "Votre avis compte",
                          "Your feedback matters",
                          "رأيك يهمنا",
                        )}
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Dr. {appointmentToReview.doctor?.full_name}
                      </p>
                    </div>
                    <button
                      onClick={closeReviewModal}
                      className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-2.5 transition"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                        {tr("Note globale", "Overall rating", "التقييم العام")}
                      </p>
                      <div className="flex items-center gap-2">
                        {Array.from({ length: 5 }).map((_, index) => {
                          const value = index + 1;
                          const active = value <= reviewRating;
                          return (
                            <button
                              key={`review-star-${value}`}
                              type="button"
                              onClick={() => setReviewRating(value)}
                              className="p-1 rounded-md transition hover:scale-105"
                            >
                              <Star
                                size={26}
                                className={
                                  active
                                    ? "text-yellow-500 fill-current"
                                    : "text-slate-300 dark:text-slate-600"
                                }
                              />
                            </button>
                          );
                        })}
                        <span className="ml-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {reviewRating}/5
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        {tr(
                          "Commentaire (optionnel)",
                          "Comment (optional)",
                          "تعليق (اختياري)",
                        )}
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={(event) =>
                          setReviewComment(event.target.value)
                        }
                        className="w-full min-h-28 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder={tr(
                          "Partagez votre expérience de consultation...",
                          "Share your consultation experience...",
                          "شارك تجربتك مع الاستشارة...",
                        )}
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={closeReviewModal}
                      disabled={isSubmittingReview}
                      className="w-1/3 py-3 rounded-xl font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-60"
                    >
                      {tr("Annuler", "Cancel", "إلغاء")}
                    </button>
                    <button
                      onClick={submitReview}
                      disabled={isSubmittingReview}
                      className="w-2/3 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/25 disabled:opacity-60"
                    >
                      {isSubmittingReview
                        ? tr("Envoi...", "Sending...", "جارٍ الإرسال...")
                        : tr(
                            "Envoyer mon avis",
                            "Submit my review",
                            "إرسال تقييمي",
                          )}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {reportTarget ? (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-2xl"
                >
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {tr("Signaler un", "Report a", "الإبلاغ عن")}{" "}
                    {reportTarget.type === "post"
                      ? tr("post", "post", "منشور")
                      : tr("commentaire", "comment", "تعليق")}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {tr(
                      "Merci d'indiquer la raison du signalement.",
                      "Please provide the report reason.",
                      "يرجى توضيح سبب الإبلاغ.",
                    )}
                  </p>
                  <textarea
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    className="mt-4 w-full h-28 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={tr(
                      "Raison du signalement...",
                      "Report reason...",
                      "سبب الإبلاغ...",
                    )}
                  />
                  <div className="mt-5 flex items-center gap-3">
                    <button
                      onClick={closeReportModal}
                      className="w-1/3 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                      {tr("Annuler", "Cancel", "إلغاء")}
                    </button>
                    <button
                      onClick={submitReport}
                      disabled={isSubmittingReport}
                      className="w-2/3 rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-rose-700 transition disabled:opacity-60"
                    >
                      {isSubmittingReport
                        ? tr("Envoi...", "Sending...", "جارٍ الإرسال...")
                        : tr(
                            "Envoyer le signalement",
                            "Send report",
                            "إرسال البلاغ",
                          )}
                    </button>
                  </div>
                </motion.div>
              </div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {notice ? (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                className={`fixed top-5 end-5 z-[95] max-w-sm rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${
                  notice.type === "error"
                    ? "border-rose-200 bg-rose-50/95 text-rose-700 dark:border-rose-800 dark:bg-rose-900/80 dark:text-rose-200"
                    : notice.type === "success"
                      ? "border-emerald-200 bg-emerald-50/95 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200"
                      : "border-blue-200 bg-blue-50/95 text-blue-700 dark:border-blue-800 dark:bg-blue-900/80 dark:text-blue-200"
                }`}
              >
                <p className="text-sm font-semibold leading-snug">
                  {notice.message}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
// made by larabi
