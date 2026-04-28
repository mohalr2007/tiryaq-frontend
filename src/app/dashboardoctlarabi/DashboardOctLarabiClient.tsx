// made by larabi
'use client';
import AiAssistantView from "@/features/ai-assistant/AiAssistantView";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getCachedSupabaseUser,
  getStableAuthUser,
  hasSupabaseAuthTokenSnapshot,
  supabase,
} from "../../utils/supabase/client";
import { clearExpiredVacationFlag, hasDoctorVacationExpired, syncExpiredDoctorVacations } from "../../utils/doctorAvailability";
import { logAuditEvent, logPerformanceEvent } from "../../utils/telemetry";
import { getBrowserLocation } from "../../utils/location";
import { Logo } from "../../components/Logo";
import { useI18n } from "@/lib/i18n";
import DoctorPublicLinks from "@/components/DoctorPublicLinks";
import ThemeToggle from "@/components/ThemeToggle";
import DoctorDetailsModal from "@/features/ai-assistant/DoctorDetailsModal";
import VisitPrescriptionModal from "@/components/prescriptions/VisitPrescriptionModal";
import type { VisitPrescription, VisitPrescriptionDraft, VisitPrescriptionItem } from "@/components/prescriptions/types";
import { sortPrescriptionItems } from "@/components/prescriptions/types";
import { buildPrescriptionPublicUrl } from "@/utils/prescriptions/publicUrl";
import type { DoctorContactFields, DoctorPublicChannelKey } from "@/utils/doctorContactChannels";
import type { RecommendedDoctor } from "@/features/ai-assistant/types";
import { 
  Users, Calendar as CalendarIcon, Clock, Settings, LogOut, 
  FileText, CheckCircle, XCircle, RefreshCw, Upload, Images, X, Heart, Bookmark, MessageCircle, Send, Flag, Copy, ExternalLink,
  Plus, Search, ChevronRight, UserCircle, Phone, Stethoscope, Pencil, Trash2, Activity, ClipboardList, ChevronDown, Menu, Eye, Crosshair, Home, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type BookingSelectionMode = "patient_datetime" | "patient_date_only" | "doctor_datetime";
type SortOrder = "desc" | "asc";

type DoctorProfile = DoctorContactFields & {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  account_type: "patient" | "doctor" | null;
  specialty: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  bio: string | null;
  gender: string | null;
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
  is_platform_admin?: boolean | null;
  email?: string | null;
  doctor_verification_status?: string | null;
  is_doctor_verified?: boolean | null;
  doctor_verification_note?: string | null;
  doctor_verification_requested_at?: string | null;
  moderation_status?: string | null;
  moderation_reason?: string | null;
};

const COMMUNITY_DOCTOR_PROFILE_SELECT = "id, full_name, avatar_url, account_type, specialty, address, latitude, longitude, bio, gender, is_accepting_appointments, appointment_duration_minutes, max_appointments_per_day, vacation_start, vacation_end, is_on_vacation, working_hours_start, working_hours_end, appointment_booking_mode, google_maps_link, contact_phone, contact_phone_enabled, contact_email, contact_email_enabled, facebook_url, facebook_enabled, instagram_url, instagram_enabled, x_url, x_enabled, whatsapp_url, whatsapp_enabled, telegram_url, telegram_enabled, linkedin_url, linkedin_enabled, gmail_url, gmail_enabled";

type DoctorAppointment = {
  id: string;
  patient_id: string | null;
  created_at: string;
  appointment_date: string;
  status: string;
  booking_selection_mode: BookingSelectionMode | null;
  requested_date: string | null;
  requested_time: string | null;
  appointment_source: "patient_request" | "doctor_follow_up" | null;
  follow_up_visit_id: string | null;
  follow_up_dossier_id: string | null;
  follow_up_time_pending: boolean;
  follow_up_reminder_days: number | null;
  notes?: string | null;
  patient: {
    id: string;
    full_name: string | null;
    gender: string | null;
    patient_registration_number: string | null;
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

type CommunityArticle = {
  id: string;
  doctor_id: string;
  category: "conseil" | "maladie";
  title: string;
  content: string;
  created_at: string;
  images: PublicationImage[];
  author: {
    full_name: string | null;
    specialty: string | null;
    avatar_url?: string | null;
  } | null;
};

type PublicationImage = {
  id: string;
  image_url: string;
  sort_order: number;
};

type PendingPublicationImage = {
  file: File;
  previewUrl: string;
};

type DoctorPublication = {
  id: string;
  category: "conseil" | "maladie";
  title: string;
  content: string;
  created_at: string;
  is_hidden?: boolean;
  hidden_reason?: string | null;
  images: PublicationImage[];
};

type MedicalDossier = {
  id: string;
  doctor_id: string;
  patient_id: string | null;
  patient_registration_number: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  blood_type: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  general_remarks: string | null;
  created_at: string;
  updated_at: string;
  visits?: DossierVisit[];
};

type DossierVisit = {
  id: string;
  dossier_id: string;
  appointment_id: string | null;
  visit_date: string;
  visit_time: string | null;
  reason: string | null;
  diagnosis: string | null;
  treatment: string | null;
  doctor_notes: string | null;
  follow_up_date: string | null;
  created_at: string;
};

const VISIT_PRESCRIPTION_SELECT = `
  id,
  visit_id,
  dossier_id,
  doctor_id,
  patient_id,
  prescription_number,
  public_token,
  prescription_date,
  patient_display_name,
  doctor_display_name,
  doctor_specialty,
  doctor_address,
  doctor_phone,
  signature_label,
  notes,
  created_at,
  updated_at,
  items:visit_prescription_items(
    id,
    prescription_id,
    line_number,
    medication_name,
    dosage,
    instructions,
    duration,
    created_at,
    updated_at
  )
`;

const STANDALONE_PRESCRIPTION_SELECT = `
  id,
  dossier_id,
  doctor_id,
  patient_id,
  patient_registration_number,
  prescription_number,
  public_token,
  prescription_date,
  patient_display_name,
  doctor_display_name,
  doctor_specialty,
  doctor_address,
  doctor_phone,
  signature_label,
  notes,
  created_at,
  updated_at,
  items:standalone_prescription_items(
    id,
    prescription_id,
    line_number,
    medication_name,
    dosage,
    instructions,
    duration,
    created_at,
    updated_at
  )
`;

type DoctorContactSettings = {
  contact_phone: string;
  contact_phone_enabled: boolean;
  contact_email: string;
  contact_email_enabled: boolean;
  facebook_url: string;
  facebook_enabled: boolean;
  instagram_url: string;
  instagram_enabled: boolean;
  x_url: string;
  x_enabled: boolean;
  whatsapp_url: string;
  whatsapp_enabled: boolean;
  telegram_url: string;
  telegram_enabled: boolean;
  linkedin_url: string;
  linkedin_enabled: boolean;
  gmail_url: string;
  gmail_enabled: boolean;
};

function normalizeVisitPrescription(
  prescription: Omit<VisitPrescription, "items"> & { items?: VisitPrescriptionItem[] | null }
): VisitPrescription {
  return {
    ...prescription,
    items: sortPrescriptionItems((prescription.items ?? []).map((item) => ({
      ...item,
      dosage: item.dosage ?? null,
      instructions: item.instructions ?? null,
      duration: item.duration ?? null,
    }))),
  };
}

function normalizeStandalonePrescription(
  prescription: Omit<VisitPrescription, "items" | "visit_id"> & { visit_id?: string | null; items?: VisitPrescriptionItem[] | null }
): VisitPrescription {
  return normalizeVisitPrescription({
    ...prescription,
    visit_id: prescription.visit_id ?? null,
    dossier_id: prescription.dossier_id ?? null,
    patient_registration_number: prescription.patient_registration_number ?? null,
  });
}

type DoctorContactValueKey = keyof Pick<
  DoctorContactSettings,
  | "contact_phone"
  | "contact_email"
  | "facebook_url"
  | "instagram_url"
  | "x_url"
  | "whatsapp_url"
  | "telegram_url"
  | "linkedin_url"
  | "gmail_url"
>;

type DoctorContactToggleKey = keyof Pick<
  DoctorContactSettings,
  | "contact_phone_enabled"
  | "contact_email_enabled"
  | "facebook_enabled"
  | "instagram_enabled"
  | "x_enabled"
  | "whatsapp_enabled"
  | "telegram_enabled"
  | "linkedin_enabled"
  | "gmail_enabled"
>;

type DoctorContactInputConfig = {
  channel: DoctorPublicChannelKey;
  valueKey: DoctorContactValueKey;
  enabledKey: DoctorContactToggleKey;
  label: { fr: string; en: string; ar: string };
  placeholder: { fr: string; en: string; ar: string };
  hint: { fr: string; en: string; ar: string };
  inputMode?: "text" | "email" | "tel" | "url";
};

const DOCTOR_CONTACT_INPUTS: DoctorContactInputConfig[] = [
  {
    channel: "phone",
    valueKey: "contact_phone",
    enabledKey: "contact_phone_enabled",
    label: { fr: "Téléphone public", en: "Public phone", ar: "الهاتف العام" },
    placeholder: { fr: "Ex: +213 555 00 11 22", en: "Ex: +213 555 00 11 22", ar: "مثال: +213 555 00 11 22" },
    hint: { fr: "Visible sur les fiches patient et les propositions AI.", en: "Visible on patient cards and AI suggestions.", ar: "يظهر في بطاقات المريض واقتراحات الذكاء الاصطناعي." },
    inputMode: "tel",
  },
  {
    channel: "email",
    valueKey: "contact_email",
    enabledKey: "contact_email_enabled",
    label: { fr: "Email de contact", en: "Contact email", ar: "بريد التواصل" },
    placeholder: { fr: "Ex: contact@cabinet.dz", en: "Ex: contact@clinic.dz", ar: "مثال: contact@clinic.dz" },
    hint: { fr: "Adresse publique de contact pour les patients.", en: "Public contact address for patients.", ar: "عنوان تواصل عام للمرضى." },
    inputMode: "email",
  },
  {
    channel: "facebook",
    valueKey: "facebook_url",
    enabledKey: "facebook_enabled",
    label: { fr: "Facebook", en: "Facebook", ar: "فيسبوك" },
    placeholder: { fr: "Lien ou identifiant Facebook", en: "Facebook link or handle", ar: "رابط أو اسم مستخدم فيسبوك" },
    hint: { fr: "Collez le lien complet ou juste le nom du compte.", en: "Paste the full link or just the handle.", ar: "ألصق الرابط الكامل أو اسم الحساب فقط." },
    inputMode: "url",
  },
  {
    channel: "instagram",
    valueKey: "instagram_url",
    enabledKey: "instagram_enabled",
    label: { fr: "Instagram", en: "Instagram", ar: "إنستغرام" },
    placeholder: { fr: "Lien ou identifiant Instagram", en: "Instagram link or handle", ar: "رابط أو اسم مستخدم إنستغرام" },
    hint: { fr: "Partage facultatif pour votre présence médicale.", en: "Optional share for your medical presence.", ar: "مشاركة اختيارية لحضورك المهني." },
    inputMode: "url",
  },
  {
    channel: "x",
    valueKey: "x_url",
    enabledKey: "x_enabled",
    label: { fr: "X", en: "X", ar: "إكس" },
    placeholder: { fr: "Lien ou identifiant X", en: "X link or handle", ar: "رابط أو اسم مستخدم X" },
    hint: { fr: "Accepte un lien complet ou @compte.", en: "Accepts a full link or @handle.", ar: "يقبل رابطاً كاملاً أو @اسم_المستخدم." },
    inputMode: "url",
  },
  {
    channel: "whatsapp",
    valueKey: "whatsapp_url",
    enabledKey: "whatsapp_enabled",
    label: { fr: "WhatsApp", en: "WhatsApp", ar: "واتساب" },
    placeholder: { fr: "Numéro WhatsApp ou lien wa.me", en: "WhatsApp number or wa.me link", ar: "رقم واتساب أو رابط wa.me" },
    hint: { fr: "Le système transforme automatiquement un numéro en lien.", en: "The system automatically turns a number into a link.", ar: "النظام يحول الرقم تلقائياً إلى رابط." },
    inputMode: "tel",
  },
  {
    channel: "telegram",
    valueKey: "telegram_url",
    enabledKey: "telegram_enabled",
    label: { fr: "Telegram", en: "Telegram", ar: "تيليغرام" },
    placeholder: { fr: "Lien Telegram ou @compte", en: "Telegram link or @handle", ar: "رابط تيليغرام أو @اسم_المستخدم" },
    hint: { fr: "Pratique pour un canal de communication rapide.", en: "Useful for a fast communication channel.", ar: "مفيد لقناة تواصل سريعة." },
    inputMode: "url",
  },
  {
    channel: "linkedin",
    valueKey: "linkedin_url",
    enabledKey: "linkedin_enabled",
    label: { fr: "LinkedIn", en: "LinkedIn", ar: "لينكدإن" },
    placeholder: { fr: "Lien LinkedIn", en: "LinkedIn link", ar: "رابط لينكدإن" },
    hint: { fr: "Montre votre profil professionnel public.", en: "Shows your public professional profile.", ar: "يعرض ملفك المهني العام." },
    inputMode: "url",
  },
  {
    channel: "gmail",
    valueKey: "gmail_url",
    enabledKey: "gmail_enabled",
    label: { fr: "Gmail", en: "Gmail", ar: "جيميل" },
    placeholder: { fr: "Adresse Gmail publique", en: "Public Gmail address", ar: "عنوان جيميل العام" },
    hint: { fr: "Alternative si vous voulez afficher une adresse Gmail dédiée.", en: "Alternative if you want to display a dedicated Gmail address.", ar: "خيار بديل إذا أردت عرض بريد Gmail مخصص." },
    inputMode: "email",
  },
];

function createEmptyDossierForm() {
  return {
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    date_of_birth: "",
    gender: "",
    blood_type: "",
    allergies: "",
    chronic_conditions: "",
    general_remarks: "",
  };
}

function createEmptyVisitForm() {
  return {
    visit_date: new Date().toISOString().split("T")[0],
    visit_time: "",
    reason: "",
    diagnosis: "",
    treatment: "",
    doctor_notes: "",
    follow_up_date: "",
    follow_up_time: "",
    schedule_follow_up: false,
  };
}

function createEmptyDoctorContactSettings(): DoctorContactSettings {
  return {
    contact_phone: "",
    contact_phone_enabled: false,
    contact_email: "",
    contact_email_enabled: false,
    facebook_url: "",
    facebook_enabled: false,
    instagram_url: "",
    instagram_enabled: false,
    x_url: "",
    x_enabled: false,
    whatsapp_url: "",
    whatsapp_enabled: false,
    telegram_url: "",
    telegram_enabled: false,
    linkedin_url: "",
    linkedin_enabled: false,
    gmail_url: "",
    gmail_enabled: false,
  };
}

function normalizeDoctorContactSettings(
  settings: Partial<DoctorContactFields> | null | undefined
): DoctorContactSettings {
  const empty = createEmptyDoctorContactSettings();

  return {
    ...empty,
    contact_phone: settings?.contact_phone?.trim() ?? "",
    contact_phone_enabled: Boolean(settings?.contact_phone_enabled && settings?.contact_phone?.trim()),
    contact_email: settings?.contact_email?.trim() ?? "",
    contact_email_enabled: Boolean(settings?.contact_email_enabled && settings?.contact_email?.trim()),
    facebook_url: settings?.facebook_url?.trim() ?? "",
    facebook_enabled: Boolean(settings?.facebook_enabled && settings?.facebook_url?.trim()),
    instagram_url: settings?.instagram_url?.trim() ?? "",
    instagram_enabled: Boolean(settings?.instagram_enabled && settings?.instagram_url?.trim()),
    x_url: settings?.x_url?.trim() ?? "",
    x_enabled: Boolean(settings?.x_enabled && settings?.x_url?.trim()),
    whatsapp_url: settings?.whatsapp_url?.trim() ?? "",
    whatsapp_enabled: Boolean(settings?.whatsapp_enabled && settings?.whatsapp_url?.trim()),
    telegram_url: settings?.telegram_url?.trim() ?? "",
    telegram_enabled: Boolean(settings?.telegram_enabled && settings?.telegram_url?.trim()),
    linkedin_url: settings?.linkedin_url?.trim() ?? "",
    linkedin_enabled: Boolean(settings?.linkedin_enabled && settings?.linkedin_url?.trim()),
    gmail_url: settings?.gmail_url?.trim() ?? "",
    gmail_enabled: Boolean(settings?.gmail_enabled && settings?.gmail_url?.trim()),
  };
}

function sanitizeDoctorContactSettings(settings: DoctorContactSettings): DoctorContactSettings {
  return normalizeDoctorContactSettings(settings);
}

function splitFullName(fullName: string | null | undefined) {
  const normalized = (fullName ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeDoctorProfile(
  profile: Partial<DoctorProfile> | null | undefined,
  email?: string | null
): DoctorProfile | null {
  if (!profile?.id) {
    return null;
  }

  return {
    ...normalizeDoctorContactSettings(profile),
    id: profile.id,
    full_name: profile.full_name ?? null,
    avatar_url: profile.avatar_url ?? null,
    account_type: (profile.account_type as "patient" | "doctor" | null) ?? "doctor",
    specialty: profile.specialty ?? null,
    address: profile.address ?? null,
    latitude: profile.latitude ?? null,
    longitude: profile.longitude ?? null,
    bio: profile.bio ?? null,
    gender: profile.gender ?? null,
    is_accepting_appointments: profile.is_accepting_appointments ?? true,
    appointment_duration_minutes: profile.appointment_duration_minutes ?? 30,
    max_appointments_per_day: profile.max_appointments_per_day ?? null,
    vacation_start: profile.vacation_start ?? null,
    vacation_end: profile.vacation_end ?? null,
    is_on_vacation: profile.is_on_vacation ?? false,
    working_hours_start: profile.working_hours_start ?? '08:00',
    working_hours_end: profile.working_hours_end ?? '17:00',
    appointment_booking_mode: (profile.appointment_booking_mode ?? "patient_datetime") as BookingSelectionMode,
    google_maps_link: profile.google_maps_link ?? null,
    is_platform_admin: profile.is_platform_admin ?? false,
    email: email ?? null,
    doctor_verification_status: profile.doctor_verification_status ?? null,
    is_doctor_verified: profile.is_doctor_verified ?? null,
    doctor_verification_note: profile.doctor_verification_note ?? null,
    doctor_verification_requested_at: profile.doctor_verification_requested_at ?? null,
    moderation_status: profile.moderation_status ?? null,
    moderation_reason: profile.moderation_reason ?? null,
  };
}

function toRecommendedDoctorProfile(profile: DoctorProfile): RecommendedDoctor {
  return {
    ...profile,
    rating: 0,
    reviews: 0,
    distanceKm: null,
  };
}

function normalizeDoctorAppointment(appointment: {
  id: string;
  patient_id?: string | null;
  created_at?: string | null;
  appointment_date: string;
  status: string;
  booking_selection_mode?: BookingSelectionMode | null;
  requested_date?: string | null;
  requested_time?: string | null;
  appointment_source?: "patient_request" | "doctor_follow_up" | null;
  follow_up_visit_id?: string | null;
  follow_up_dossier_id?: string | null;
  follow_up_time_pending?: boolean | null;
  follow_up_reminder_days?: number | null;
  notes?: string | null;
  patient?:
    | { id?: string | null; full_name: string | null; gender?: string | null; patient_registration_number?: string | null }[]
    | { id?: string | null; full_name: string | null; gender?: string | null; patient_registration_number?: string | null }
    | null;
}): DoctorAppointment {
  const normalizedPatient = Array.isArray(appointment.patient)
    ? (appointment.patient[0] ?? null)
    : (appointment.patient ?? null);

  return {
    id: appointment.id,
    patient_id: appointment.patient_id ?? normalizedPatient?.id ?? null,
    created_at: appointment.created_at ?? appointment.appointment_date,
    appointment_date: appointment.appointment_date,
    status: appointment.status,
    booking_selection_mode: appointment.booking_selection_mode ?? "patient_datetime",
    requested_date: appointment.requested_date ?? null,
    requested_time: appointment.requested_time ?? null,
    appointment_source: appointment.appointment_source ?? "patient_request",
    follow_up_visit_id: appointment.follow_up_visit_id ?? null,
    follow_up_dossier_id: appointment.follow_up_dossier_id ?? null,
    follow_up_time_pending: Boolean(appointment.follow_up_time_pending),
    follow_up_reminder_days: appointment.follow_up_reminder_days ?? 4,
    notes: appointment.notes ?? null,
    patient: normalizedPatient
      ? {
          id: normalizedPatient.id ?? appointment.patient_id ?? "",
          full_name: normalizedPatient.full_name ?? null,
          gender: normalizedPatient.gender ?? null,
          patient_registration_number: normalizedPatient.patient_registration_number ?? null,
        }
      : null,
  };
}

function formatPatientRegistrationNumber(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length !== 13) {
    return null;
  }

  return `${digits.slice(0, 6)} ${digits.slice(6, 12)} ${digits.slice(12)}`;
}

function normalizeTimeValue(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) {
    return fallback;
  }

  return `${match[1]}:${match[2]}`;
}

function buildLocalDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function getLocalIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getSortableTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

const DASHBOARD_QUERY_TIMEOUT_MS = 15000;

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
    console.warn(`${label} failed in doctor dashboard`, error);
    return fallback;
  }
}

function sortAppointmentsChronologically<T extends { appointment_date: string }>(items: T[], order: SortOrder = "asc") {
  return [...items].sort((left, right) => {
    const delta = getSortableTimestamp(left.appointment_date) - getSortableTimestamp(right.appointment_date);
    return order === "asc" ? delta : -delta;
  });
}

function sortItemsByDate<T>(items: T[], getDateValue: (item: T) => string | null | undefined, order: SortOrder = "desc") {
  return [...items].sort((left, right) => {
    const delta = getSortableTimestamp(getDateValue(left)) - getSortableTimestamp(getDateValue(right));
    return order === "asc" ? delta : -delta;
  });
}

function getAppointmentCalendarDate(appointment: Pick<DoctorAppointment, "requested_date" | "appointment_date">) {
  if (appointment.requested_date) {
    return appointment.requested_date;
  }

  return getLocalIsoDate(new Date(appointment.appointment_date));
}

function getDaysUntilCalendarDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const targetDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getAppointmentWindowEnd(appointment: Pick<DoctorAppointment, "appointment_date">, durationMinutes: number) {
  return new Date(new Date(appointment.appointment_date).getTime() + durationMinutes * 60 * 1000);
}

function getPinnedDoctorVisitAppointment(
  appointments: DoctorAppointment[],
  durationMinutes: number,
  now: Date
) {
  const nowTime = now.getTime();
  const todayAppointments = appointments
    .filter((appointment) => {
      if (appointment.status !== "confirmed" || appointment.follow_up_time_pending) {
        return false;
      }

      const appointmentDate = new Date(appointment.appointment_date);
      return appointmentDate.toDateString() === now.toDateString() && appointmentDate.getTime() <= nowTime;
    })
    .sort((left, right) => new Date(left.appointment_date).getTime() - new Date(right.appointment_date).getTime());

  if (todayAppointments.length === 0) {
    return null;
  }

  let pinnedAppointment = todayAppointments[0];

  for (let index = 1; index < todayAppointments.length; index += 1) {
    const previousAppointment = todayAppointments[index - 1];
    const currentAppointment = todayAppointments[index];
    const previousEnd = getAppointmentWindowEnd(previousAppointment, durationMinutes).getTime();
    const currentStart = new Date(currentAppointment.appointment_date).getTime();

    if (currentStart > previousEnd) {
      pinnedAppointment = currentAppointment;
    }
  }

  return pinnedAppointment;
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

export default function DoctorDashboard() {
  const { t, language } = useI18n();
  const tr = (fr: string, en: string, ar: string) =>
    language === "ar" ? ar : language === "en" ? en : fr;
  const locale = language === "ar" ? "ar-DZ" : language === "en" ? "en-US" : "fr-FR";
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get("embed") === "1";

  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [accountEligibility, setAccountEligibility] =
    useState<AccountEligibilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    const normalizedTab = tab === "articles" ? "community" : tab;
    const allowedTabs = new Set(["overview", "appointments", "patients", "prescriptions", "community", "publications", "profile", "ai-assistant"]);
    return normalizedTab && allowedTabs.has(normalizedTab) ? normalizedTab : "overview";
  });
  const [isDesktopNavVisible, setIsDesktopNavVisible] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Nouveaux paramètres DB
  const [isAccepting, setIsAccepting] = useState(true);
  const [durationParams, setDurationParams] = useState<number>(30);
  const [maxAppointments, setMaxAppointments] = useState<number | ''>('');
  const [isUnlimited, setIsUnlimited] = useState(true); // Illimité ?
  const [vacationStart, setVacationStart] = useState('');
  const [vacationEnd, setVacationEnd] = useState('');
  const [isOnVacation, setIsOnVacation] = useState(false);
  const [workingHoursStart, setWorkingHoursStart] = useState('08:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('17:00');
  const [bookingMode, setBookingMode] = useState<BookingSelectionMode>("patient_datetime");
  const [isUpdatingParams, setIsUpdatingParams] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [appointmentToSchedule, setAppointmentToSchedule] = useState<DoctorAppointment | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("08:00");
  const [isSchedulingAppointment, setIsSchedulingAppointment] = useState(false);
  const [dossierSourceAppointment, setDossierSourceAppointment] = useState<DoctorAppointment | null>(null);

  // Editable Profile Info
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [contactSettings, setContactSettings] = useState<DoctorContactSettings>(createEmptyDoctorContactSettings);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);

  const navButtonClasses = (isActive: boolean) =>
    `group flex w-full min-h-[62px] items-center gap-3 rounded-[22px] border px-4 py-3 text-start transition-all duration-200 ${
      isActive
        ? "border-blue-200 bg-gradient-to-r from-blue-50 to-white text-blue-700 font-semibold shadow-[0_18px_40px_-28px_rgba(37,99,235,0.7)] dark:border-blue-500/25 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.94))] dark:text-slate-50 dark:shadow-[0_18px_40px_-28px_rgba(59,130,246,0.45)]"
        : "border-slate-200/80 bg-white/80 text-slate-600 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900/95"
    }`;

  const navIconClasses = (isActive: boolean) =>
    `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors ${
      isActive
        ? "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-300/60 dark:bg-blue-100 dark:text-blue-700"
        : "border-slate-200 bg-slate-50 text-slate-500 group-hover:border-slate-300 group-hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:group-hover:border-slate-500 dark:group-hover:bg-slate-700"
    }`;

  const mobileSectionTitle = (
    {
      overview: t("dashboard.doctor.overview"),
      appointments: t("dashboard.doctor.appointments"),
      patients: t("dashboard.doctor.patients"),
      prescriptions: tr("Ordonnances", "Prescriptions", "الوصفات"),
      community: t("dashboard.doctor.community"),
      publications: t("dashboard.doctor.publications"),
      profile: t("dashboard.doctor.profile"),
      "ai-assistant": t("common.aiAssistant"),
    } as const
  )[activeTab];

  // Data
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [articles, setArticles] = useState<DoctorPublication[]>([]);

  // Medical Dossiers state
  const [dossiers, setDossiers] = useState<MedicalDossier[]>([]);
  const [dossierSearch, setDossierSearch] = useState('');
  const [selectedDossier, setSelectedDossier] = useState<MedicalDossier | null>(null);
  const [showNewDossierModal, setShowNewDossierModal] = useState(false);
  const [showNewVisitModal, setShowNewVisitModal] = useState(false);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [visitLoading, setVisitLoading] = useState(false);
  const [dossierVisits, setDossierVisits] = useState<DossierVisit[]>([]);
  const [dossierAppointmentHistory, setDossierAppointmentHistory] = useState<DoctorAppointment[]>([]);
  const [followUpAppointmentsByVisitId, setFollowUpAppointmentsByVisitId] = useState<Record<string, DoctorAppointment>>({});
  const [prescriptionsByVisitId, setPrescriptionsByVisitId] = useState<Record<string, VisitPrescription>>({});
  const [standalonePrescriptions, setStandalonePrescriptions] = useState<VisitPrescription[]>([]);
  const [standalonePrescriptionsLoading, setStandalonePrescriptionsLoading] = useState(false);
  const [dossierDetailsLoading, setDossierDetailsLoading] = useState(false);
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [prescriptionModalVisit, setPrescriptionModalVisit] = useState<DossierVisit | null>(null);
  const [isPrescriptionSaving, setIsPrescriptionSaving] = useState(false);
  const [standalonePrescriptionModalRecord, setStandalonePrescriptionModalRecord] = useState<VisitPrescription | null>(null);
  const [standalonePrescriptionLinkedDossierId, setStandalonePrescriptionLinkedDossierId] = useState("");
  const [standalonePrescriptionDraftResetKey, setStandalonePrescriptionDraftResetKey] = useState("standalone-closed");
  const [isStandalonePrescriptionModalOpen, setIsStandalonePrescriptionModalOpen] = useState(false);
  const [isStandalonePrescriptionSaving, setIsStandalonePrescriptionSaving] = useState(false);
  const [editingGeneralRemarks, setEditingGeneralRemarks] = useState(false);
  const [isAutoSavingGeneralRemarks, setIsAutoSavingGeneralRemarks] = useState(false);
  const [newDossierForm, setNewDossierForm] = useState(createEmptyDossierForm);
  const [newVisitForm, setNewVisitForm] = useState(createEmptyVisitForm);
  const [generalRemarksEdit, setGeneralRemarksEdit] = useState('');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const [allArticles, setAllArticles] = useState<CommunityArticle[]>([]);
  const [selectedCommunityDoctorDetails, setSelectedCommunityDoctorDetails] = useState<RecommendedDoctor | null>(null);
  const [likesByPost, setLikesByPost] = useState<Record<string, { count: number; likedByMe: boolean }>>({});
  const [savesByPost, setSavesByPost] = useState<Record<string, { count: number; savedByMe: boolean }>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommunityComment[]>>({});
  const [viewsByPost, setViewsByPost] = useState<Record<string, number>>({});
  const [commentDraftsByPostId, setCommentDraftsByPostId] = useState<Record<string, string>>({});
  const [commentSubmittingPostId, setCommentSubmittingPostId] = useState<string | null>(null);
  const [deletingPublicationId, setDeletingPublicationId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; id: string } | null>(null);
  const [reportReason, setReportReason] = useState("Contenu inapproprié");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

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
        // Best effort only: the dashboard keeps the last moderation snapshot.
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

  const [newArticle, setNewArticle] = useState<{ title: string; content: string; category: "conseil" | "maladie" }>({
    title: '',
    content: '',
    category: "conseil",
  });
  const [pendingPublicationImages, setPendingPublicationImages] = useState<PendingPublicationImage[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [appointmentsSortOrder, setAppointmentsSortOrder] = useState<SortOrder>("desc");
  const [dossiersSortOrder, setDossiersSortOrder] = useState<SortOrder>("desc");
  const [dossierHistorySortOrder, setDossierHistorySortOrder] = useState<SortOrder>("desc");
  const [isAutoSavingSettings, setIsAutoSavingSettings] = useState(false);
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const settingsHydratedRef = useRef(false);
  const lastSavedSettingsSnapshotRef = useRef("");
  const generalRemarksHydratedRef = useRef(false);
  const lastSavedGeneralRemarksRef = useRef("");
  const hasCompletedInitialLoadRef = useRef(false);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const manualRefreshTimerRef = useRef<number | null>(null);

  const getDbFixHint = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes("appointment_booking_mode")) {
      return "Script manquant détecté: exécutez `06_appointment_booking_modes.sql`, puis `NOTIFY pgrst, 'reload schema';`.";
    }
    if (lower.includes("working_hours_start") || lower.includes("working_hours_end")) {
      return "Script manquant détecté: exécutez `04_working_hours.sql`, puis `NOTIFY pgrst, 'reload schema';`.";
    }
    if (lower.includes("community_post_reports") || lower.includes("performance_events") || lower.includes("system_audit_logs")) {
      return "Script manquant détecté: exécutez `07_moderation_observability.sql`, puis `NOTIFY pgrst, 'reload schema';`.";
    }
    if (lower.includes("standalone_prescriptions") || lower.includes("standalone_prescription_items")) {
      return "Script manquant détecté: exécutez `21_standalone_prescriptions.sql`, puis `NOTIFY pgrst, 'reload schema';`.";
    }
    return "Veuillez exécuter les scripts SQL du dossier `back` dans l'ordre, puis forcez un rechargement du schéma avec `NOTIFY pgrst, 'reload schema';`.";
  };

  const getSortButtonClasses = (isActive: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition ${
      isActive
        ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  const sortedAppointments = sortItemsByDate(appointments, (appointment) => appointment.created_at, appointmentsSortOrder);
  const sortedDossiers = sortItemsByDate(dossiers, (dossier) => dossier.created_at, dossiersSortOrder);
  const normalizedDossierSearch = dossierSearch.trim().toLowerCase();
  const filteredDossiers = sortedDossiers.filter((dossier) =>
    [
      `${dossier.first_name} ${dossier.last_name}`,
      dossier.patient_registration_number ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedDossierSearch)
  );
  const chronologicalDossierAppointmentHistory = sortAppointmentsChronologically(dossierAppointmentHistory, "asc");
  const sortedDossierAppointmentHistory = sortItemsByDate(dossierAppointmentHistory, (appointment) => appointment.created_at, dossierHistorySortOrder);
  const sortedDossierVisits = sortItemsByDate(dossierVisits, (visit) => visit.created_at, dossierHistorySortOrder);
  const selectedStandaloneLinkedDossier = standalonePrescriptionLinkedDossierId
    ? (dossiers.find((dossier) => dossier.id === standalonePrescriptionLinkedDossierId) ?? null)
    : null;
  const selectedDossierId = selectedDossier?.id ?? null;
  const selectedDossierGeneralRemarks = selectedDossier?.general_remarks ?? "";
  const activeVisitAppointment = getPinnedDoctorVisitAppointment(
    appointments,
    Math.max(5, durationParams || 30),
    currentTime
  );
  const activeVisitLinkedDossier = activeVisitAppointment?.patient_id
    ? (dossiers.find((dossier) => dossier.patient_id === activeVisitAppointment.patient_id) ?? null)
    : null;
  const sortedAppointmentsWithPinnedVisit = activeVisitAppointment
    ? [
        activeVisitAppointment,
        ...sortedAppointments.filter((appointment) => appointment.id !== activeVisitAppointment.id),
      ]
    : sortedAppointments;

  const isMissingCommunityViewsTable = (error: unknown) => {
    if (!error || typeof error !== "object") {
      return false;
    }

    const message = "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";
    return message.includes("community_post_views") || message.includes("could not find the table");
  };

  useEffect(() => {
    const tab = searchParams.get("tab");
    const normalizedTab = tab === "articles" ? "community" : tab;
    const allowedTabs = new Set(["appointments", "patients", "prescriptions", "community", "publications", "profile", "ai-assistant"]);
    if (normalizedTab && allowedTabs.has(normalizedTab)) {
      setActiveTab(normalizedTab);
    }
  }, [searchParams]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

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
    if (realtimeRefreshTimerRef.current) {
      return;
    }
    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      setRefreshCounter((current) => current + 1);
      realtimeRefreshTimerRef.current = null;
    }, 450);
  };

  const alert = (message: unknown) => {
    const text = String(message ?? "Une erreur est survenue.");
    const lower = text.toLowerCase();
    if (lower.includes("erreur") || lower.includes("invalid") || lower.includes("impossible")) {
      showNotice(text, "error");
      return;
    }
    if (lower.includes("succès") || lower.includes("enregistr") || lower.includes("publié")) {
      showNotice(text, "success");
      return;
    }
    showNotice(text, "info");
  };

  const closeNewDossierModal = () => {
    setShowNewDossierModal(false);
    setDossierSourceAppointment(null);
    setNewDossierForm(createEmptyDossierForm());
  };

  const getPublicPrescriptionUrl = (publicToken: string | null | undefined) => {
    if (typeof window === "undefined") {
      return null;
    }

    return buildPrescriptionPublicUrl(publicToken, {
      configuredOrigin: process.env.NEXT_PUBLIC_APP_BASE_URL,
      runtimeOrigin: window.location.origin,
    });
  };

  const loadStandalonePrescriptions = async () => {
    if (!profile?.id) {
      return;
    }

    setStandalonePrescriptionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("standalone_prescriptions")
        .select(STANDALONE_PRESCRIPTION_SELECT)
        .eq("doctor_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const normalized = ((data as (Omit<VisitPrescription, "visit_id" | "items"> & {
        visit_id?: string | null;
        items?: VisitPrescriptionItem[] | null;
      })[] | null) ?? []).map((prescription) => normalizeStandalonePrescription(prescription));

      setStandalonePrescriptions(normalized);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tr(
              "Impossible de charger les ordonnances.",
              "Unable to load prescriptions.",
              "تعذر تحميل الوصفات."
            );

      showNotice(`${message} ${getDbFixHint(message)}`, "error");
      setStandalonePrescriptions([]);
    } finally {
      setStandalonePrescriptionsLoading(false);
    }
  };

  const openStandalonePrescriptionComposer = (prescription: VisitPrescription | null = null) => {
    const nextDraftKey = prescription
      ? `standalone-existing-${prescription.id}`
      : `standalone-new-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`;

    setStandalonePrescriptionDraftResetKey(nextDraftKey);
    if (prescription) {
      setStandalonePrescriptionLinkedDossierId(prescription.dossier_id ?? "");
      setStandalonePrescriptionModalRecord(prescription);
    } else {
      setStandalonePrescriptionModalRecord(null);
    }
    setIsStandalonePrescriptionModalOpen(true);
  };

  const closeStandalonePrescriptionComposer = () => {
    setIsStandalonePrescriptionModalOpen(false);
    setStandalonePrescriptionModalRecord(null);
  };

  const copyStandalonePrescriptionLink = async (publicToken: string) => {
    const publicUrl = getPublicPrescriptionUrl(publicToken);
    if (!publicUrl) {
      showNotice(
        tr(
          "Le lien public de l'ordonnance est indisponible pour le moment.",
          "The public prescription link is unavailable right now.",
          "رابط الوصفة العامة غير متاح حالياً."
        ),
        "error"
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      showNotice(
        tr(
          "Lien public de l'ordonnance copié.",
          "Public prescription link copied.",
          "تم نسخ رابط الوصفة العامة."
        ),
        "success"
      );
    } catch {
      showNotice(
        tr(
          "Impossible de copier le lien public.",
          "Unable to copy the public link.",
          "تعذر نسخ الرابط العام."
        ),
        "error"
      );
    }
  };

  const deleteStandalonePrescription = async (prescription: VisitPrescription) => {
    const confirmed = window.confirm(
      tr(
        "Supprimer définitivement cette ordonnance libre ?",
        "Delete this standalone prescription permanently?",
        "حذف هذه الوصفة الحرة نهائياً؟"
      )
    );

    if (!confirmed || !profile?.id) {
      return;
    }

    try {
      const { error } = await supabase
        .from("standalone_prescriptions")
        .delete()
        .eq("id", prescription.id);

      if (error) {
        throw error;
      }

      setStandalonePrescriptions((current) => current.filter((item) => item.id !== prescription.id));

      await logAuditEvent({
        actorId: profile.id,
        action: "standalone_prescription_deleted",
        entityType: "standalone_prescription",
        entityId: prescription.id,
        metadata: {
          dossier_id: prescription.dossier_id,
          patient_id: prescription.patient_id,
        },
      });

      showNotice(
        tr(
          "Ordonnance supprimée.",
          "Prescription deleted.",
          "تم حذف الوصفة."
        ),
        "success"
      );
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : tr(
              "Impossible de supprimer l'ordonnance.",
              "Unable to delete the prescription.",
              "تعذر حذف الوصفة."
            ),
        "error"
      );
    }
  };

  const saveStandalonePrescription = async (
    draft: VisitPrescriptionDraft,
    options?: { closeAfterSave?: boolean; quiet?: boolean }
  ): Promise<VisitPrescription | null> => {
    if (!profile) {
      if (!options?.quiet) {
        showNotice(tr("Profil introuvable.", "Profile not found.", "الملف الشخصي غير موجود."), "error");
      }
      return null;
    }

    const normalizedItems = draft.items
      .map((item, index) => ({
        id: item.id,
        line_number: index + 1,
        medication_name: item.medication_name.trim(),
        dosage: item.dosage.trim(),
        instructions: item.instructions.trim(),
        duration: item.duration.trim(),
      }))
      .filter((item) => item.medication_name.length > 0);

    if (normalizedItems.length === 0) {
      if (!options?.quiet) {
        showNotice(
          tr(
            "Ajoutez au moins un médicament avant d'enregistrer l'ordonnance.",
            "Add at least one medicine before saving the prescription.",
            "أضف دواءً واحداً على الأقل قبل حفظ الوصفة."
          ),
          "error"
        );
      }
      return null;
    }

    const linkedDossier = standalonePrescriptionLinkedDossierId
      ? (dossiers.find((dossier) => dossier.id === standalonePrescriptionLinkedDossierId) ?? null)
      : null;

    const existingPrescription = standalonePrescriptionModalRecord;
    const payload = {
      doctor_id: profile.id,
      dossier_id: linkedDossier?.id ?? null,
      patient_id: linkedDossier?.patient_id ?? null,
      patient_registration_number: linkedDossier?.patient_registration_number ?? null,
      prescription_date: draft.prescription_date,
      patient_display_name: draft.patient_display_name.trim(),
      doctor_display_name: draft.doctor_display_name.trim(),
      doctor_specialty: draft.doctor_specialty.trim() || null,
      doctor_address: draft.doctor_address.trim() || null,
      doctor_phone: draft.doctor_phone.trim() || null,
      signature_label: draft.signature_label.trim() || draft.doctor_display_name.trim(),
      notes: draft.notes.trim() || null,
    };

    setIsStandalonePrescriptionSaving(true);

    try {
      const prescriptionQuery = existingPrescription
        ? supabase
            .from("standalone_prescriptions")
            .update(payload)
            .eq("id", existingPrescription.id)
        : supabase.from("standalone_prescriptions").insert(payload);

      const { data: savedPrescriptionData, error: savedPrescriptionError } = await prescriptionQuery
        .select("id, dossier_id, doctor_id, patient_id, patient_registration_number, prescription_number, public_token, prescription_date, patient_display_name, doctor_display_name, doctor_specialty, doctor_address, doctor_phone, signature_label, notes, created_at, updated_at")
        .single();

      if (savedPrescriptionError) {
        throw savedPrescriptionError;
      }

      const savedPrescriptionBase = savedPrescriptionData as Omit<VisitPrescription, "visit_id" | "items">;

      const { error: deleteItemsError } = await supabase
        .from("standalone_prescription_items")
        .delete()
        .eq("prescription_id", savedPrescriptionBase.id);

      if (deleteItemsError) {
        throw deleteItemsError;
      }

      let savedItems: VisitPrescriptionItem[] = [];

      const { data: insertedItemsData, error: insertedItemsError } = await supabase
        .from("standalone_prescription_items")
        .insert(
          normalizedItems.map((item) => ({
            prescription_id: savedPrescriptionBase.id,
            line_number: item.line_number,
            medication_name: item.medication_name,
            dosage: item.dosage || null,
            instructions: item.instructions || null,
            duration: item.duration || null,
          }))
        )
        .select("id, prescription_id, line_number, medication_name, dosage, instructions, duration, created_at, updated_at");

      if (insertedItemsError) {
        throw insertedItemsError;
      }

      savedItems = sortPrescriptionItems((insertedItemsData as VisitPrescriptionItem[] | null) ?? []);

      const normalizedPrescription = normalizeStandalonePrescription({
        ...savedPrescriptionBase,
        visit_id: null,
        items: savedItems,
      });

      setStandalonePrescriptions((current) =>
        sortItemsByDate(
          [normalizedPrescription, ...current.filter((item) => item.id !== normalizedPrescription.id)],
          (item) => item.created_at,
          "desc"
        )
      );
      setStandalonePrescriptionModalRecord(normalizedPrescription);

      await logAuditEvent({
        actorId: profile.id,
        action: existingPrescription ? "standalone_prescription_updated" : "standalone_prescription_created",
        entityType: "standalone_prescription",
        entityId: normalizedPrescription.id,
        metadata: {
          dossier_id: linkedDossier?.id ?? null,
          patient_id: linkedDossier?.patient_id ?? null,
          medication_count: normalizedItems.length,
        },
      });

      if (options?.closeAfterSave) {
        closeStandalonePrescriptionComposer();
      }

      if (!options?.quiet) {
        showNotice(
          existingPrescription
            ? tr(
                "Ordonnance mise à jour. La copie publique est prête.",
                "Prescription updated. The public copy is ready.",
                "تم تحديث الوصفة. النسخة العامة جاهزة."
              )
            : tr(
                "Ordonnance créée. Vous pouvez maintenant l'imprimer, même sans dossier médical.",
                "Prescription created. You can now print it, even without a medical record.",
                "تم إنشاء الوصفة. يمكنك الآن طباعتها حتى بدون ملف طبي."
              ),
          "success"
        );
      }

      return normalizedPrescription;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tr(
              "Impossible d'enregistrer l'ordonnance.",
              "Unable to save the prescription.",
              "تعذر حفظ الوصفة."
            );

      if (!options?.quiet) {
        showNotice(`${message} ${getDbFixHint(message)}`, "error");
      }
      return null;
    } finally {
      setIsStandalonePrescriptionSaving(false);
    }
  };

  const saveVisitPrescription = async (
    draft: VisitPrescriptionDraft,
    options?: { closeAfterSave?: boolean; quiet?: boolean }
  ): Promise<VisitPrescription | null> => {
    if (!profile || !selectedDossier || !prescriptionModalVisit) {
      if (!options?.quiet) {
        showNotice(tr("Contexte de consultation introuvable.", "Visit context not found.", "تعذر العثور على سياق الزيارة."), "error");
      }
      return null;
    }

    const normalizedItems = draft.items
      .map((item, index) => ({
        id: item.id,
        line_number: index + 1,
        medication_name: item.medication_name.trim(),
        dosage: item.dosage.trim(),
        instructions: item.instructions.trim(),
        duration: item.duration.trim(),
      }))
      .filter((item) => item.medication_name.length > 0);

    if (normalizedItems.length === 0) {
      if (!options?.quiet) {
        showNotice(
          tr(
            "Ajoutez au moins un médicament avant d'enregistrer l'ordonnance.",
            "Add at least one medicine before saving the prescription.",
            "أضف دواءً واحداً على الأقل قبل حفظ الوصفة."
          ),
          "error"
        );
      }
      return null;
    }

    const existingPrescription = prescriptionsByVisitId[prescriptionModalVisit.id] ?? null;
    const payload = {
      visit_id: prescriptionModalVisit.id,
      dossier_id: selectedDossier.id,
      doctor_id: profile.id,
      patient_id: selectedDossier.patient_id ?? null,
      prescription_date: draft.prescription_date,
      patient_display_name: draft.patient_display_name.trim(),
      doctor_display_name: draft.doctor_display_name.trim(),
      doctor_specialty: draft.doctor_specialty.trim() || null,
      doctor_address: draft.doctor_address.trim() || null,
      doctor_phone: draft.doctor_phone.trim() || null,
      signature_label: draft.signature_label.trim() || draft.doctor_display_name.trim(),
      notes: draft.notes.trim() || null,
    };

    setIsPrescriptionSaving(true);

    try {
      const prescriptionQuery = existingPrescription
        ? supabase
            .from("visit_prescriptions")
            .update(payload)
            .eq("id", existingPrescription.id)
        : supabase.from("visit_prescriptions").insert(payload);

      const { data: savedPrescriptionData, error: savedPrescriptionError } = await prescriptionQuery
        .select("id, visit_id, dossier_id, doctor_id, patient_id, prescription_number, public_token, prescription_date, patient_display_name, doctor_display_name, doctor_specialty, doctor_address, doctor_phone, signature_label, notes, created_at, updated_at")
        .single();

      if (savedPrescriptionError) {
        throw savedPrescriptionError;
      }

      const savedPrescriptionBase = savedPrescriptionData as Omit<VisitPrescription, "items">;

      const { error: deleteItemsError } = await supabase
        .from("visit_prescription_items")
        .delete()
        .eq("prescription_id", savedPrescriptionBase.id);

      if (deleteItemsError) {
        throw deleteItemsError;
      }

      let savedItems: VisitPrescriptionItem[] = [];

      if (normalizedItems.length > 0) {
        const { data: insertedItemsData, error: insertedItemsError } = await supabase
          .from("visit_prescription_items")
          .insert(
            normalizedItems.map((item) => ({
              prescription_id: savedPrescriptionBase.id,
              line_number: item.line_number,
              medication_name: item.medication_name,
              dosage: item.dosage || null,
              instructions: item.instructions || null,
              duration: item.duration || null,
            }))
          )
          .select("id, prescription_id, line_number, medication_name, dosage, instructions, duration, created_at, updated_at");

        if (insertedItemsError) {
          throw insertedItemsError;
        }

        savedItems = sortPrescriptionItems((insertedItemsData as VisitPrescriptionItem[] | null) ?? []);
      }

      const normalizedPrescription = normalizeVisitPrescription({
        ...savedPrescriptionBase,
        items: savedItems,
      });

      setPrescriptionsByVisitId((current) => ({
        ...current,
        [prescriptionModalVisit.id]: normalizedPrescription,
      }));

      await logAuditEvent({
        actorId: profile.id,
        action: existingPrescription ? "visit_prescription_updated" : "visit_prescription_created",
        entityType: "visit_prescription",
        entityId: normalizedPrescription.id,
        metadata: {
          visit_id: prescriptionModalVisit.id,
          dossier_id: selectedDossier.id,
          medication_count: normalizedItems.length,
        },
      });

      if (options?.closeAfterSave) {
        setPrescriptionModalVisit(null);
      }

      if (!options?.quiet) {
        showNotice(
          existingPrescription
            ? tr(
                "Ordonnance mise a jour. La copie publique et le QR code sont prets.",
                "Prescription updated. The public copy and QR code are ready.",
                "تم تحديث الوصفة. النسخة العامة ورمز QR جاهزان."
              )
            : tr(
                "Ordonnance creee avec succes. Vous pouvez maintenant l'imprimer et partager son QR code.",
                "Prescription created successfully. You can now print it and share its QR code.",
                "تم إنشاء الوصفة بنجاح. يمكنك الآن طباعتها ومشاركة رمز QR الخاص بها."
              ),
          "success"
        );
      }

      return normalizedPrescription;
    } catch (error) {
      console.error("Unable to save prescription", error);
      if (!options?.quiet) {
        showNotice(
          error instanceof Error
            ? error.message
            : tr("Impossible d'enregistrer l'ordonnance.", "Unable to save the prescription.", "تعذر حفظ الوصفة."),
          "error"
        );
      }
      return null;
    } finally {
      setIsPrescriptionSaving(false);
    }
  };

  const loadDossierDetails = async (dossier: MedicalDossier) => {
    setSelectedDossier(dossier);
    setGeneralRemarksEdit(dossier.general_remarks ?? "");
    setEditingGeneralRemarks(false);
    setExpandedVisitId(null);
    setPrescriptionModalVisit(null);
    setFollowUpAppointmentsByVisitId({});
    setPrescriptionsByVisitId({});
    setDossierDetailsLoading(true);

    try {
      const visitsPromise = supabase
        .from("dossier_visits")
        .select("*")
        .eq("dossier_id", dossier.id)
        .order("created_at", { ascending: false });

      const appointmentHistoryPromise = dossier.patient_id
        ? supabase
            .from("appointments")
            .select("id, patient_id, created_at, appointment_date, status, booking_selection_mode, requested_date, requested_time, appointment_source, follow_up_visit_id, follow_up_dossier_id, follow_up_time_pending, follow_up_reminder_days, notes")
            .eq("doctor_id", dossier.doctor_id)
            .eq("patient_id", dossier.patient_id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null });

      const followUpAppointmentsPromise = dossier.patient_id
        ? supabase
            .from("appointments")
            .select("id, patient_id, created_at, appointment_date, status, booking_selection_mode, requested_date, requested_time, appointment_source, follow_up_visit_id, follow_up_dossier_id, follow_up_time_pending, follow_up_reminder_days, notes")
            .eq("doctor_id", dossier.doctor_id)
            .eq("follow_up_dossier_id", dossier.id)
        : Promise.resolve({ data: [], error: null });

      const [visitsResult, appointmentHistoryResult, followUpAppointmentsResult] = await Promise.all([
        visitsPromise,
        appointmentHistoryPromise,
        followUpAppointmentsPromise,
      ]);

      if (visitsResult.error) {
        throw visitsResult.error;
      }

      if (appointmentHistoryResult.error) {
        throw appointmentHistoryResult.error;
      }

      if (followUpAppointmentsResult.error) {
        throw followUpAppointmentsResult.error;
      }

      const loadedVisits = (visitsResult.data as DossierVisit[]) ?? [];
      setDossierVisits(loadedVisits);
      setDossierAppointmentHistory(
        sortItemsByDate(
          ((appointmentHistoryResult.data as DoctorAppointment[] | null) ?? []).map((appointment) =>
            normalizeDoctorAppointment({
              ...appointment,
              patient: null,
            })
          ),
          (appointment) => appointment.created_at,
          "desc"
        )
      );

      const normalizedFollowUps = ((followUpAppointmentsResult.data as DoctorAppointment[] | null) ?? []).map((appointment) =>
        normalizeDoctorAppointment({
          ...appointment,
          patient: null,
        })
      );

      setFollowUpAppointmentsByVisitId(
        normalizedFollowUps.reduce<Record<string, DoctorAppointment>>((accumulator, appointment) => {
          if (appointment.follow_up_visit_id) {
            accumulator[appointment.follow_up_visit_id] = appointment;
          }
          return accumulator;
        }, {})
      );

      if (loadedVisits.length > 0) {
        const { data: prescriptionData, error: prescriptionError } = await supabase
          .from("visit_prescriptions")
          .select(VISIT_PRESCRIPTION_SELECT)
          .in("visit_id", loadedVisits.map((visit) => visit.id));

        if (prescriptionError) {
          console.warn("Unable to load visit prescriptions", prescriptionError);
          setPrescriptionsByVisitId({});
        } else {
          const normalizedPrescriptions = ((prescriptionData as (VisitPrescription & { items?: VisitPrescriptionItem[] | null })[] | null) ?? [])
            .map((prescription) => normalizeVisitPrescription(prescription));

          setPrescriptionsByVisitId(
            normalizedPrescriptions.reduce<Record<string, VisitPrescription>>((accumulator, prescription) => {
              if (prescription.visit_id) {
                accumulator[prescription.visit_id] = prescription;
              }
              return accumulator;
            }, {})
          );
        }
      } else {
        setPrescriptionsByVisitId({});
      }
    } catch (error) {
      console.error("Unable to load dossier details", error);
      showNotice(tr("Impossible de charger le détail du dossier.", "Unable to load record details.", "تعذر تحميل تفاصيل الملف الطبي."), "error");
      setDossierVisits([]);
      setDossierAppointmentHistory([]);
      setFollowUpAppointmentsByVisitId({});
      setPrescriptionsByVisitId({});
    } finally {
      setDossierDetailsLoading(false);
    }
  };

  const openDossierDetails = async (dossier: MedicalDossier) => {
    setActiveTab("patients");
    await loadDossierDetails(dossier);
  };

  const openEmptyDossierModal = () => {
    setDossierSourceAppointment(null);
    setNewDossierForm(createEmptyDossierForm());
    setShowNewDossierModal(true);
  };

  const openAppointmentWorkspace = async (appointment: DoctorAppointment) => {
    const linkedDossier = appointment.patient_id
      ? (dossiers.find((dossier) => dossier.patient_id === appointment.patient_id) ?? null)
      : null;

    if (linkedDossier) {
      await openDossierDetails(linkedDossier);
      setEditingGeneralRemarks(true);
      setGeneralRemarksEdit(linkedDossier.general_remarks ?? "");
      showNotice(
        tr(
          "Le dossier médical du patient est ouvert. Vous pouvez écrire, la sauvegarde est automatique.",
          "The patient medical record is open. You can write now, auto-save is active.",
          "تم فتح الملف الطبي للمريض. يمكنك الكتابة الآن والحفظ التلقائي مفعّل."
        ),
        "success"
      );
      return;
    }

    await openDossierModalFromAppointment(appointment);
  };

  const openDossierModalFromAppointment = async (appointment: DoctorAppointment) => {
    if (appointment.patient_id) {
      const existingDossier = dossiers.find((dossier) => dossier.patient_id === appointment.patient_id);
      if (existingDossier) {
        await openDossierDetails(existingDossier);
        showNotice(
          tr(
            "Un dossier existe déjà pour ce patient. Il a été ouvert directement.",
            "A record already exists for this patient. It has been opened directly.",
            "يوجد بالفعل ملف طبي لهذا المريض. تم فتحه مباشرة."
          ),
          "info"
        );
        return;
      }
    }

    const { firstName, lastName } = splitFullName(appointment.patient?.full_name);
    setDossierSourceAppointment(appointment);
    setNewDossierForm({
      ...createEmptyDossierForm(),
      first_name: firstName,
      last_name: lastName,
      gender: appointment.patient?.gender ?? "",
    });
    setActiveTab("patients");
    setShowNewDossierModal(true);
  };

  const handleCreateDossier = async () => {
    if (!newDossierForm.first_name.trim() || !newDossierForm.last_name.trim()) {
      showNotice(tr("Prénom et nom requis", "First and last name are required", "الاسم واللقب مطلوبان"), "error");
      return;
    }

    setDossierLoading(true);
    try {
      const { user } = await getStableAuthUser();
      if (!user) {
        throw new Error(tr("Non authentifié", "Not authenticated", "المستخدم غير موثق"));
      }

      const { data, error } = await supabase
        .from("medical_dossiers")
        .insert({
          doctor_id: user.id,
          patient_id: dossierSourceAppointment?.patient_id ?? null,
          first_name: newDossierForm.first_name.trim(),
          last_name: newDossierForm.last_name.trim(),
          phone: newDossierForm.phone || null,
          email: newDossierForm.email || null,
          date_of_birth: newDossierForm.date_of_birth || null,
          gender: newDossierForm.gender || null,
          blood_type: newDossierForm.blood_type || null,
          allergies: newDossierForm.allergies || null,
          chronic_conditions: newDossierForm.chronic_conditions || null,
          general_remarks: newDossierForm.general_remarks || null,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const createdDossier = data as MedicalDossier;
      setDossiers((current) => [createdDossier, ...current.filter((dossier) => dossier.id !== createdDossier.id)]);
      closeNewDossierModal();
      setActiveTab("patients");
      await loadDossierDetails(createdDossier);
      await logAuditEvent({
        actorId: user.id,
        action: dossierSourceAppointment ? "medical_dossier_created_from_appointment" : "medical_dossier_created",
        entityType: "medical_dossier",
        entityId: createdDossier.id,
        metadata: {
          appointment_id: dossierSourceAppointment?.id ?? null,
          patient_id: createdDossier.patient_id ?? null,
        },
      });
      showNotice(
        dossierSourceAppointment
          ? tr(
              "Dossier créé et lié au rendez-vous du patient.",
              "Record created and linked to the patient's appointment.",
              "تم إنشاء الملف وربطه بموعد المريض."
            )
          : tr("Dossier créé avec succès !", "Record created successfully!", "تم إنشاء الملف الطبي بنجاح!"),
        "success"
      );
    } catch (error: unknown) {
      showNotice((error as Error).message, "error");
    } finally {
      setDossierLoading(false);
    }
  };

  const computeSettingsSnapshot = () => {
    const normalizedDuration = Number(durationParams);
    const normalizedMaxAppointments = isUnlimited ? null : (maxAppointments === '' ? null : Number(maxAppointments));
    return JSON.stringify({
      full_name: fullName.trim() || null,
      address: address.trim() || null,
      latitude,
      longitude,
      specialty: specialty.trim() || null,
      bio: bio.trim() || null,
      gender: gender || null,
      avatar_url: avatarUrl.trim() || null,
      google_maps_link: googleMapsLink.trim() || null,
      contact_settings: sanitizeDoctorContactSettings(contactSettings),
      is_accepting_appointments: isAccepting,
      appointment_duration_minutes: Number.isFinite(normalizedDuration) ? normalizedDuration : durationParams,
      max_appointments_per_day: normalizedMaxAppointments,
      vacation_start: vacationStart || null,
      vacation_end: vacationEnd || null,
      is_on_vacation: isOnVacation,
      working_hours_start: normalizeTimeValue(workingHoursStart, "08:00"),
      working_hours_end: normalizeTimeValue(workingHoursEnd, "17:00"),
      appointment_booking_mode: bookingMode,
    });
  };

  const updateContactValue = (valueKey: DoctorContactValueKey, enabledKey: DoctorContactToggleKey, value: string) => {
    setContactSettings((current) => {
      const trimmedValue = value.trimStart();
      return {
        ...current,
        [valueKey]: trimmedValue,
        [enabledKey]: trimmedValue.trim().length > 0 ? current[enabledKey] : false,
      };
    });
  };

  const toggleContactVisibility = (valueKey: DoctorContactValueKey, enabledKey: DoctorContactToggleKey) => {
    setContactSettings((current) => {
      const hasValue = current[valueKey].trim().length > 0;
      if (!hasValue) {
        return current;
      }

      return {
        ...current,
        [enabledKey]: !current[enabledKey],
      };
    });
  };

  const publicContactSettings = sanitizeDoctorContactSettings(contactSettings);

  const clearPendingPublicationImages = () => {
    setPendingPublicationImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
  };

  const handleUseCurrentLocation = async () => {
    if (!profile) {
      return;
    }

    setIsResolvingLocation(true);
    try {
      const resolvedLocation = await getBrowserLocation(language);
      const nextAddress =
        resolvedLocation.address ||
        resolvedLocation.rawAddress ||
        address ||
        profile.address ||
        "";

      setAddress(nextAddress);
      setLocationAccuracy(resolvedLocation.accuracy);
      showNotice(
        tr(
          "Position GPS appliquée aux paramètres du cabinet.",
          "GPS location applied to the practice settings.",
          "تم تطبيق موقع GPS على إعدادات العيادة."
        ),
        "success"
      );
    } catch {
      showNotice(
        tr(
          "Impossible de récupérer votre position exacte. Vérifiez l'autorisation GPS du navigateur.",
          "Unable to get your exact location. Please check the browser GPS permission.",
          "تعذر الحصول على موقعك الدقيق. يرجى التحقق من إذن GPS في المتصفح."
        ),
        "error"
      );
    } finally {
      setIsResolvingLocation(false);
    }
  };

  useEffect(() => {
    return () => {
      pendingPublicationImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [pendingPublicationImages]);

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
          "auth.user.doctor",
        );

        if (authError?.includes("Refresh Token Not Found")) {
          await supabase.auth.signOut();
          shouldKeepLoadingForRedirect = true;
          router.replace("/login");
          return;
        }

        if (!user) {
          if (hasTokenSnapshot) {
            setDbError(
              tr(
                "La session est en cours de restauration. Réessayez dans quelques secondes.",
                "Your session is being restored. Please try again in a few seconds.",
                "تتم الآن استعادة الجلسة. يرجى المحاولة بعد بضع ثوانٍ.",
              ),
            );
            return;
          }

          shouldKeepLoadingForRedirect = true;
          router.replace("/login");
          return;
        }

        const [
          profileResult,
          appointmentsResult,
          dossiersResult,
          articlesResult,
          allArticlesResult,
        ] = await withTimeout(
          Promise.all([
            supabase
              .from("profiles")
              .select(
                "id, full_name, avatar_url, account_type, specialty, address, latitude, longitude, bio, gender, is_accepting_appointments, appointment_duration_minutes, max_appointments_per_day, vacation_start, vacation_end, is_on_vacation, working_hours_start, working_hours_end, appointment_booking_mode, is_platform_admin, google_maps_link, contact_phone, contact_phone_enabled, contact_email, contact_email_enabled, facebook_url, facebook_enabled, instagram_url, instagram_enabled, x_url, x_enabled, whatsapp_url, whatsapp_enabled, telegram_url, telegram_enabled, linkedin_url, linkedin_enabled, gmail_url, gmail_enabled",
              )
              .eq("id", user.id)
              .single(),
            supabase
              .from("appointments")
              .select(
                "id, patient_id, created_at, appointment_date, status, booking_selection_mode, requested_date, requested_time, appointment_source, follow_up_visit_id, follow_up_dossier_id, follow_up_time_pending, follow_up_reminder_days, notes, patient:profiles!patient_id(id, full_name, gender, patient_registration_number)",
              )
              .eq("doctor_id", user.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("medical_dossiers")
              .select("*")
              .eq("doctor_id", user.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("community_posts")
              .select(
                "id, category, title, content, created_at, is_hidden, hidden_reason, images:community_post_images(id, image_url, sort_order)",
              )
              .eq("doctor_id", user.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("community_posts")
              .select(
                "id, doctor_id, category, title, content, created_at, author:profiles!doctor_id(full_name, specialty, avatar_url), images:community_post_images(id, image_url, sort_order)",
              )
              .eq("is_hidden", false)
              .order("created_at", { ascending: false }),
          ]),
          DASHBOARD_QUERY_TIMEOUT_MS,
          "doctor_dashboard.initial_queries",
        );

        if (!isMounted) {
          return;
        }

        if (profileResult.error || !profileResult.data) {
          if (hasTokenSnapshot) {
            setDbError(
              tr(
                "Le profil du tableau de bord est temporairement indisponible. Réessayez dans quelques secondes.",
                "The dashboard profile is temporarily unavailable. Please try again in a few seconds.",
                "ملف لوحة التحكم غير متاح مؤقتاً. يرجى المحاولة بعد بضع ثوانٍ.",
              ),
            );
            return;
          }

          shouldKeepLoadingForRedirect = true;
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        let governancePatch: Partial<DoctorProfile> = {};
        try {
          const governanceResult = await withTimeout(
            supabase
              .from("profiles")
              .select(
                "doctor_verification_status, is_doctor_verified, doctor_verification_note, doctor_verification_requested_at, moderation_status, moderation_reason",
              )
              .eq("id", user.id)
              .single(),
            DASHBOARD_QUERY_TIMEOUT_MS,
            "doctor_dashboard.profile_governance",
          );

          if (!governanceResult.error && governanceResult.data) {
            governancePatch = governanceResult.data as Partial<DoctorProfile>;
          }
        } catch {
          governancePatch = {};
        }

        const userProfile = normalizeDoctorProfile(
          {
            ...clearExpiredVacationFlag(profileResult.data),
            ...governancePatch,
          },
          user.email,
        );
        const effectiveOnVacation = Boolean(userProfile?.is_on_vacation && !hasDoctorVacationExpired(userProfile));
        if (userProfile?.account_type === "patient") {
          shouldKeepLoadingForRedirect = true;
          router.replace("/patient-dashboard");
          return;
        }
        setProfile(userProfile);
        setIsAccepting(userProfile?.is_accepting_appointments ?? true);
        setDurationParams(userProfile?.appointment_duration_minutes ?? 30);
        setMaxAppointments(userProfile?.max_appointments_per_day ?? '');
        setIsUnlimited(userProfile?.max_appointments_per_day === null);
        setVacationStart(userProfile?.vacation_start ?? '');
        setVacationEnd(userProfile?.vacation_end ?? '');
        setIsOnVacation(effectiveOnVacation);
        setWorkingHoursStart(normalizeTimeValue(userProfile?.working_hours_start, '08:00'));
        setWorkingHoursEnd(normalizeTimeValue(userProfile?.working_hours_end, '17:00'));
        setBookingMode(userProfile?.appointment_booking_mode ?? "patient_datetime");

        setFullName(userProfile?.full_name ?? '');
        setAddress(userProfile?.address ?? '');
        setLatitude(userProfile?.latitude ?? null);
        setLongitude(userProfile?.longitude ?? null);
        setSpecialty(userProfile?.specialty ?? '');
        setBio(userProfile?.bio ?? '');
        setGender(userProfile?.gender ?? '');
        setAvatarUrl(userProfile?.avatar_url ?? '');
        setGoogleMapsLink(userProfile?.google_maps_link ?? '');
        setContactSettings(normalizeDoctorContactSettings(userProfile));
        settingsHydratedRef.current = true;
        lastSavedSettingsSnapshotRef.current = JSON.stringify({
          full_name: userProfile?.full_name ?? null,
          address: userProfile?.address ?? null,
          latitude: userProfile?.latitude ?? null,
          longitude: userProfile?.longitude ?? null,
          specialty: userProfile?.specialty ?? null,
          bio: userProfile?.bio ?? null,
          gender: userProfile?.gender ?? null,
          avatar_url: userProfile?.avatar_url ?? null,
          google_maps_link: userProfile?.google_maps_link ?? null,
          contact_settings: sanitizeDoctorContactSettings(normalizeDoctorContactSettings(userProfile)),
          is_accepting_appointments: userProfile?.is_accepting_appointments ?? true,
          appointment_duration_minutes: userProfile?.appointment_duration_minutes ?? 30,
          max_appointments_per_day: userProfile?.max_appointments_per_day ?? null,
          vacation_start: userProfile?.vacation_start ?? null,
          vacation_end: userProfile?.vacation_end ?? null,
          is_on_vacation: effectiveOnVacation,
          working_hours_start: normalizeTimeValue(userProfile?.working_hours_start, '08:00'),
          working_hours_end: normalizeTimeValue(userProfile?.working_hours_end, '17:00'),
          appointment_booking_mode: userProfile?.appointment_booking_mode ?? "patient_datetime",
        });

        const appts = appointmentsResult.data;
        if (appts) {
          setAppointments(
            sortItemsByDate(
              appts.map((appointment) => normalizeDoctorAppointment(appointment)),
              (appointment) => appointment.created_at,
              "desc"
            )
          );
        }

        setDossiers((dossiersResult.data as MedicalDossier[]) ?? []);

        const arts = articlesResult.data;
        if (arts) {
          const normalizedArts: DoctorPublication[] = arts.map((article) => ({
            id: article.id,
            category: (article.category ?? "conseil") as "conseil" | "maladie",
            title: article.title,
            content: article.content,
            created_at: article.created_at,
            is_hidden: article.is_hidden ?? false,
            hidden_reason: article.hidden_reason ?? null,
            images: (Array.isArray(article.images) ? article.images : [])
              .map((image) => ({
                id: image.id,
                image_url: image.image_url,
                sort_order: image.sort_order ?? 0,
              }))
              .sort((a, b) => a.sort_order - b.sort_order),
          }));
          setArticles(normalizedArts);
        }

        const allArts = allArticlesResult?.data;
        const ownPostIds = (arts ?? []).map((article) => article.id);
        const communityPostIds = (allArts ?? []).map((article) => article.id);
        const combinedPostIds = Array.from(new Set([...ownPostIds, ...communityPostIds]));

        if (communityPostIds.length > 0) {
          const { error: viewsUpsertError } = await supabase
            .from("community_post_views")
            .upsert(
              communityPostIds.map((postId) => ({
                post_id: postId,
                viewer_id: user.id,
              })),
              { onConflict: "post_id,viewer_id" }
            );

          if (viewsUpsertError && !isMissingCommunityViewsTable(viewsUpsertError)) {
            console.error("Unable to update community post views", viewsUpsertError);
          }
        }

        const normalizedAllArticles: CommunityArticle[] = (allArts ?? []).map((article) => ({
          id: article.id,
          doctor_id: article.doctor_id,
          category: (article.category ?? "conseil") as "conseil" | "maladie",
          title: article.title,
          content: article.content,
          created_at: article.created_at,
          images: (Array.isArray(article.images) ? article.images : [])
            .map((image) => ({
              id: image.id,
              image_url: image.image_url,
              sort_order: image.sort_order ?? 0,
            }))
            .sort((a, b) => a.sort_order - b.sort_order),
          author: Array.isArray(article.author)
            ? (article.author[0] ?? null)
            : (article.author ?? null),
        }));

        const [likesRows, savesRows, commentsRows, viewsRows] = combinedPostIds.length
          ? await Promise.all([
              supabase
                .from("community_post_likes")
                .select("post_id, user_id")
                .in("post_id", combinedPostIds)
                .then(({ data }) => data ?? []),
              supabase
                .from("community_post_saves")
                .select("post_id, user_id")
                .in("post_id", combinedPostIds)
                .then(({ data }) => data ?? []),
              supabase
                .from("community_post_comments")
                .select("id, post_id, user_id, content, created_at, user:profiles!user_id(full_name, avatar_url)")
                .in("post_id", combinedPostIds)
                .eq("is_hidden", false)
                .order("created_at", { ascending: true })
                .then(({ data }) => data ?? []),
              supabase
                .from("community_post_views")
                .select("post_id")
                .in("post_id", combinedPostIds)
                .then(({ data, error }) => {
                  if (error) {
                    if (!isMissingCommunityViewsTable(error)) {
                      console.error("Unable to fetch community post views", error);
                    }
                    return [];
                  }
                  return data ?? [];
                }),
            ])
          : [[], [], [], []];

        const nextLikesByPost = likesRows.reduce<Record<string, { count: number; likedByMe: boolean }>>(
          (accumulator, like) => {
            if (!accumulator[like.post_id]) {
              accumulator[like.post_id] = { count: 0, likedByMe: false };
            }
            accumulator[like.post_id].count += 1;
            if (like.user_id === user.id) {
              accumulator[like.post_id].likedByMe = true;
            }
            return accumulator;
          },
          {}
        );

        const nextSavesByPost = savesRows.reduce<Record<string, { count: number; savedByMe: boolean }>>(
          (accumulator, save) => {
            if (!accumulator[save.post_id]) {
              accumulator[save.post_id] = { count: 0, savedByMe: false };
            }
            accumulator[save.post_id].count += 1;
            if (save.user_id === user.id) {
              accumulator[save.post_id].savedByMe = true;
            }
            return accumulator;
          },
          {}
        );

        const nextCommentsByPost = commentsRows.reduce<Record<string, CommunityComment[]>>(
          (accumulator, comment) => {
            if (!accumulator[comment.post_id]) {
              accumulator[comment.post_id] = [];
            }

            const commentAuthor = Array.isArray(comment.user) ? comment.user[0] : comment.user;
            accumulator[comment.post_id].push({
              id: comment.id,
              post_id: comment.post_id,
              user_id: comment.user_id,
              content: comment.content,
              created_at: comment.created_at,
              author_name: commentAuthor?.full_name ?? tr("Utilisateur", "User", "مستخدم"),
              author_avatar: commentAuthor?.avatar_url ?? null,
            });
            return accumulator;
          },
          {}
        );

        const nextViewsByPost = viewsRows.reduce<Record<string, number>>((accumulator, view) => {
          accumulator[view.post_id] = (accumulator[view.post_id] ?? 0) + 1;
          return accumulator;
        }, {});

        setAllArticles(normalizedAllArticles);
        setLikesByPost(nextLikesByPost);
        setSavesByPost(nextSavesByPost);
        setCommentsByPost(nextCommentsByPost);
        setViewsByPost(nextViewsByPost);
        setDbError(null);

        void logPerformanceEvent({
          actorId: user.id,
          pageKey: "dashboard_doctor",
          metricName: "initial_data_load",
          metricMs: performance.now() - startedAt,
          context: {
            appointments_count: appts?.length ?? 0,
            posts_count: arts?.length ?? 0,
            community_posts_count: normalizedAllArticles.length,
          },
        });
      } catch (error) {
        console.error("Doctor dashboard initial load failed", error);

        if (!isMounted) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : tr(
                "Le tableau de bord du docteur a rencontré un problème au chargement.",
                "The doctor dashboard ran into a loading problem.",
                "واجهت لوحة تحكم الطبيب مشكلة أثناء التحميل."
              );

        const lowerMessage = message.toLowerCase();
        const looksLikeSchemaIssue =
          lowerMessage.includes("column") ||
          lowerMessage.includes("relation") ||
          lowerMessage.includes("schema cache") ||
          lowerMessage.includes("does not exist") ||
          lowerMessage.includes("community_post_") ||
          lowerMessage.includes("appointment_booking_mode") ||
          lowerMessage.includes("working_hours_");

        if (looksLikeSchemaIssue || !profile) {
          setDbError(message);
        } else {
          showNotice(
            tr(
              "Le tableau de bord a rencontré un problème au chargement. Le contenu disponible a été conservé.",
              "The dashboard hit a loading problem. Available content was preserved.",
              "واجهت لوحة التحكم مشكلة أثناء التحميل. تم الاحتفاظ بالمحتوى المتاح."
            ),
            "error"
          );
        }

        setAppointments([]);
        setArticles([]);
        setAllArticles([]);
        setLikesByPost({});
        setSavesByPost({});
        setCommentsByPost({});
        setViewsByPost({});
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

  useEffect(() => {
    if (activeTab !== "appointments" && activeTab !== "profile") {
      return;
    }

    const timerId = setInterval(() => {
      setRefreshCounter((current) => current + 1);
    }, activeTab === "appointments" ? 15000 : 30000);

    return () => clearInterval(timerId);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "prescriptions" || !profile?.id) {
      return;
    }

    void loadStandalonePrescriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, profile?.id]);

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
    if (!selectedDossier) {
      generalRemarksHydratedRef.current = false;
      lastSavedGeneralRemarksRef.current = "";
      setIsAutoSavingGeneralRemarks(false);
      return;
    }

    generalRemarksHydratedRef.current = true;
    lastSavedGeneralRemarksRef.current = selectedDossierGeneralRemarks;
    setGeneralRemarksEdit(selectedDossierGeneralRemarks);
  }, [selectedDossier, selectedDossierId, selectedDossierGeneralRemarks]);

  useEffect(() => {
    if (!selectedDossierId || !selectedDossier || !editingGeneralRemarks || !generalRemarksHydratedRef.current) {
      return;
    }

    if (generalRemarksEdit === lastSavedGeneralRemarksRef.current) {
      return;
    }

    const autoSaveErrorMessage =
      language === "ar"
        ? "فشل الحفظ التلقائي."
        : language === "en"
          ? "Auto-save failed."
          : "Erreur pendant la sauvegarde auto.";

    setIsAutoSavingGeneralRemarks(true);
    const timerId = window.setTimeout(async () => {
      const { error } = await supabase
        .from("medical_dossiers")
        .update({ general_remarks: generalRemarksEdit })
        .eq("id", selectedDossierId);

      if (error) {
        setIsAutoSavingGeneralRemarks(false);
        showNotice(autoSaveErrorMessage, "error");
        return;
      }

      lastSavedGeneralRemarksRef.current = generalRemarksEdit;
      setSelectedDossier((current) =>
        current ? { ...current, general_remarks: generalRemarksEdit } : current
      );
      setDossiers((current) =>
        current.map((dossier) =>
          dossier.id === selectedDossierId ? { ...dossier, general_remarks: generalRemarksEdit } : dossier
        )
      );
      setIsAutoSavingGeneralRemarks(false);
    }, 700);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [editingGeneralRemarks, generalRemarksEdit, selectedDossier, selectedDossierId, language]);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    const appointmentsChannel = supabase
      .channel(`doctor-appointments-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `doctor_id=eq.${profile.id}`,
        },
        () => {
          queueRealtimeRefresh();
        }
      )
      .subscribe();

    const profileChannel = supabase
      .channel(`doctor-profile-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile.id}`,
        },
        () => {
          queueRealtimeRefresh();
        }
      )
      .subscribe();

    const communityChannel = supabase
      .channel(`doctor-community-${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, queueRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_comments" }, queueRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_likes" }, queueRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_saves" }, queueRealtimeRefresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(appointmentsChannel);
      void supabase.removeChannel(profileChannel);
      void supabase.removeChannel(communityChannel);
    };
  }, [profile?.id]);

 
  const closeCommunityDoctorDetails = () => {
    setSelectedCommunityDoctorDetails(null);
  };

  const openCommunityDoctorDetails = async (doctorId: string) => {
    if (!doctorId) {
      return;
    }

    if (profile?.id === doctorId && profile) {
      setSelectedCommunityDoctorDetails(toRecommendedDoctorProfile(clearExpiredVacationFlag(profile)));
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(COMMUNITY_DOCTOR_PROFILE_SELECT)
      .eq("id", doctorId)
      .eq("account_type", "doctor")
      .maybeSingle();

    if (error || !data) {
      showNotice(
        tr(
          "Impossible d'ouvrir la fiche du docteur pour le moment.",
          "Unable to open the doctor's profile right now.",
          "تعذر فتح بطاقة الطبيب حالياً."
        ),
        "error"
      );
      return;
    }

    const normalizedDoctor = normalizeDoctorProfile(clearExpiredVacationFlag(data as Partial<DoctorProfile>));
    if (!normalizedDoctor) {
      showNotice(
        tr(
          "Impossible d'ouvrir la fiche du docteur pour le moment.",
          "Unable to open the doctor's profile right now.",
          "تعذر فتح بطاقة الطبيب حالياً."
        ),
        "error"
      );
      return;
    }

    setSelectedCommunityDoctorDetails(toRecommendedDoctorProfile(normalizedDoctor));
  };

  const toggleLikePost = async (postId: string) => {
    if (!profile) return;
    const current = likesByPost[postId];
    const isCurrentlyLiked = current?.likedByMe;
    const previousState = { ...likesByPost };
    setLikesByPost(prev => ({
      ...prev,
      [postId]: {
        count: isCurrentlyLiked ? (current.count - 1) : ((current?.count || 0) + 1),
        likedByMe: !isCurrentlyLiked
      }
    }));
    try {
      if (isCurrentlyLiked) {
        await supabase.from("community_post_likes").delete().eq("post_id", postId).eq("user_id", profile.id);
      } else {
        await supabase.from("community_post_likes").insert({ post_id: postId, user_id: profile.id });
      }
    } catch {
      setLikesByPost(previousState);
    }
  };

  const toggleSavePost = async (postId: string) => {
    if (!profile) return;
    const current = savesByPost[postId];
    const isCurrentlySaved = current?.savedByMe;
    const previousState = { ...savesByPost };
    setSavesByPost(prev => ({
      ...prev,
      [postId]: {
        count: isCurrentlySaved ? (current.count - 1) : ((current?.count || 0) + 1),
        savedByMe: !isCurrentlySaved
      }
    }));
    try {
      if (isCurrentlySaved) {
        await supabase.from("community_post_saves").delete().eq("post_id", postId).eq("user_id", profile.id);
      } else {
        await supabase.from("community_post_saves").insert({ post_id: postId, user_id: profile.id });
      }
    } catch {
      setSavesByPost(previousState);
    }
  };

  const submitComment = async (postId: string) => {
    const draft = commentDraftsByPostId[postId]?.trim();
    if (!draft || !profile) return;
    setCommentSubmittingPostId(postId);
    try {
      const { data, error } = await supabase.from("community_post_comments").insert({
        post_id: postId,
        user_id: profile.id,
        content: draft,
      }).select("id, created_at").single();
      if (error) throw error;
      const newComment: CommunityComment = {
        id: data.id,
        post_id: postId,
        user_id: profile.id,
        content: draft,
        created_at: data.created_at,
        author_name: profile.full_name,
        author_avatar: profile.avatar_url,
      };
      setCommentsByPost(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment]
      }));
      setCommentDraftsByPostId(prev => ({ ...prev, [postId]: "" }));
    } catch {
      alert("Erreur lors de l'ajout du commentaire.");
    } finally {
      setCommentSubmittingPostId(null);
    }
  };

  const startReplyToComment = (postId: string, authorName: string | null) => {
    const mention = authorName?.trim() ? `@${authorName.trim()} ` : "";
    setCommentDraftsByPostId((previous) => ({
      ...previous,
      [postId]: mention,
    }));

    window.requestAnimationFrame(() => {
      commentInputRefs.current[postId]?.focus();
    });
  };

  const handleDeletePublication = async (postId: string) => {
    if (!profile) {
      return;
    }

    const confirmed = window.confirm("Voulez-vous vraiment supprimer cette publication ?");
    if (!confirmed) {
      return;
    }

    setDeletingPublicationId(postId);
    try {
      const { error } = await supabase
        .from("community_posts")
        .delete()
        .eq("id", postId)
        .eq("doctor_id", profile.id);

      if (error) {
        throw error;
      }

      setArticles((previous) => previous.filter((article) => article.id !== postId));
      setAllArticles((previous) => previous.filter((article) => article.id !== postId));
      setCommentsByPost((previous) => {
        const next = { ...previous };
        delete next[postId];
        return next;
      });
      setLikesByPost((previous) => {
        const next = { ...previous };
        delete next[postId];
        return next;
      });
      setSavesByPost((previous) => {
        const next = { ...previous };
        delete next[postId];
        return next;
      });
      setViewsByPost((previous) => {
        const next = { ...previous };
        delete next[postId];
        return next;
      });
      setCommentDraftsByPostId((previous) => {
        const next = { ...previous };
        delete next[postId];
        return next;
      });
      delete commentInputRefs.current[postId];

      await logAuditEvent({
        actorId: profile.id,
        action: "doctor_deleted_community_post",
        entityType: "community_post",
        entityId: postId,
      });

      showNotice("Publication supprimée avec succès.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Suppression impossible pour le moment.";
      showNotice(message, "error");
    } finally {
      setDeletingPublicationId(null);
    }
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget || !profile) return;
    setIsSubmittingReport(true);
    try {
      const payload: { reporter_id: string; reason: string; status: string; post_id?: string; comment_id?: string } = {
        reporter_id: profile.id,
        reason: reportReason,
        status: "pending"
      };
      if (reportTarget.type === "post") {
        payload.post_id = reportTarget.id;
      } else {
        payload.comment_id = reportTarget.id;
      }
      const { error } = await supabase.from("community_reports").insert(payload);
      if (error) throw error;
      setReportTarget(null);
      setReportReason("Contenu inapproprié");
      alert("Signalement envoyé avec succès.");
    } catch {
       // Ignore if not exist
       setReportTarget(null);
       alert("Signalement envoyé !");
    } finally {
      setIsSubmittingReport(false);
    }
  };

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

  const updateAppointmentStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) alert("Erreur: " + error.message);
    else {
      if (profile?.id) {
        await logAuditEvent({
          actorId: profile.id,
          action: "appointment_status_updated",
          entityType: "appointment",
          entityId: id,
          metadata: { status },
        });
      }
      setAppointments((currentAppointments) =>
        currentAppointments.map((appointment) =>
          appointment.id === id ? { ...appointment, status } : appointment
        )
      );
    }
  };

  const handleManualRefresh = () => {
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

  const getBookingModeLabel = (mode: BookingSelectionMode | null | undefined) => {
    switch (mode) {
      case "doctor_datetime":
        return t("dashboard.doctor.appt.mode.doctorDatetime");
      case "patient_date_only":
        return t("dashboard.doctor.appt.mode.patientDateOnly");
      default:
        return t("dashboard.doctor.appt.mode.patientDatetime");
    }
  };

  const getAppointmentDisplayLabel = (appointment: DoctorAppointment) => {
    const mode = appointment.booking_selection_mode ?? "patient_datetime";
    if (appointment.follow_up_time_pending) {
      const requestedDateLabel = new Date(`${getAppointmentCalendarDate(appointment)}T00:00:00`).toLocaleDateString(locale, { dateStyle: 'medium' });
      return `${requestedDateLabel} · ${tr("heure à définir", "time to confirm", "الساعة ستحدد لاحقاً")}`;
    }

    if (appointment.status !== "pending") {
      return new Date(appointment.appointment_date).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
    }

    if (mode === "doctor_datetime") {
      return t("dashboard.doctor.appt.awaitingProposal");
    }

    if (mode === "patient_date_only") {
      const requestedDateLabel = appointment.requested_date
        ? new Date(`${appointment.requested_date}T00:00:00`).toLocaleDateString(locale, { dateStyle: 'medium' })
        : t("dashboard.doctor.appt.dateNotSet");
      return `${requestedDateLabel} · ${t("dashboard.doctor.appt.timeToDefine")}`;
    }

    return new Date(appointment.appointment_date).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const openScheduleModal = (appointment: DoctorAppointment) => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const fallbackDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    const appointmentDate = new Date(appointment.appointment_date);
    const formattedAppointmentDate = Number.isNaN(appointmentDate.getTime())
      ? fallbackDate
      : getLocalIsoDate(appointmentDate);
    const fallbackTimeFromAppointment = Number.isNaN(appointmentDate.getTime())
      ? workingHoursStart || "08:00"
      : `${String(appointmentDate.getHours()).padStart(2, "0")}:${String(appointmentDate.getMinutes()).padStart(2, "0")}`;
    const initialDate = appointment.requested_date ?? formattedAppointmentDate ?? fallbackDate;
    const initialTime = appointment.requested_time
      ? normalizeTimeValue(appointment.requested_time, workingHoursStart || "08:00")
      : appointment.follow_up_time_pending
        ? (workingHoursStart || "08:00")
        : normalizeTimeValue(fallbackTimeFromAppointment, workingHoursStart || "08:00");

    setAppointmentToSchedule(appointment);
    setScheduledDate(initialDate);
    setScheduledTime(initialTime);
  };

  const closeScheduleModal = () => {
    setAppointmentToSchedule(null);
    setScheduledDate("");
    setScheduledTime(workingHoursStart || "08:00");
  };

  const scheduleAndConfirmAppointment = async () => {
    if (!profile || !appointmentToSchedule || !scheduledDate || !scheduledTime) {
      alert("Veuillez choisir une date et une heure.");
      return;
    }

    const normalizedScheduledTime = normalizeTimeValue(scheduledTime, workingHoursStart || "08:00");
    const dateTimeValue = buildLocalDateTime(scheduledDate, normalizedScheduledTime);
    if (isNaN(dateTimeValue.getTime())) {
      alert("Date/heure invalide.");
      return;
    }

    const [workStartHour, workStartMinute] = (workingHoursStart || "08:00").split(":").map(Number);
    const [workEndHour, workEndMinute] = (workingHoursEnd || "17:00").split(":").map(Number);
    const selectedMinutes = dateTimeValue.getHours() * 60 + dateTimeValue.getMinutes();
    const openMinutes = workStartHour * 60 + workStartMinute;
    const closeMinutes = workEndHour * 60 + workEndMinute;
    const appointmentDuration = durationParams || 30;

    if (selectedMinutes < openMinutes || selectedMinutes + appointmentDuration > closeMinutes) {
      alert(`Horaire hors plage d'ouverture (${(workingHoursStart || "08:00").slice(0, 5)} - ${(workingHoursEnd || "17:00").slice(0, 5)}).`);
      return;
    }

    const startOfDay = new Date(dateTimeValue);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateTimeValue);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: dayAppointments, error: dayAppointmentsError } = await supabase
      .from("appointments")
      .select("id, appointment_date, status, follow_up_time_pending")
      .eq("doctor_id", profile.id)
      .gte("appointment_date", startOfDay.toISOString())
      .lte("appointment_date", endOfDay.toISOString())
      .neq("status", "cancelled");

    if (dayAppointmentsError) {
      alert("Erreur: " + dayAppointmentsError.message);
      return;
    }

    const overlapping = (dayAppointments ?? []).some((appointment) => {
      if (appointment.id === appointmentToSchedule.id) {
        return false;
      }
      if (appointment.follow_up_time_pending) {
        return false;
      }
      const existing = new Date(appointment.appointment_date).getTime();
      const requested = dateTimeValue.getTime();
      const diffMinutes = Math.abs(existing - requested) / (1000 * 60);
      return diffMinutes < appointmentDuration;
    });

    if (overlapping) {
      alert("Ce créneau est trop proche d'un autre rendez-vous.");
      return;
    }

    setIsSchedulingAppointment(true);
    const { error } = await supabase
      .from("appointments")
      .update({
        appointment_date: dateTimeValue.toISOString(),
        status: "confirmed",
        requested_date: scheduledDate,
        requested_time: `${normalizedScheduledTime}:00`,
        follow_up_time_pending: false,
      })
      .eq("id", appointmentToSchedule.id);
    setIsSchedulingAppointment(false);

    if (error) {
      alert("Erreur: " + error.message);
      return;
    }

    const updatedAppointment: DoctorAppointment = {
      ...appointmentToSchedule,
      appointment_date: dateTimeValue.toISOString(),
      status: "confirmed",
      requested_date: scheduledDate,
      requested_time: `${normalizedScheduledTime}:00`,
      follow_up_time_pending: false,
    };

    setAppointments((current) =>
      sortItemsByDate(
        current.map((appointment) =>
          appointment.id === appointmentToSchedule.id ? updatedAppointment : appointment
        ),
        (appointment) => appointment.created_at,
        "desc"
      )
    );
    setDossierAppointmentHistory((current) =>
      sortItemsByDate(
        current.map((appointment) =>
          appointment.id === appointmentToSchedule.id ? updatedAppointment : appointment
        ),
        (appointment) => appointment.created_at,
        "desc"
      )
    );
    if (appointmentToSchedule.follow_up_visit_id) {
      setFollowUpAppointmentsByVisitId((current) => ({
        ...current,
        [appointmentToSchedule.follow_up_visit_id as string]: updatedAppointment,
      }));
    }
    await logAuditEvent({
      actorId: profile.id,
      action: "appointment_scheduled_by_doctor",
      entityType: "appointment",
      entityId: appointmentToSchedule.id,
      metadata: {
        scheduled_date: scheduledDate,
        scheduled_time: normalizedScheduledTime,
        appointment_source: appointmentToSchedule.appointment_source,
        follow_up_visit_id: appointmentToSchedule.follow_up_visit_id,
      },
    });
    closeScheduleModal();
  };

  const handleAvatarUpload = async (file: File) => {
    if (!profile) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Veuillez choisir un fichier image (JPG, PNG, WebP...).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("La taille maximale autorisée est de 5 MB.");
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
        throw new Error("Impossible de récupérer l'URL publique de l'image.");
      }

      setAvatarUrl(publicUrlData.publicUrl);
      showNotice("Photo téléversée avec succès.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Échec du téléversement de la photo.";
      alert("Erreur: " + message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handlePublicationImagesChange = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const incomingFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (incomingFiles.length === 0) {
      alert("Veuillez sélectionner uniquement des images.");
      return;
    }

    setPendingPublicationImages((current) => {
      const remainingSlots = 10 - current.length;
      if (remainingSlots <= 0) {
        alert("Vous avez déjà sélectionné 10 images (maximum).");
        return current;
      }

      const filesToAdd = incomingFiles.slice(0, remainingSlots).map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      if (incomingFiles.length > remainingSlots) {
        alert("Maximum 10 images par publication.");
      }

      return [...current, ...filesToAdd];
    });
  };

  const removePendingPublicationImage = (indexToRemove: number) => {
    setPendingPublicationImages((current) => {
      const target = current[indexToRemove];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((_, index) => index !== indexToRemove);
    });
  };

  const uploadPublicationImages = async (postId: string) => {
    if (!profile || pendingPublicationImages.length === 0) {
      return [] as PublicationImage[];
    }

    const uploadResults = await Promise.all(
      pendingPublicationImages.map(async (pendingImage, index) => {
        const safeFilename = pendingImage.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${profile.id}/${postId}/${Date.now()}-${index}-${safeFilename}`;

        let uploadError: Error | null = null;
        try {
          const uploadResult = await supabase.storage
            .from("community-posts")
            .upload(filePath, pendingImage.file, {
              upsert: true,
              cacheControl: "3600",
            });
          uploadError = uploadResult.error;
        } catch (error) {
          const message =
            error instanceof Error && error.message
              ? error.message
              : "Échec réseau lors de l'envoi des images.";
          throw new Error(message);
        }

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from("community-posts")
          .getPublicUrl(filePath);

        if (!publicUrlData?.publicUrl) {
          throw new Error("Impossible de récupérer une URL image publique.");
        }

        return {
          post_id: postId,
          image_url: publicUrlData.publicUrl,
          sort_order: index,
        };
      })
    );

    const { data, error } = await supabase
      .from("community_post_images")
      .insert(uploadResults)
      .select("id, image_url, sort_order");

    if (error) {
      throw error;
    }

    return (data ?? []).map((image) => ({
      id: image.id,
      image_url: image.image_url,
      sort_order: image.sort_order ?? 0,
    }));
  };

  const handlePublishArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      return;
    }

    if (!newArticle.title.trim() || !newArticle.content.trim()) {
      return;
    }

    try {
      const { data, error } = await supabase.from("community_posts").insert({
        doctor_id: profile.id,
        category: newArticle.category,
        title: newArticle.title.trim(),
        content: newArticle.content.trim()
      }).select().single();

      if (error || !data) {
        throw error ?? new Error("Impossible de créer la publication.");
      }

      let uploadedImages: PublicationImage[] = [];

      try {
        uploadedImages = await uploadPublicationImages(data.id);
      } catch (uploadError) {
        const uploadMessage = uploadError instanceof Error ? uploadError.message : "Impossible d'ajouter les images.";
        showNotice(`Publication créée, mais les images n'ont pas pu être ajoutées: ${uploadMessage}`, "error");
      }

      const createdPost: DoctorPublication = {
        id: data.id,
        category: (data.category ?? "conseil") as "conseil" | "maladie",
        title: data.title,
        content: data.content,
        created_at: data.created_at,
        is_hidden: false,
        hidden_reason: null,
        images: uploadedImages,
      };

      setArticles((current) => [createdPost, ...current]);
      setViewsByPost((current) => ({ ...current, [createdPost.id]: current[createdPost.id] ?? 0 }));
      setNewArticle({ title: '', content: '', category: "conseil" });
      clearPendingPublicationImages();
      await logAuditEvent({
        actorId: profile.id,
        action: "community_post_created",
        entityType: "community_post",
        entityId: data.id,
        metadata: {
          category: data.category,
          images_count: uploadedImages.length,
        },
      });
      showNotice("Article publié avec succès !", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de publier l'article.";
      showNotice(`Erreur publication: ${message}`, "error");
    }
  };

  const persistDoctorSettings = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!profile) {
      setIsAutoSavingSettings(false);
      return false;
    }

    const normalizedDuration = Number(durationParams);
    if (!Number.isFinite(normalizedDuration) || normalizedDuration < 5) {
      setIsAutoSavingSettings(false);
      if (!silent) {
        showNotice("Veuillez définir une durée de rendez-vous valide d'au moins 5 minutes.", "error");
      }
      return false;
    }

    let normalizedMaxAppointments: number | null = null;
    if (!isUnlimited) {
      const parsedMaxAppointments = Number(maxAppointments);
      if (!Number.isFinite(parsedMaxAppointments) || parsedMaxAppointments <= 0) {
        setIsAutoSavingSettings(false);
        if (!silent) {
          showNotice("Veuillez saisir une limite journalière valide supérieure à 0.", "error");
        }
        return false;
      }
      normalizedMaxAppointments = parsedMaxAppointments;
    }

    if (vacationStart && vacationEnd && vacationEnd < vacationStart) {
      setIsAutoSavingSettings(false);
      if (!silent) {
        showNotice("La date de fin des congés doit être postérieure ou égale à la date de début.", "error");
      }
      return false;
    }

    const normalizedWorkingStart = normalizeTimeValue(workingHoursStart, "08:00");
    const normalizedWorkingEnd = normalizeTimeValue(workingHoursEnd, "17:00");
    const sanitizedContactSettings = sanitizeDoctorContactSettings(contactSettings);
    const payload = {
      full_name: fullName.trim() || null,
      address: address.trim() || null,
      latitude,
      longitude,
      specialty: specialty.trim() || null,
      bio: bio.trim() || null,
      gender: gender || null,
      avatar_url: avatarUrl.trim() || null,
      google_maps_link: googleMapsLink.trim() || null,
      ...sanitizedContactSettings,
      is_accepting_appointments: isAccepting,
      appointment_duration_minutes: normalizedDuration,
      max_appointments_per_day: normalizedMaxAppointments,
      vacation_start: vacationStart || null,
      vacation_end: vacationEnd || null,
      is_on_vacation: isOnVacation,
      working_hours_start: normalizedWorkingStart,
      working_hours_end: normalizedWorkingEnd,
      appointment_booking_mode: bookingMode,
    };

    setIsUpdatingParams(true);
    const { error } = await supabase.from('profiles').update(payload).eq("id", profile.id);
    setIsUpdatingParams(false);
    setIsAutoSavingSettings(false);

    if (error) {
      showNotice("Erreur: " + error.message, "error");
      return false;
    }

    setWorkingHoursStart(normalizedWorkingStart);
    setWorkingHoursEnd(normalizedWorkingEnd);
    lastSavedSettingsSnapshotRef.current = computeSettingsSnapshot();

    if (!silent) {
      await logAuditEvent({
        actorId: profile.id,
        action: "profile_updated",
        entityType: "profile",
        entityId: profile.id,
        metadata: { context: "doctor_settings" },
      });
      showNotice("Vos modifications ont été enregistrées avec succès !", "success");
    }

    setProfile((currentProfile) => {
      if (!currentProfile) {
        return currentProfile;
      }

      return {
        ...currentProfile,
        ...payload,
      };
    });

    return true;
  };

  const handleSaveSettings = async () => {
    await persistDoctorSettings();
  };

  useEffect(() => {
    if (!profile || !settingsHydratedRef.current || activeTab !== "profile") {
      return;
    }

    const nextSnapshot = computeSettingsSnapshot();
    if (nextSnapshot === lastSavedSettingsSnapshotRef.current) {
      return;
    }

    setIsAutoSavingSettings(true);
    const timerId = window.setTimeout(() => {
      void persistDoctorSettings({ silent: true });
    }, 800);

    return () => {
      window.clearTimeout(timerId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profile,
    activeTab,
    fullName,
    address,
    latitude,
    longitude,
    specialty,
    bio,
    gender,
    avatarUrl,
    googleMapsLink,
    contactSettings,
    isAccepting,
    durationParams,
    maxAppointments,
    isUnlimited,
    vacationStart,
    vacationEnd,
    isOnVacation,
    workingHoursStart,
    workingHoursEnd,
    bookingMode,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
        <div className="bg-red-50 dark:bg-red-900/20 max-w-lg w-full p-8 rounded-3xl border border-red-200 dark:border-red-800 text-center">
          <XCircle className="size-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Base de données non configurée</h2>
          <p className="text-red-600 dark:text-red-300 font-medium whitespace-pre-wrap">{dbError}</p>
          <div className="mt-6 p-4 bg-white dark:bg-slate-900 rounded-xl text-left border border-red-100 dark:border-red-900 shadow-sm text-sm">
             <p className="text-slate-800 dark:text-slate-200 font-bold mb-2">Solution requise :</p>
             <p className="text-slate-600 dark:text-slate-400">{getDbFixHint(dbError)}</p>
             <p className="text-slate-600 dark:text-slate-400 mt-2">
               Ordre recommandé: <code className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">database_setup.sql</code> → <code className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">02_database_extensions.sql</code> → <code className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">03_advanced_doctor_settings.sql</code> → <code className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">04_working_hours.sql</code> → <code className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">05_community_publications.sql</code> → <code className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">06_appointment_booking_modes.sql</code> → <code className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">07_moderation_observability.sql</code>.
             </p>
          </div>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition">
             Rafraîchir la page
          </button>
        </div>
      </div>
    );
  }

  const followUpReminderAppointments = sortAppointmentsChronologically(
    appointments.filter((appointment) => {
      if (
        appointment.appointment_source !== "doctor_follow_up" ||
        !appointment.follow_up_time_pending ||
        appointment.status === "cancelled"
      ) {
        return false;
      }

      const daysUntil = getDaysUntilCalendarDate(getAppointmentCalendarDate(appointment));
      const reminderWindow = appointment.follow_up_reminder_days ?? 4;
      return daysUntil >= 0 && daysUntil <= reminderWindow;
    })
  );

  return (
    <div dir={language === "ar" ? "rtl" : "ltr"} className={`h-screen overflow-hidden bg-[#F8FAFC] dark:bg-slate-950 ${isEmbedded ? "block" : "flex flex-col"} font-sans transition-colors duration-200`}>
      {!isEmbedded ? (
        <>
          {/* Mobile Overlay for Nav (Keeping this) */}
          {isMobileNavOpen ? (
            <button
              type="button"
              aria-label={t("dashboard.doctor.closeNav")}
              onClick={() => setIsMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm"
            />
          ) : null}
        </>
      ) : null}
      
      {/* Fixed Desktop Top Bar removed (merged into tabs) */}

      {/* Sidebar Content */}
      {!isEmbedded ? (
      <aside className={`fixed inset-y-0 start-0 z-50 flex w-[min(86vw,340px)] max-w-sm flex-col border-e border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-950 ${isMobileNavOpen ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full"} ${isDesktopNavVisible ? "translate-x-0 rtl:md:translate-x-0 ltr:md:translate-x-0" : "rtl:md:translate-x-full ltr:md:-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800 md:p-6 md:pb-8">
          <Link href="/"><Logo className="scale-110 origin-left" /></Link>
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
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-900 text-slate-100 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.9)] transition hover:scale-[1.02] hover:bg-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              aria-label={t("dashboard.doctor.hideNav")}
              title={t("dashboard.doctor.hideNav")}
            >
              <Menu size={18} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 shadow-sm transition hover:bg-slate-100 md:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label={t("dashboard.doctor.closeNav")}
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
          <button onClick={() => { setActiveTab("overview"); setIsMobileNavOpen(false); }} className={navButtonClasses(activeTab === "overview")}>
            <span className={navIconClasses(activeTab === "overview")}><Activity size={18} /></span>
            <span>{t("dashboard.doctor.overview")}</span>
          </button>
          <button onClick={() => { setActiveTab("appointments"); setIsMobileNavOpen(false); }} className={navButtonClasses(activeTab === "appointments")}>
            <span className={navIconClasses(activeTab === "appointments")}><CalendarIcon size={18} /></span>
            <span>{t("dashboard.doctor.appointments")}</span>
          </button>
          <button onClick={() => { setActiveTab("patients"); setIsMobileNavOpen(false); }} className={navButtonClasses(activeTab === "patients")}>
            <span className={navIconClasses(activeTab === "patients")}><Users size={18} /></span>
            <span>{t("dashboard.doctor.patients")}</span>
          </button>
          <button onClick={() => { setActiveTab("prescriptions"); setIsMobileNavOpen(false); }} className={navButtonClasses(activeTab === "prescriptions")}>
            <span className={navIconClasses(activeTab === "prescriptions")}><ClipboardList size={18} /></span>
            <span>{tr("Ordonnances", "Prescriptions", "الوصفات")}</span>
          </button>
          <button onClick={() => { setActiveTab("community"); setIsMobileNavOpen(false); }} className={navButtonClasses(activeTab === "community")}>
            <span className={navIconClasses(activeTab === "community")}><FileText size={18} /></span>
            <span>{t("dashboard.doctor.community")}</span>
          </button>
          <button onClick={() => { setActiveTab("publications"); setIsMobileNavOpen(false); }} className={navButtonClasses(activeTab === "publications")}>
            <span className={navIconClasses(activeTab === "publications")}><Upload size={18} /></span>
            <span>{t("dashboard.doctor.publications")}</span>
          </button>
          <button onClick={() => { setActiveTab("ai-assistant"); setIsMobileNavOpen(false); }} className={navButtonClasses(activeTab === "ai-assistant")}>
            <span className={navIconClasses(activeTab === "ai-assistant")}>
              <img src="/images/mofid.jpg" alt="MOFID" className="h-[18px] w-[18px] rounded-md object-cover" />
            </span>
            <span>MOFID (AI assistant)</span>
          </button>
          <button onClick={() => { setActiveTab("profile"); setIsMobileNavOpen(false); }} className={navButtonClasses(activeTab === "profile")}>
            <span className={navIconClasses(activeTab === "profile")}><Settings size={18} /></span>
            <span>{t("dashboard.doctor.profile")}</span>
          </button>
        </div>
        <div className="mt-auto flex flex-col border-t border-slate-100 p-4 dark:border-slate-800 md:p-6">
          <div className="mb-4 flex items-center gap-3 md:mb-6">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || t("dashboard.doctor.accountType")}
                className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold uppercase border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                {profile?.full_name?.substring(0,2) || "DR"}
              </div>
            )}
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
                  Dr. {profile?.full_name || profile?.email?.split("@")[0] || "Doctor"}
                </p>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 uppercase tracking-wider shrink-0">
                  {profile?.account_type === "patient" ? t("dashboard.doctor.accountTypePatient") : t("dashboard.doctor.accountType")}
                </span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate">
                {profile?.specialty || t("dashboard.doctor.specialtyEmpty")}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-500 truncate">{profile?.email}</p>
            </div>
          </div>
          <div className="mb-4 md:hidden">
            <ThemeToggle variant="inline" className="justify-between" />
          </div>
          <button onClick={handleSignOut} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:hover:bg-red-950/20 md:justify-start md:px-0 md:py-0 md:border-0">
            <LogOut size={16} /> <span>{t("dashboard.doctor.signOut")}</span>
          </button>
          {profile?.is_platform_admin ? (
            <Link
              href="/admin/community"
              className="mt-3 inline-flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t("dashboard.doctor.openModeration")}
            </Link>
          ) : null}
        </div>
      </aside>
      ) : null}

      {/* Main Content Area */}
      {/* Content wrapper: holds AI overlay + regular tabs */}
      <div className={`relative flex min-w-0 flex-1 flex-col overflow-hidden transition-[margin,padding] duration-300 ${activeTab === "ai-assistant" ? (isDesktopNavVisible ? "md:ms-[340px] pt-0 md:pt-0" : "ms-0 md:ms-0 pt-0 md:pt-0") : (isDesktopNavVisible ? "md:ms-[340px] pt-0 md:pt-0" : "ms-0 md:ms-0 pt-0 md:pt-0")}`}>
        
        {/* Unified Global Header for all non-AI tabs */}
        {activeTab !== "ai-assistant" && !isEmbedded && (
          <div className="flex-none flex items-center justify-between px-4 md:px-8 py-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3">
              {/* Menu button (Mobile) */}
              <button 
                onClick={() => setIsMobileNavOpen(true)} 
                className="md:hidden text-slate-600 dark:text-blue-400 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <Menu size={20}/>
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
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-900 text-slate-100 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.9)] transition hover:scale-[1.02] hover:bg-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    aria-label={t("dashboard.doctor.showNav")}
                    title={t("dashboard.doctor.showNav")}
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

      <main className={`flex-1 ${activeTab === "ai-assistant" ? "hidden" : isEmbedded ? "overflow-y-auto p-4 sm:p-5 md:p-6" : "overflow-y-auto p-4 sm:p-5 md:p-6 lg:p-8"} dark:text-slate-100 transition-colors duration-200`}>
        <VisitPrescriptionModal
          isOpen={isStandalonePrescriptionModalOpen}
          isSaving={isStandalonePrescriptionSaving}
          draftResetKey={standalonePrescriptionDraftResetKey}
          prescription={standalonePrescriptionModalRecord}
          publicUrl={standalonePrescriptionModalRecord ? getPublicPrescriptionUrl(standalonePrescriptionModalRecord.public_token) : null}
          buildPublicUrl={getPublicPrescriptionUrl}
          defaultPatientName={selectedStandaloneLinkedDossier ? `${selectedStandaloneLinkedDossier.first_name} ${selectedStandaloneLinkedDossier.last_name}`.trim() : ""}
          defaultPatientRegistrationNumber={selectedStandaloneLinkedDossier?.patient_registration_number ?? standalonePrescriptionModalRecord?.patient_registration_number ?? ""}
          defaultDoctorName={profile?.full_name ?? fullName ?? ""}
          defaultDoctorSpecialty={profile?.specialty ?? specialty ?? ""}
          defaultDoctorAddress={profile?.address ?? address ?? ""}
          defaultDoctorPhone={profile?.contact_phone ?? ""}
          defaultDate={standalonePrescriptionModalRecord?.prescription_date ?? new Date().toISOString().split("T")[0]}
          onClose={closeStandalonePrescriptionComposer}
          onSave={saveStandalonePrescription}
          onNotify={(message, type = "info") => showNotice(message, type)}
        />
        <AnimatePresence mode="wait">
          
          {/* TAB: OVERVIEW */}
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="relative mb-12 overflow-hidden rounded-[2.5rem] border border-blue-200/50 bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-white shadow-2xl shadow-blue-500/30 md:p-12 dark:border-blue-500/20 dark:shadow-none">
                <div className="absolute ltr:-right-20 rtl:-left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-20 ltr:-left-20 rtl:-right-20 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
                
                <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="max-w-2xl">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                      <Activity size={14} />
                      {t("dashboard.doctor.overview")}
                    </div>
                    <h1 className="mb-4 text-4xl font-black tracking-tight md:text-5xl">
                      {language === "ar" 
                        ? `مرحباً، ${(profile?.gender === "Femme" || profile?.gender === "female" || profile?.gender === "أنثى") ? "دكتورة" : "دكتور"} \u202A${profile?.full_name?.split(" ")[0] || "Doctor"}\u202C 👋`
                        : t("dashboard.doctor.greeting", { name: profile?.full_name?.split(" ")[0] || "Doctor" })}
                    </h1>
                    <p className="text-lg font-medium text-blue-50/90 md:text-xl">
                      {t("dashboard.doctor.welcome")}
                    </p>
                  </div>
                  
                  <div className="hidden lg:block">
                    <div className="flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-white/10 backdrop-blur-xl border border-white/20 shadow-inner">
                      <Activity size={64} className="text-white/40" />
                    </div>
                  </div>
                </div>
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
                        ? "border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-950/20"
                        : "border-rose-200 bg-rose-50/80 dark:border-rose-500/25 dark:bg-rose-950/20"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                          isWarning
                            ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"
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
                                "Compte médecin restreint",
                                "Doctor account restricted",
                                "حساب الطبيب مقيّد",
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
                                  "L'administration a laissé un avertissement sur votre compte. Merci de corriger le problème signalé.",
                                  "The administration left a warning on your account. Please correct the reported issue.",
                                  "وضعت الإدارة تحذيراً على حسابك. يرجى تصحيح المشكلة المبلغ عنها.",
                                )
                              : tr(
                                  "Votre compte a été limité par l'administration TERIAQ. Certaines fonctionnalités peuvent rester suspendues jusqu'à nouvelle décision.",
                                  "Your account has been limited by TERIAQ administration. Some features may remain suspended until the next decision.",
                                  "تم تقييد حسابك من طرف إدارة ترياق. قد تبقى بعض الميزات معلقة حتى قرار جديد.",
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

              {(() => {
                const verificationStatus =
                  profile?.doctor_verification_status === "approved" ||
                  profile?.doctor_verification_status === "rejected"
                    ? profile.doctor_verification_status
                    : "pending";
                const isVerified =
                  verificationStatus === "approved" &&
                  Boolean(profile?.is_doctor_verified);
                const isModerationBlocked =
                  accountEligibility?.emailBlocked ||
                  accountEligibility?.moderationStatus === "temporarily_blocked" ||
                  accountEligibility?.moderationStatus === "permanently_blocked" ||
                  profile?.moderation_status === "temporarily_blocked" ||
                  profile?.moderation_status === "permanently_blocked";

                if (isVerified) {
                  return null;
                }

                const title =
                  verificationStatus === "rejected"
                    ? tr(
                        "Votre dossier de validation doit être corrigé",
                        "Your verification file must be corrected",
                        "يجب تصحيح ملف التحقق الخاص بك",
                      )
                    : profile?.doctor_verification_requested_at
                      ? tr(
                          "Votre validation médecin est en cours",
                          "Your doctor verification is in progress",
                          "التحقق الطبي الخاص بك قيد المعالجة",
                        )
                      : tr(
                          "Votre profil médecin n'est pas encore validé",
                          "Your doctor profile is not verified yet",
                          "ملف الطبيب الخاص بك غير مُعتمد بعد",
                        );

                const description =
                  profile?.doctor_verification_note?.trim() ||
                  (verificationStatus === "rejected"
                    ? tr(
                        "Ouvrez la page de vérification, remplacez les pièces demandées et renvoyez le dossier à l'administration.",
                        "Open the verification page, replace the requested documents, and submit the file again to the administration.",
                        "افتح صفحة التحقق واستبدل الوثائق المطلوبة ثم أعد إرسال الملف إلى الإدارة.",
                      )
                    : profile?.doctor_verification_requested_at
                      ? tr(
                          "Votre notification reste visible ici jusqu'à la décision finale. Vous pouvez aussi rouvrir votre dossier pour vérifier les fichiers envoyés.",
                          "This notice stays pinned here until the final decision. You can also reopen your file to review the uploaded documents.",
                          "يبقى هذا التنبيه مثبتاً هنا حتى القرار النهائي. يمكنك أيضاً فتح ملفك لمراجعة الوثائق المرسلة.",
                        )
                      : tr(
                          "Depuis cette notification, ouvrez la page de vérification et téléversez les papiers de la clinique ainsi que le certificat médical en PDF ou en image.",
                          "From this notice, open the verification page and upload your clinic papers and medical certificate in PDF or image format.",
                          "من هذا التنبيه افتح صفحة التحقق وارفع أوراق العيادة والشهادة الطبية بصيغة PDF أو صورة.",
                        ));

                return (
                  <div className="mb-8 rounded-[2rem] border border-cyan-200 bg-cyan-50/80 p-6 dark:border-cyan-500/20 dark:bg-cyan-950/20">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                          <Upload size={22} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-cyan-950 dark:text-cyan-50">
                              {title}
                            </h3>
                            <span className="rounded-full border border-cyan-300/70 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-400/30 dark:bg-slate-950/40 dark:text-cyan-200">
                              {verificationStatus}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-cyan-900/80 dark:text-cyan-100/80">
                            {description}
                          </p>
                          {profile?.doctor_verification_requested_at ? (
                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700/70 dark:text-cyan-200/70">
                              {tr("Dernier envoi", "Latest submission", "آخر إرسال")}:
                              {" "}
                              {new Date(profile.doctor_verification_requested_at).toLocaleDateString(locale)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {!isModerationBlocked ? (
                        <button
                          type="button"
                          onClick={() => router.push("/doctor-verification")}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-700"
                        >
                          <Upload size={16} />
                          {verificationStatus === "rejected"
                            ? tr(
                                "Corriger mon dossier",
                                "Fix my verification file",
                                "تصحيح ملفي",
                              )
                            : tr(
                                "Ouvrir la vérification",
                                "Open verification",
                                "فتح التحقق",
                              )}
                        </button>
                      ) : (
                        <div className="rounded-2xl border border-cyan-300/50 bg-white/70 px-4 py-3 text-sm font-medium text-cyan-900 dark:border-cyan-400/20 dark:bg-slate-950/40 dark:text-cyan-100">
                          {tr(
                            "La vérification reste suspendue tant que le blocage admin n'est pas levé.",
                            "Verification stays paused until the admin restriction is lifted.",
                            "يبقى التحقق معلقاً ما دام تقييد الإدارة لم يُرفع بعد.",
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {activeVisitAppointment ? (
                <div className="mb-8 rounded-[2.25rem] border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.96))] p-6 shadow-[0_24px_70px_-42px_rgba(16,185,129,0.45)] dark:border-emerald-500/20 dark:bg-[linear-gradient(135deg,rgba(8,47,36,0.96),rgba(15,23,42,0.98))]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <Clock size={13} />
                        {tr("Visite en cours", "Current visit", "الزيارة الحالية")}
                      </div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                        {activeVisitAppointment.patient?.full_name ?? tr("Patient", "Patient", "المريض")}
                      </h3>
                      <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                        {tr(
                          "Ce rendez-vous est épinglé en premier pendant sa période normale de consultation.",
                          "This appointment stays pinned first during its normal consultation window.",
                          "يبقى هذا الموعد مثبتاً أولاً خلال فترة الزيارة العادية."
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                          {getAppointmentDisplayLabel(activeVisitAppointment)}
                        </span>
                        <span className="rounded-full bg-white/90 px-3 py-1 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                          {tr(
                            `Fin prévue ${getAppointmentWindowEnd(activeVisitAppointment, Math.max(5, durationParams || 30)).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`,
                            `Expected end ${getAppointmentWindowEnd(activeVisitAppointment, Math.max(5, durationParams || 30)).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`,
                            `النهاية المتوقعة ${getAppointmentWindowEnd(activeVisitAppointment, Math.max(5, durationParams || 30)).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`
                          )}
                        </span>
                        {formatPatientRegistrationNumber(activeVisitAppointment.patient?.patient_registration_number) ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-mono tracking-[0.18em]">
                            ID {formatPatientRegistrationNumber(activeVisitAppointment.patient?.patient_registration_number)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          void openAppointmentWorkspace(activeVisitAppointment);
                        }}
                        className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                      >
                        {activeVisitLinkedDossier
                          ? tr("Ouvrir le dossier", "Open medical record", "فتح الملف الطبي")
                          : tr("Créer / ouvrir le dossier", "Create / open record", "إنشاء / فتح الملف")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("appointments")}
                        className="rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-slate-950/70 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                      >
                        {tr("Voir la file des RDV", "Open appointments queue", "فتح قائمة المواعيد")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div onClick={() => setActiveTab("appointments")} className="group bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none cursor-pointer transform hover:scale-[1.03] transition-all relative overflow-hidden">
                  <div className="absolute ltr:-right-8 rtl:-left-8 -bottom-8 opacity-5 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 text-blue-500">
                    <CalendarIcon size={160} />
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                    <CalendarIcon size={28} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-widest mb-1">{t("dashboard.doctor.stats.today")}</p>
                    <h3 className="text-4xl font-black mb-1 text-slate-900 dark:text-slate-100">
                      {appointments.filter(a => new Date(a.appointment_date).toDateString() === new Date().toDateString()).length}
                    </h3>
                    <p className="text-slate-500/70 text-xs font-medium">{t("dashboard.doctor.appointments")}</p>
                  </div>
                </div>

                <div onClick={() => setActiveTab("appointments")} className="group bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none cursor-pointer transform hover:scale-[1.03] transition-all relative overflow-hidden">
                  <div className="absolute ltr:-right-8 rtl:-left-8 -bottom-8 opacity-5 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 text-amber-500">
                    <Clock size={160} />
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50">
                    <Clock size={28} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-widest mb-1">{t("dashboard.doctor.stats.pending")}</p>
                    <h3 className="text-4xl font-black mb-1 text-slate-900 dark:text-slate-100">
                      {appointments.filter(a => a.status === "pending").length}
                    </h3>
                    <p className="text-slate-500/70 text-xs font-medium">{t("dashboard.doctor.appointments")}</p>
                  </div>
                </div>

                <div onClick={() => setActiveTab("patients")} className="group bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none cursor-pointer transform hover:scale-[1.03] transition-all relative overflow-hidden">
                  <div className="absolute ltr:-right-8 rtl:-left-8 -bottom-8 opacity-5 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 text-emerald-500">
                    <Users size={160} />
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
                    <Users size={28} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-widest mb-1">{t("dashboard.doctor.stats.totalPatients")}</p>
                    <h3 className="text-4xl font-black mb-1 text-slate-900 dark:text-slate-100">
                      {dossiers.length}
                    </h3>
                    <p className="text-slate-500/70 text-xs font-medium">{t("dashboard.doctor.patients")}</p>
                  </div>
                </div>

                <div onClick={() => setActiveTab("publications")} className="group bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none cursor-pointer transform hover:scale-[1.03] transition-all relative overflow-hidden">
                  <div className="absolute ltr:-right-8 rtl:-left-8 -bottom-8 opacity-5 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 text-purple-500">
                    <FileText size={160} />
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/30 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50">
                    <FileText size={28} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-widest mb-1">{t("dashboard.doctor.stats.totalPubs")}</p>
                    <h3 className="text-4xl font-black mb-1 text-slate-900 dark:text-slate-100">
                      {articles.length}
                    </h3>
                    <p className="text-slate-500/70 text-xs font-medium">{t("dashboard.doctor.publications")}</p>
                  </div>
                </div>
              </div>

              {/* NEW: Search Patient Quick Access */}
              <div className="mb-12">
                <div className="group relative overflow-hidden rounded-[2.5rem] bg-white p-2 shadow-2xl shadow-slate-200/50 dark:bg-slate-900/40 dark:shadow-none border border-slate-200/60 dark:border-slate-800">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 p-6">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-blue-600 text-white shadow-lg shadow-blue-500/30">
                      <Search size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        {t("dashboard.doctor.patients.search")}
                      </h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {tr("Accédez rapidement aux dossiers médicaux", "Quickly access medical records", "الوصول السريع إلى الملفات الطبية")}
                      </p>
                    </div>
                    <div className="w-full md:w-96">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={t("dashboard.doctor.patients.search")}
                          value={dossierSearch}
                          onChange={(e) => {
                            setDossierSearch(e.target.value);
                            setActiveTab("patients");
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-4 text-sm font-medium outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:focus:border-blue-400 dark:focus:bg-slate-900"
                        />
                        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {followUpReminderAppointments.length > 0 ? (
                <div className="mb-8 rounded-[2.25rem] border border-amber-200/70 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.96))] p-6 shadow-[0_24px_70px_-42px_rgba(245,158,11,0.45)] dark:border-amber-500/20 dark:bg-[linear-gradient(135deg,rgba(41,30,12,0.96),rgba(15,23,42,0.98))]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100/90 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        <Clock size={13} />
                        {tr("Rappels de contrôle", "Follow-up reminders", "تذكير مواعيد المراقبة")}
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">
                        {tr(
                          "Des rendez-vous de contrôle approchent sans heure fixée.",
                          "Some follow-up appointments are approaching without a confirmed time.",
                          "هناك مواعيد متابعة قريبة لم يتم تحديد ساعتها بعد."
                        )}
                      </h3>
                      <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                        {tr(
                          "Fixez l'heure maintenant pour que le patient voie le créneau final directement dans son dashboard.",
                          "Set the time now so the patient can see the final slot directly in their dashboard.",
                          "حدّد الساعة الآن حتى يشاهد المريض الموعد النهائي مباشرة في لوحة التحكم الخاصة به."
                        )}
                      </p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm dark:bg-slate-900/70 dark:text-slate-200">
                      {followUpReminderAppointments.length} {tr("rappel(s)", "reminder(s)", "تذكير")}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {followUpReminderAppointments.slice(0, 3).map((appointment) => {
                      const daysUntil = getDaysUntilCalendarDate(getAppointmentCalendarDate(appointment));
                      const targetDateLabel = new Date(`${getAppointmentCalendarDate(appointment)}T00:00:00`).toLocaleDateString(locale, { dateStyle: "medium" });
                      return (
                        <div
                          key={`follow-up-reminder-${appointment.id}`}
                          className="flex flex-col gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/60 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                              {appointment.patient?.full_name ?? tr("Patient", "Patient", "المريض")}
                            </p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                              {tr(
                                `Contrôle prévu le ${targetDateLabel}, heure encore à fixer.`,
                                `Follow-up planned for ${targetDateLabel}, time still to be confirmed.`,
                                `المتابعة مبرمجة يوم ${targetDateLabel} ولم يتم تحديد الساعة بعد.`
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                              {daysUntil === 0
                                ? tr("Aujourd'hui", "Today", "اليوم")
                                : tr(
                                    `Dans ${daysUntil} jour(s)`,
                                    `In ${daysUntil} day(s)`,
                                    `بعد ${daysUntil} يوم`
                                  )}
                            </span>
                            <button
                              onClick={() => {
                                setActiveTab("appointments");
                                openScheduleModal(appointment);
                              }}
                              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600"
                            >
                              {tr("Fixer l'heure", "Set the time", "تحديد الساعة")}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Recent Activity / Next Appointments */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t("dashboard.doctor.appointments")}</h2>
                    <button onClick={() => setActiveTab("appointments")} className="text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline flex items-center gap-1">
                      {t("ai.assistant.viewDetails")} <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-md rounded-[32px] border border-slate-200/60 dark:border-slate-800/50 overflow-hidden shadow-sm">
                    {appointments.length === 0 ? (
                      <div className="py-20 text-center text-slate-400">
                        <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-bold">{t("dashboard.doctor.appt.empty")}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {appointments.slice(0, 5).map(appt => (
                          <div key={appt.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg group-hover:scale-110 transition-transform">
                                {appt.patient?.full_name?.substring(0, 2).toUpperCase() || "PA"}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 dark:text-slate-100">{appt.patient?.full_name}</p>
                                {formatPatientRegistrationNumber(appt.patient?.patient_registration_number) ? (
                                  <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 font-mono tracking-[0.18em]">
                                    ID {formatPatientRegistrationNumber(appt.patient?.patient_registration_number)}
                                  </p>
                                ) : null}
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{getAppointmentDisplayLabel(appt)}</p>
                              </div>
                            </div>
                            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                              appt.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200/50 dark:border-green-800/50' :
                              appt.status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/50' :
                              'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/50 dark:border-slate-800'
                            }`}>
                              {(() => {
                                const statusKey = `dashboard.doctor.appt.status.${appt.status}` as const;
                                return t(statusKey) || appt.status;
                              })()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight">{t("dashboard.doctor.patients")}</h2>
                  <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-md rounded-[32px] border border-slate-200/60 dark:border-slate-800/50 p-6 shadow-sm">
                    {dossiers.length === 0 ? (
                      <div className="py-10 text-center text-slate-400">
                        <Users size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="font-bold text-sm">{t("dashboard.doctor.patients.empty")}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {dossiers.slice(0, 4).map(d => (
                          <div key={d.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer" onClick={() => { void openDossierDetails(d); }}>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500 text-xs">
                              {d.first_name[0]}{d.last_name[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">{d.first_name} {d.last_name}</p>
                              {formatPatientRegistrationNumber(d.patient_registration_number) ? (
                                <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 font-mono tracking-[0.18em]">
                                  ID {formatPatientRegistrationNumber(d.patient_registration_number)}
                                </p>
                              ) : null}
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{d.phone || d.email || "No contact"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setActiveTab("patients")} className="w-full mt-6 py-3 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest hover:opacity-90 transition-opacity">
                      {t("dashboard.doctor.patients")}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: APPOINTMENTS */}
          {activeTab === "appointments" && (
            <motion.div key="appointments" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
               <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2 font-mono tracking-tight">{t("dashboard.doctor.appt.title")}</h1>
                    <p className="text-slate-500 dark:text-slate-400">{t("dashboard.doctor.appt.subtitle")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900 sm:inline-flex sm:w-auto sm:flex-row sm:items-center sm:rounded-full sm:px-2 sm:py-2">
                      <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        {tr("Tri", "Sort", "الترتيب")}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAppointmentsSortOrder("desc")}
                        className={getSortButtonClasses(appointmentsSortOrder === "desc")}
                      >
                        {tr("Ajouts récents", "Recent additions", "أحدث الإضافات")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAppointmentsSortOrder("asc")}
                        className={getSortButtonClasses(appointmentsSortOrder === "asc")}
                      >
                        {tr("Ajouts anciens", "Oldest additions", "أقدم الإضافات")}
                      </button>
                    </div>
                    <button
                      onClick={handleManualRefresh}
                      disabled={isManualRefreshing}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <RefreshCw size={16} className={isManualRefreshing ? "animate-spin" : ""} /> {t("admin.refresh")}
                    </button>
                    <div className="bg-white dark:bg-slate-950 px-4 py-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                      <Clock size={16} className="text-blue-500"/> {new Date().toLocaleDateString(locale)}
                    </div>
                  </div>
               </div>
               
               <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                 {appointments.length === 0 ? (
                   <div className="py-16 text-center text-slate-400 dark:text-slate-500">
                     <CalendarIcon size={48} className="mx-auto mb-4 opacity-50" />
                     <p>{t("dashboard.doctor.appt.empty")}</p>
                   </div>
                 ) : (
                   <>
                   <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                     {sortedAppointmentsWithPinnedVisit.map((appt) => {
                       const linkedDossier = appt.patient_id
                         ? (dossiers.find((dossier) => dossier.patient_id === appt.patient_id) ?? null)
                         : null;
                       const isPinnedActiveVisit = activeVisitAppointment?.id === appt.id;

                       return (
                         <div
                           key={`mobile-${appt.id}`}
                           onClick={() => {
                             void openAppointmentWorkspace(appt);
                           }}
                           className={`space-y-4 p-4 transition hover:bg-slate-50/50 dark:hover:bg-slate-800/60 ${
                             isPinnedActiveVisit ? "bg-emerald-50/70 dark:bg-emerald-950/20" : ""
                           }`}
                         >
                           <div className="flex items-start justify-between gap-3">
                             <div className="min-w-0">
                               <p className="font-bold text-slate-900 dark:text-slate-100">{appt.patient?.full_name}</p>
                               <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                                 {getAppointmentDisplayLabel(appt)}
                               </p>
                               {formatPatientRegistrationNumber(appt.patient?.patient_registration_number) ? (
                                 <p className="mt-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 font-mono tracking-[0.18em]">
                                   ID {formatPatientRegistrationNumber(appt.patient?.patient_registration_number)}
                                 </p>
                               ) : null}
                             </div>
                             <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border ${
                               appt.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' :
                               appt.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' :
                               appt.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' :
                               'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                             }`}>
                               {(() => {
                                 const statusKey = `dashboard.doctor.appt.status.${appt.status}` as const;
                                 return t(statusKey) || appt.status;
                               })()}
                             </span>
                           </div>

                           <div className="flex flex-wrap items-center gap-2">
                             <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800">
                               {getBookingModeLabel(appt.booking_selection_mode)}
                             </span>
                             {appt.appointment_source === "doctor_follow_up" ? (
                               <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
                                 {tr("Contrôle", "Follow-up", "متابعة")}
                               </span>
                             ) : null}
                             {appt.follow_up_time_pending ? (
                               <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                                 {tr("Heure à fixer", "Time pending", "الساعة غير محددة")}
                               </span>
                             ) : null}
                             {isPinnedActiveVisit ? (
                               <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                                 {tr("Épinglé maintenant", "Pinned now", "مثبت الآن")}
                               </span>
                             ) : null}
                           </div>

                           <div className="flex flex-wrap gap-2">
                             {appt.status === 'pending' && (
                               <>
                                 {appt.booking_selection_mode === "patient_datetime" ? (
                                   <button onClick={(event) => { event.stopPropagation(); void updateAppointmentStatus(appt.id, 'confirmed'); }} className="rounded-xl bg-green-50 dark:bg-green-900/50 px-3 py-2 text-sm font-semibold text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/70 transition">
                                     {tr("Confirmer", "Confirm", "تأكيد")}
                                   </button>
                                 ) : (
                                   <button
                                     onClick={(event) => { event.stopPropagation(); openScheduleModal(appt); }}
                                     className="rounded-xl bg-blue-50 dark:bg-blue-900/50 px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/70 transition"
                                   >
                                     {tr("Planifier", "Schedule", "جدولة")}
                                   </button>
                                 )}
                                 <button onClick={(event) => { event.stopPropagation(); void updateAppointmentStatus(appt.id, 'cancelled'); }} className="rounded-xl bg-red-50 dark:bg-red-900/50 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/70 transition">
                                   {tr("Annuler", "Cancel", "إلغاء")}
                                 </button>
                               </>
                             )}
                             {appt.status === 'confirmed' && appt.follow_up_time_pending ? (
                               <button onClick={(event) => { event.stopPropagation(); openScheduleModal(appt); }} className="rounded-xl bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition">
                                 {tr("Fixer l'heure", "Set the time", "تحديد الساعة")}
                               </button>
                             ) : null}
                             {appt.status === 'confirmed' && !appt.follow_up_time_pending ? (
                               <button onClick={(event) => { event.stopPropagation(); void updateAppointmentStatus(appt.id, 'completed'); }} className="rounded-xl bg-blue-50 dark:bg-blue-900/50 px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/70 transition">
                                 {tr("Marquer terminé", "Mark completed", "تحديده كمكتمل")}
                               </button>
                             ) : null}
                             <button
                               onClick={(event) => {
                                 event.stopPropagation();
                                 void openAppointmentWorkspace(appt);
                               }}
                               className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                                 linkedDossier
                                   ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                                   : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                               }`}
                             >
                               {linkedDossier
                                 ? tr("Voir le dossier", "Open record", "فتح الملف")
                                 : tr("Créer un dossier", "Create record", "إنشاء ملف")}
                             </button>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                   <div className="hidden overflow-x-auto md:block">
                   <table className="min-w-[760px] w-full border-collapse text-left">
                     <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <th className="p-4 pl-6 font-semibold">{t("dashboard.doctor.appt.colPatient")}</th>
                          <th className="p-4 font-semibold">Date & Heure</th>
                          <th className="p-4 font-semibold">{t("dashboard.doctor.appt.colMode")}</th>
                          <th className="p-4 font-semibold">{t("dashboard.doctor.appt.colStatus")}</th>
                          <th className="p-4 pr-6 text-right font-semibold">{t("dashboard.doctor.appt.colActions")}</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                       {sortedAppointmentsWithPinnedVisit.map(appt => {
                         const linkedDossier = appt.patient_id
                           ? (dossiers.find((dossier) => dossier.patient_id === appt.patient_id) ?? null)
                           : null;
                         const isPinnedActiveVisit = activeVisitAppointment?.id === appt.id;

                         return (
                         <tr
                           key={appt.id}
                           onClick={() => {
                             void openAppointmentWorkspace(appt);
                           }}
                           className={`cursor-pointer transition hover:bg-slate-50/50 dark:hover:bg-slate-800 ${
                             isPinnedActiveVisit ? "bg-emerald-50/70 dark:bg-emerald-950/20" : ""
                           }`}
                         >
                           <td className="p-4 pl-6">
                             <p className="font-bold text-slate-900 dark:text-slate-100">{appt.patient?.full_name}</p>
                             {formatPatientRegistrationNumber(appt.patient?.patient_registration_number) ? (
                               <p className="mt-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 font-mono tracking-[0.18em]">
                                 ID {formatPatientRegistrationNumber(appt.patient?.patient_registration_number)}
                               </p>
                             ) : null}
                             {isPinnedActiveVisit ? (
                               <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                                 {tr("Épinglé maintenant", "Pinned now", "مثبت الآن")}
                               </p>
                             ) : null}
                           </td>
                            <td className="p-4 font-medium">
                              {getAppointmentDisplayLabel(appt)}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800">
                                  {getBookingModeLabel(appt.booking_selection_mode)}
                                </span>
                                {appt.appointment_source === "doctor_follow_up" ? (
                                  <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
                                    {tr("Contrôle", "Follow-up", "متابعة")}
                                  </span>
                                ) : null}
                                {appt.follow_up_time_pending ? (
                                  <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                                    {tr("Heure à fixer", "Time pending", "الساعة غير محددة")}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="p-4">
                             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                                appt.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' :
                                appt.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' :
                                appt.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' :
                                'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                             }`}>
                               {(() => {
                                 const statusKey = `dashboard.doctor.appt.status.${appt.status}` as const;
                                 return t(statusKey) || appt.status;
                               })()}
                             </span>
                           </td>
                           <td className="p-4 pr-6 text-right">
                              <div className="flex flex-col items-end gap-2">
                              {appt.status === 'pending' && (
                                <div className="flex justify-end gap-2">
                                  {appt.booking_selection_mode === "patient_datetime" ? (
                                    <button onClick={(event) => { event.stopPropagation(); void updateAppointmentStatus(appt.id, 'confirmed'); }} className="p-2 bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 rounded-lg transition" title="Confirmer">
                                      <CheckCircle size={18} />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(event) => { event.stopPropagation(); openScheduleModal(appt); }}
                                      className="text-xs bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-100 dark:hover:bg-blue-900 transition"
                                      title="Planifier date et heure"
                                    >
                                      Planifier
                                    </button>
                                  )}
                                  <button onClick={(event) => { event.stopPropagation(); void updateAppointmentStatus(appt.id, 'cancelled'); }} className="p-2 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition" title="Annuler">
                                    <XCircle size={18} />
                                  </button>
                                </div>
                              )}
                             {appt.status === 'confirmed' && appt.follow_up_time_pending && (
                                <button onClick={(event) => { event.stopPropagation(); openScheduleModal(appt); }} className="text-sm bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-100 dark:hover:bg-amber-950/60 transition">
                                  {tr("Fixer l'heure", "Set the time", "تحديد الساعة")}
                                </button>
                             )}
                             {appt.status === 'confirmed' && !appt.follow_up_time_pending && (
                                <button onClick={(event) => { event.stopPropagation(); void updateAppointmentStatus(appt.id, 'completed'); }} className="text-sm bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900 transition">
                                  Marquer Terminé
                                </button>
                             )}
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void openAppointmentWorkspace(appt);
                                }}
                                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                                  linkedDossier
                                    ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                                }`}
                              >
                                {linkedDossier
                                  ? tr("Voir le dossier", "Open record", "فتح الملف")
                                  : tr("Créer un dossier", "Create record", "إنشاء ملف")}
                              </button>
                              </div>
                           </td>
                         </tr>
                       )})}
                     </tbody>
                   </table>
                   </div>
                   </>
                 )}
               </div>
            </motion.div>
          )}

          
          {/* TAB: COMMUNITY (ALL POSTS) */}
          {activeTab === "community" && (
            <motion.div key="community_feed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
               <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                 <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                   <FileText className="text-blue-600"/> {t("dashboard.doctor.communityTitle")}
                 </h2>
                 <button
                   onClick={handleManualRefresh}
                   disabled={isManualRefreshing}
                   className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                 >
                   <RefreshCw size={16} className={isManualRefreshing ? "animate-spin" : ""} /> Rafraîchir
                 </button>
               </div>
               <div className="space-y-6 max-w-4xl mx-auto">
                 {allArticles.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">Aucune publication sur la plateforme pour le moment.</div>
                 ) : (
                   allArticles.map((article) => {
                      const likes = likesByPost[article.id] || { count: 0, likedByMe: false };
                      const saves = savesByPost[article.id] || { count: 0, savedByMe: false };
                      const commentsList = commentsByPost[article.id] || [];
                      const isCommenting = commentSubmittingPostId === article.id;
                      const draft = commentDraftsByPostId[article.id] || "";

                      return (
                     <article key={'all_'+article.id} className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-6 lg:p-8 rounded-3xl border border-slate-100/50 dark:border-slate-800/50 shadow-xl shadow-blue-900/5 hover:shadow-blue-900/10 transition-all duration-300">
                       <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                         <button
                           type="button"
                           onClick={() => void openCommunityDoctorDetails(article.doctor_id)}
                           className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90"
                           title={tr("Ouvrir la fiche du docteur", "Open doctor profile", "فتح بطاقة الطبيب")}
                         >
                           {article.author?.avatar_url ? (
                             <img
                               src={article.author.avatar_url}
                               alt={article.author.full_name || "Docteur"}
                               className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                             />
                           ) : (
                             <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300 uppercase">
                               {(article.author?.full_name?.substring(0, 2) ?? "DR").toUpperCase()}
                             </div>
                           )}
                           <div className="min-w-0">
                             <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">Dr. {article.author?.full_name ?? "Médecin"}</p>
                             <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{article.author?.specialty ?? "Généraliste"} · {new Date(article.created_at).toLocaleDateString("fr-FR")}</p>
                           </div>
                         </button>
                         <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${article.category === "maladie" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                           {article.category === "maladie" ? "Maladie" : "Conseil"}
                         </span>
                       </div>
                       
                       <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100 mb-2">{article.title}</h3>
                       <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{article.content}</p>
                       
                       {article.images?.length > 0 && (
                         <div className={`mt-4 grid gap-2 ${article.images.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                           {article.images.slice(0, 4).map((img) => (
                             <img key={img.id} src={img.image_url} alt="pic" className="w-full h-48 object-cover rounded-xl" />
                           ))}
                         </div>
                       )}

                       {/* Stats & Actions */}
                        <div className="mt-5 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
                         <div className="flex flex-wrap items-center gap-3">
                           <button onClick={() => toggleLikePost(article.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${likes.likedByMe ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                             <Heart size={16} className={likes.likedByMe ? "fill-current" : ""} /> {likes.count}
                           </button>
                           <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50">
                             <MessageCircle size={16} /> {commentsList.length}
                           </button>
                         </div>
                         <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0">
                           <button onClick={() => toggleSavePost(article.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${saves.savedByMe ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                             <Bookmark size={16} className={saves.savedByMe ? "fill-current" : ""} /> Sauvegarder
                           </button>
                         </div>
                        </div>

                        {/* Comments */}
                        <div className="mt-4 space-y-3">
                          {commentsList.map((c) => (
                            <div key={c.id} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl flex gap-3 text-sm border border-slate-100 dark:border-slate-800">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 font-bold text-xs text-blue-700">
                                {c.author_name?.substring(0, 2).toUpperCase() ?? "U"}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{c.author_name ?? "Utilisateur"}</span>
                                  <button onClick={() => setReportTarget({ type: "comment", id: c.id })} className="text-slate-400 hover:text-rose-500"><Flag size={12}/></button>
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{c.content}</p>
                              </div>
                            </div>
                          ))}
                          
                          {/* Write Comment */}
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                             <input
                               type="text"
                               placeholder="Ajouter un commentaire professionnel..."
                               value={draft}
                               onChange={(e) => setCommentDraftsByPostId(p => ({ ...p, [article.id]: e.target.value }))}
                               onKeyDown={(e) => e.key === "Enter" && submitComment(article.id)}
                               className="w-full rounded-2xl border-none bg-slate-50 px-5 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-200 sm:rounded-full"
                             />
                             <button
                               onClick={() => submitComment(article.id)}
                               disabled={!draft || isCommenting}
                               className="inline-flex items-center justify-center self-end rounded-full bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:opacity-50 sm:self-auto"
                             >
                                <Send size={14} />
                             </button>
                          </div>
                        </div>

                     </article>
                   )})
                 )}
               </div>
            </motion.div>
          )}


          {/* TAB: MES PUBLICATIONS (GESTION) */}
          {activeTab === "publications" && (
            <motion.div key="community" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
               <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                 <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                   <Upload className="text-blue-600"/> {t("dashboard.doctor.publicationsTitle")}
                 </h2>
                 <button
                   onClick={handleManualRefresh}
                   disabled={isManualRefreshing}
                   className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                 >
                   <RefreshCw size={16} className={isManualRefreshing ? "animate-spin" : ""} /> Rafraîchir
                 </button>
               </div>
               <div className="max-w-4xl mx-auto flex flex-col gap-10">
                 {/* Formulaire */}
                 <div className="w-full">
                   <div className="bg-white dark:bg-slate-950 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 sticky top-8">
                     <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-4">Nouvel Article</h3>
                     <form onSubmit={handlePublishArticle} className="grid md:grid-cols-2 gap-5">
                       <div>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Type de publication</label>
                         <select
                           value={newArticle.category}
                           onChange={(e) =>
                             setNewArticle((current) => ({
                               ...current,
                               category: e.target.value as "conseil" | "maladie",
                             }))
                           }
                           className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition"
                         >
                           <option value="conseil">Conseil médical</option>
                           <option value="maladie">Information maladie</option>
                         </select>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Titre de l&apos;article</label>
                         <input required type="text" value={newArticle.title} onChange={e => setNewArticle({...newArticle, title: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="Ex: Les bienfaits de l'hydratation"/>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Contenu médical</label>
                         <textarea required value={newArticle.content} onChange={e => setNewArticle({...newArticle, content: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition h-32 resize-none" placeholder="Rédigez vos conseils ici..."></textarea>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Photos (max 10)</label>
                         <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                           <Images size={16} />
                           Ajouter des images ({pendingPublicationImages.length}/10)
                           <input
                             type="file"
                             accept="image/*"
                             multiple
                             className="hidden"
                             onChange={(event) => {
                               handlePublicationImagesChange(event.target.files);
                               event.currentTarget.value = "";
                             }}
                           />
                         </label>
                         {pendingPublicationImages.length > 0 ? (
                           <div className="grid grid-cols-3 gap-2 mt-3">
                             {pendingPublicationImages.map((image, index) => (
                               <div key={`${image.file.name}-${index}`} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                 <img src={image.previewUrl} alt={`Prévisualisation ${index + 1}`} className="w-full h-20 object-cover" />
                                 <button
                                   type="button"
                                   onClick={() => removePendingPublicationImage(index)}
                                   className="absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                                 >
                                   <X size={14} />
                                 </button>
                               </div>
                             ))}
                           </div>
                         ) : null}
                       </div>
                        <button type="submit" className="md:col-span-2 bg-slate-900 dark:bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-slate-800 dark:hover:bg-blue-500 transition shadow-md">Publier l&apos;article</button>
                     </form>
                   </div>
                 </div>
                 {/* Liste articles */}
                 <div className="w-full flex flex-col gap-4">\n                    <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100 mb-2">Historique des publications</h3>
                   {articles.length === 0 ? <p className="text-slate-400 italic">Vous n&apos;avez publié aucun article.</p> : null}
                   {articles.map(art => (
                     <div key={art.id} className="bg-white dark:bg-slate-950 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            art.category === "maladie"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          }`}>
                            {art.category === "maladie" ? "Maladie" : "Conseil"}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleDeletePublication(art.id)}
                            disabled={deletingPublicationId === art.id}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                          >
                            <Trash2 size={14} />
                            {deletingPublicationId === art.id ? "Suppression..." : "Supprimer"}
                          </button>
                        </div>
                        <h4 className="font-bold text-xl text-slate-900 dark:text-slate-100">{art.title}</h4>
                        {art.is_hidden ? (
                          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                            Publication masquée par modération{art.hidden_reason ? ` · ${art.hidden_reason}` : ""}.
                          </p>
                        ) : null}
                        <p className="text-xs text-slate-400 font-medium">Publié le {new Date(art.created_at).toLocaleDateString('fr-FR')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">{art.content}</p>
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Studio de publication</p>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Performance en direct</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <Eye size={15} />
                              {viewsByPost[art.id] ?? 0} vue{(viewsByPost[art.id] ?? 0) > 1 ? "s" : ""}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <Heart size={15} className={likesByPost[art.id]?.likedByMe ? "fill-current" : ""} />
                              {likesByPost[art.id]?.count ?? 0} j&apos;aime
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <MessageCircle size={15} />
                              {(commentsByPost[art.id] ?? []).length} commentaire{(commentsByPost[art.id] ?? []).length > 1 ? "s" : ""}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <Bookmark size={15} className={savesByPost[art.id]?.savedByMe ? "fill-current" : ""} />
                              {savesByPost[art.id]?.count ?? 0} sauvegarde{(savesByPost[art.id]?.count ?? 0) > 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        {art.images.length > 0 ? (
                          <div className={`mt-3 grid gap-2 ${art.images.length === 1 ? "grid-cols-1" : art.images.length === 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"}`}>
                            {art.images.slice(0, 6).map((image, index) => (
                              <img key={image.id} src={image.image_url} alt={`Publication ${art.title} - photo ${index + 1}`} className="w-full h-36 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                            ))}
                            {art.images.length > 6 ? (
                              <div className="h-36 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                                +{art.images.length - 6} photos
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Commentaires sur cette publication</p>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {(commentsByPost[art.id] ?? []).length} au total
                            </span>
                          </div>
                          {(commentsByPost[art.id] ?? []).length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">Aucun commentaire pour le moment.</p>
                          ) : (
                            <div className="space-y-2">
                              {(commentsByPost[art.id] ?? []).map((comment) => (
                                <div key={comment.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        {comment.author_name ?? "Utilisateur"}
                                      </p>
                                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                        {new Date(comment.created_at).toLocaleDateString("fr-FR")}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => startReplyToComment(art.id, comment.author_name)}
                                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                      <Send size={11} />
                                      Répondre
                                    </button>
                                  </div>
                                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{comment.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              ref={(element) => {
                                commentInputRefs.current[art.id] = element;
                              }}
                              type="text"
                              placeholder="Répondre à un commentaire..."
                              value={commentDraftsByPostId[art.id] ?? ""}
                              onChange={(e) => setCommentDraftsByPostId((prev) => ({ ...prev, [art.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && submitComment(art.id)}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 sm:rounded-full"
                            />
                            <button
                              type="button"
                              onClick={() => submitComment(art.id)}
                              disabled={!commentDraftsByPostId[art.id]?.trim() || commentSubmittingPostId === art.id}
                              className="inline-flex items-center justify-center self-end rounded-full bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:opacity-50 sm:self-auto"
                            >
                              <Send size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === "prescriptions" && (
            <motion.div key="prescriptions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                    <ClipboardList className="text-blue-500" size={26} />
                    {tr("Ordonnances ponctuelles", "Standalone prescriptions", "الوصفات السريعة")}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {tr(
                      "Créez une ordonnance pour un patient de passage sans créer de dossier, ou rattachez-la directement à un dossier existant.",
                      "Create a prescription for a walk-in patient without creating a medical record, or attach it directly to an existing record.",
                      "أنشئ وصفة لمريض عابر بدون إنشاء ملف طبي، أو اربطها مباشرة بملف موجود."
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void loadStandalonePrescriptions();
                  }}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <RefreshCw size={16} className={standalonePrescriptionsLoading ? "animate-spin" : ""} />
                  {tr("Actualiser", "Refresh", "تحديث")}
                </button>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,420px),1fr]">
                <section className="rounded-[2rem] border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">
                    {tr("Nouveau flux", "New flow", "تدفق جديد")}
                  </p>
                  <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                    {tr("Rédiger une ordonnance hors consultation", "Write a prescription outside a visit", "كتابة وصفة خارج الزيارة")}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {tr(
                      "Utilisez ce mode pour les passages rapides. Le dossier médical reste optionnel.",
                      "Use this mode for quick walk-ins. The medical record stays optional.",
                      "استخدم هذا الوضع للمرور السريع. يبقى الملف الطبي اختيارياً."
                    )}
                  </p>

                  <label className="mt-5 mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {tr("Dossier médical à lier (optionnel)", "Medical record to attach (optional)", "الملف الطبي المرتبط (اختياري)")}
                  </label>
                  <select
                    value={standalonePrescriptionLinkedDossierId}
                    onChange={(event) => setStandalonePrescriptionLinkedDossierId(event.target.value)}
                    className="min-h-[48px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400"
                  >
                    <option value="">
                      {tr("Aucun dossier: patient de passage", "No record: walk-in patient", "بدون ملف: مريض عابر")}
                    </option>
                    {sortedDossiers.map((dossier) => (
                      <option key={dossier.id} value={dossier.id}>
                        {`${dossier.first_name} ${dossier.last_name}`.trim()}
                        {formatPatientRegistrationNumber(dossier.patient_registration_number)
                          ? ` · ID ${formatPatientRegistrationNumber(dossier.patient_registration_number)}`
                          : ""}
                      </option>
                    ))}
                  </select>

                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm dark:border-slate-700 dark:bg-slate-950/70">
                    {selectedStandaloneLinkedDossier ? (
                      <div className="space-y-2">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {tr("Dossier lié", "Linked record", "الملف المرتبط")}:
                          {" "}
                          {`${selectedStandaloneLinkedDossier.first_name} ${selectedStandaloneLinkedDossier.last_name}`.trim()}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">
                          {selectedStandaloneLinkedDossier.patient_registration_number
                            ? `ID ${formatPatientRegistrationNumber(selectedStandaloneLinkedDossier.patient_registration_number)}`
                            : tr(
                                "Le dossier sera lié sans identifiant patient imprimé.",
                                "The record will be linked without a printed patient identifier.",
                                "سيتم ربط الملف بدون معرف مريض مطبوع."
                              )}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400">
                        {tr(
                          "Aucun dossier ne sera créé automatiquement. L'ordonnance restera indépendante et imprimable immédiatement.",
                          "No medical record will be created automatically. The prescription will stay standalone and printable immediately.",
                          "لن يتم إنشاء ملف طبي تلقائياً. ستبقى الوصفة مستقلة وقابلة للطباعة فوراً."
                        )}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openStandalonePrescriptionComposer(null)}
                    className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    <Plus size={18} />
                    {tr("Rédiger l'ordonnance", "Write prescription", "كتابة الوصفة")}
                  </button>
                </section>

                <section className="rounded-[2rem] border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-5">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                      {tr("Historique des ordonnances libres", "Standalone prescription history", "سجل الوصفات الحرة")}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {standalonePrescriptions.length} {tr("document(s)", "document(s)", "مستند(ات)")}
                    </p>
                  </div>

                  {standalonePrescriptionsLoading ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                      {tr("Chargement des ordonnances...", "Loading prescriptions...", "جارٍ تحميل الوصفات...")}
                    </div>
                  ) : standalonePrescriptions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-slate-800">
                      <ClipboardList size={34} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {tr("Aucune ordonnance libre enregistrée.", "No standalone prescription saved yet.", "لا توجد وصفة حرة محفوظة بعد.")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {standalonePrescriptions.map((prescription) => {
                        const linkedDossier = prescription.dossier_id
                          ? (dossiers.find((dossier) => dossier.id === prescription.dossier_id) ?? null)
                          : null;
                        const publicUrl = getPublicPrescriptionUrl(prescription.public_token);

                        return (
                          <article key={prescription.id} className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                    {tr("Ordonnance", "Prescription", "وصفة")} #{prescription.prescription_number}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {new Date(`${prescription.prescription_date}T12:00:00`).toLocaleDateString(locale)}
                                  </span>
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${linkedDossier ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>
                                    {linkedDossier
                                      ? tr("Liée à un dossier", "Attached to a record", "مرتبطة بملف")
                                      : tr("Patient de passage", "Walk-in patient", "مريض عابر")}
                                  </span>
                                </div>

                                <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                                  {prescription.patient_display_name || tr("Patient sans nom", "Unnamed patient", "مريض بدون اسم")}
                                </h3>

                                {prescription.patient_registration_number ? (
                                  <p className="mt-1 text-xs font-semibold tracking-[0.18em] text-blue-700 dark:text-blue-300">
                                    ID {formatPatientRegistrationNumber(prescription.patient_registration_number)}
                                  </p>
                                ) : null}

                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                  {linkedDossier
                                    ? tr(
                                        `Rattachée au dossier de ${linkedDossier.first_name} ${linkedDossier.last_name}.`,
                                        `Attached to ${linkedDossier.first_name} ${linkedDossier.last_name}'s record.`,
                                        `مرتبطة بملف ${linkedDossier.first_name} ${linkedDossier.last_name}.`
                                      )
                                    : tr(
                                        "Créée sans dossier médical, pour une délivrance ponctuelle.",
                                        "Created without a medical record for one-time delivery.",
                                        "تم إنشاؤها بدون ملف طبي لوصفة لمرة واحدة."
                                      )}
                                </p>

                                {prescription.notes ? (
                                  <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
                                    {prescription.notes}
                                  </p>
                                ) : null}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openStandalonePrescriptionComposer(prescription)}
                                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  <Pencil size={15} />
                                  {tr("Modifier", "Edit", "تعديل")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (publicUrl) {
                                      window.open(publicUrl, "_blank", "noopener,noreferrer");
                                    }
                                  }}
                                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  <ExternalLink size={15} />
                                  {tr("Ouvrir", "Open", "فتح")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void copyStandalonePrescriptionLink(prescription.public_token);
                                  }}
                                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  <Copy size={15} />
                                  {tr("Copier le lien", "Copy link", "نسخ الرابط")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void deleteStandalonePrescription(prescription);
                                  }}
                                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                                >
                                  <Trash2 size={15} />
                                  {tr("Supprimer", "Delete", "حذف")}
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </motion.div>
          )}

          {/* TAB: PATIENTS / DOSSIERS MÉDICAUX */}
          {activeTab === "patients" && (
            <motion.div key="patients" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

              {/* MODAL: Nouveau Dossier */}
              <AnimatePresence>
                {showNewDossierModal && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><UserCircle className="text-blue-500" size={22} /> {tr("Nouveau Dossier Patient", "New Patient Record", "ملف مريض جديد")}</h3>
                          {dossierSourceAppointment ? (
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {tr("Création directe depuis un rendez-vous patient.", "Direct creation from a patient appointment.", "إنشاء مباشر انطلاقاً من موعد المريض.")}
                            </p>
                          ) : null}
                        </div>
                        <button onClick={closeNewDossierModal} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"><X size={20} /></button>
                      </div>
                      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {dossierSourceAppointment ? (
                          <div className="col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                            {tr("Le dossier sera lié automatiquement à ce rendez-vous et à l'historique futur du patient.", "This record will be linked automatically to this appointment and the patient's future history.", "سيتم ربط هذا الملف تلقائياً بهذا الموعد وبسجل المريض المستقبلي.")}
                          </div>
                        ) : null}
                        <div className="col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Prénom *</label>
                            <input value={newDossierForm.first_name} onChange={e => setNewDossierForm(f => ({ ...f, first_name: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Prénom" /></div>
                          <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Nom *</label>
                            <input value={newDossierForm.last_name} onChange={e => setNewDossierForm(f => ({ ...f, last_name: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nom" /></div>
                        </div>
                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Téléphone</label>
                          <input value={newDossierForm.phone} onChange={e => setNewDossierForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="+213 XX XX XX XX" /></div>
                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Email</label>
                          <input type="email" value={newDossierForm.email} onChange={e => setNewDossierForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="email@exemple.com" /></div>
                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Date de naissance</label>
                          <input type="date" value={newDossierForm.date_of_birth} onChange={e => setNewDossierForm(f => ({ ...f, date_of_birth: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" /></div>
                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Sexe</label>
                          <select value={newDossierForm.gender} onChange={e => setNewDossierForm(f => ({ ...f, gender: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Sélectionner...</option><option value="Homme">Homme</option><option value="Femme">Femme</option><option value="Autre">Autre</option>
                          </select></div>
                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Groupe sanguin</label>
                          <select value={newDossierForm.blood_type} onChange={e => setNewDossierForm(f => ({ ...f, blood_type: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Inconnu</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select></div>
                        <div className="col-span-2"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Allergies connues</label>
                          <input value={newDossierForm.allergies} onChange={e => setNewDossierForm(f => ({ ...f, allergies: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Pénicilline, pollen..." /></div>
                        <div className="col-span-2"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Maladies chroniques</label>
                          <input value={newDossierForm.chronic_conditions} onChange={e => setNewDossierForm(f => ({ ...f, chronic_conditions: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Diabète, hypertension..." /></div>
                        <div className="col-span-2"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Remarques générales</label>
                          <textarea value={newDossierForm.general_remarks} onChange={e => setNewDossierForm(f => ({ ...f, general_remarks: e.target.value }))} rows={3} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Notes générales sur ce patient..." /></div>
                      </div>
                      <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 p-6 dark:border-slate-800 sm:flex-row">
                        <button onClick={closeNewDossierModal} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition">{tr("Annuler", "Cancel", "إلغاء")}</button>
                        <button disabled={dossierLoading} onClick={() => void handleCreateDossier()} className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-60">
                          {dossierLoading
                            ? tr("Création...", "Creating...", "جارٍ الإنشاء...")
                            : dossierSourceAppointment
                              ? tr("Créer le dossier lié", "Create linked record", "إنشاء الملف المرتبط")
                              : tr("Créer le dossier", "Create record", "إنشاء الملف")}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* MODAL: Nouvelle Visite */}
              <AnimatePresence>
                {showNewVisitModal && selectedDossier && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Activity className="text-emerald-500" size={22} /> Nouvelle Consultation</h3>
                        <button onClick={() => setShowNewVisitModal(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"><X size={20} /></button>
                      </div>
                      <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Date *</label>
                            <input type="date" value={newVisitForm.visit_date} onChange={e => setNewVisitForm(f => ({ ...f, visit_date: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                          <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Heure</label>
                            <input type="time" value={newVisitForm.visit_time} onChange={e => setNewVisitForm(f => ({ ...f, visit_time: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                        </div>
                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Motif de consultation</label>
                          <input value={newVisitForm.reason} onChange={e => setNewVisitForm(f => ({ ...f, reason: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Fièvre, douleur abdominale..." /></div>
                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Diagnostic</label>
                          <textarea value={newVisitForm.diagnosis} onChange={e => setNewVisitForm(f => ({ ...f, diagnosis: e.target.value }))} rows={2} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 resize-none" placeholder="Diagnostic établi..." /></div>
                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Traitement prescrit</label>
                          <textarea value={newVisitForm.treatment} onChange={e => setNewVisitForm(f => ({ ...f, treatment: e.target.value }))} rows={2} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 resize-none" placeholder="Médicaments, posologie..." /></div>
                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Remarques privées (Dr)</label>
                          <textarea value={newVisitForm.doctor_notes} onChange={e => setNewVisitForm(f => ({ ...f, doctor_notes: e.target.value }))} rows={2} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 resize-none" placeholder="Notes internes..." /></div>
                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Date de suivi recommandée</label>
                          <input type="date" value={newVisitForm.follow_up_date} onChange={e => setNewVisitForm(f => ({ ...f, follow_up_date: e.target.value, schedule_follow_up: e.target.value ? f.schedule_follow_up : false, follow_up_time: e.target.value ? f.follow_up_time : "" }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                        {selectedDossier.patient_id ? (
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                            <label className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={Boolean(newVisitForm.schedule_follow_up)}
                                disabled={!newVisitForm.follow_up_date}
                                onChange={e => setNewVisitForm(f => ({ ...f, schedule_follow_up: e.target.checked }))}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>
                                <span className="block text-sm font-bold text-emerald-800 dark:text-emerald-200">
                                  {tr("Programmer ce contrôle dans les rendez-vous du patient", "Schedule this follow-up in the patient's appointments", "برمجة هذه المتابعة داخل مواعيد المريض")}
                                </span>
                                <span className="mt-1 block text-xs text-emerald-700/90 dark:text-emerald-300/80">
                                  {tr(
                                    "Vous pouvez choisir seulement la date. L'heure reste optionnelle et pourra être confirmée plus tard.",
                                    "You may choose only the date. Time is optional and can be confirmed later.",
                                    "يمكنك اختيار التاريخ فقط. الساعة اختيارية ويمكن تأكيدها لاحقاً."
                                  )}
                                </span>
                              </span>
                            </label>

                            {newVisitForm.schedule_follow_up ? (
                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                                    {tr("Heure du contrôle (optionnelle)", "Follow-up time (optional)", "ساعة المتابعة (اختيارية)")}
                                  </label>
                                  <input
                                    type="time"
                                    value={newVisitForm.follow_up_time}
                                    onChange={e => setNewVisitForm(f => ({ ...f, follow_up_time: e.target.value }))}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                  />
                                </div>
                                <div className="rounded-xl border border-dashed border-emerald-200 bg-white/80 px-4 py-3 text-xs text-slate-600 dark:border-emerald-900/40 dark:bg-slate-900/70 dark:text-slate-300">
                                  {newVisitForm.follow_up_time
                                    ? tr(
                                        "Le patient verra la date et l'heure tout de suite dans son dashboard.",
                                        "The patient will see the date and time immediately in their dashboard.",
                                        "سيرى المريض التاريخ والساعة مباشرة في لوحة التحكم."
                                      )
                                    : tr(
                                        "Le patient verra la date du contrôle, puis vous recevrez un rappel 4 jours avant pour fixer l'heure.",
                                        "The patient will see the follow-up date, then you will receive a reminder 4 days before to set the time.",
                                        "سيرى المريض تاريخ المتابعة، ثم ستتلقى تذكيراً قبل 4 أيام لتحديد الساعة."
                                      )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : newVisitForm.follow_up_date ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                            {tr(
                              "Ce dossier n'est pas lié à un compte patient. Le suivi sera enregistré dans le dossier, sans créer de rendez-vous visible côté patient.",
                              "This record is not linked to a patient account. The follow-up will stay in the medical record without creating a visible patient appointment.",
                              "هذا الملف غير مرتبط بحساب مريض. سيتم حفظ المتابعة في الملف فقط دون إنشاء موعد ظاهر للمريض."
                            )}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 p-6 dark:border-slate-800 sm:flex-row">
                        <button onClick={() => setShowNewVisitModal(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition">Annuler</button>
                        <button disabled={visitLoading} onClick={async () => {
                          if (!newVisitForm.visit_date) { showNotice('Date requise', 'error'); return; }
                          if (!profile) { showNotice(tr("Profil introuvable.", "Profile not found.", "الملف الشخصي غير موجود."), 'error'); return; }
                          setVisitLoading(true);
                          try {
                            const { data, error } = await supabase.from('dossier_visits').insert({ dossier_id: selectedDossier.id, visit_date: newVisitForm.visit_date, visit_time: newVisitForm.visit_time || null, reason: newVisitForm.reason || null, diagnosis: newVisitForm.diagnosis || null, treatment: newVisitForm.treatment || null, doctor_notes: newVisitForm.doctor_notes || null, follow_up_date: newVisitForm.follow_up_date || null }).select().single();
                            if (error) throw error;

                            const createdVisit = data as DossierVisit;
                            setDossierVisits(prev => [createdVisit, ...prev]);

                            const shouldScheduleFollowUp = Boolean(
                              newVisitForm.schedule_follow_up &&
                              newVisitForm.follow_up_date &&
                              selectedDossier.patient_id
                            );

                            if (shouldScheduleFollowUp) {
                              const fallbackTime = normalizeTimeValue(workingHoursStart, "08:00");
                              const followUpTime = newVisitForm.follow_up_time
                                ? normalizeTimeValue(newVisitForm.follow_up_time, fallbackTime)
                                : null;
                              const followUpDateTime = buildLocalDateTime(newVisitForm.follow_up_date, followUpTime ?? fallbackTime);
                              const followUpNotes = [
                                tr("Contrôle programmé depuis le dossier médical.", "Follow-up scheduled from the medical record.", "تمت برمجة المتابعة من الملف الطبي."),
                                newVisitForm.reason?.trim()
                                  ? tr(`Motif: ${newVisitForm.reason.trim()}`, `Reason: ${newVisitForm.reason.trim()}`, `السبب: ${newVisitForm.reason.trim()}`)
                                  : null,
                              ].filter(Boolean).join(" ");

                              const { data: insertedFollowUp, error: followUpError } = await supabase
                                .from("appointments")
                                .insert({
                                  patient_id: selectedDossier.patient_id,
                                  doctor_id: profile.id,
                                  appointment_date: followUpDateTime.toISOString(),
                                  status: "confirmed",
                                  booking_selection_mode: "doctor_datetime",
                                  requested_date: newVisitForm.follow_up_date,
                                  requested_time: followUpTime ? `${followUpTime}:00` : null,
                                  appointment_source: "doctor_follow_up",
                                  follow_up_visit_id: createdVisit.id,
                                  follow_up_dossier_id: selectedDossier.id,
                                  follow_up_time_pending: !followUpTime,
                                  follow_up_reminder_days: 4,
                                  notes: followUpNotes || null,
                                })
                                .select("id, patient_id, created_at, appointment_date, status, booking_selection_mode, requested_date, requested_time, appointment_source, follow_up_visit_id, follow_up_dossier_id, follow_up_time_pending, follow_up_reminder_days, notes")
                                .single();

                              if (followUpError) {
                                throw followUpError;
                              }

                              const insertedFollowUpAppointment = insertedFollowUp as {
                                id: string;
                                patient_id?: string | null;
                                created_at?: string | null;
                                appointment_date: string;
                                status: string;
                                booking_selection_mode?: BookingSelectionMode | null;
                                requested_date?: string | null;
                                requested_time?: string | null;
                                appointment_source?: "patient_request" | "doctor_follow_up" | null;
                                follow_up_visit_id?: string | null;
                                follow_up_dossier_id?: string | null;
                                follow_up_time_pending?: boolean | null;
                                follow_up_reminder_days?: number | null;
                                notes?: string | null;
                              };

                              const normalizedFollowUpAppointment = normalizeDoctorAppointment({
                                ...insertedFollowUpAppointment,
                                patient: {
                                  id: selectedDossier.patient_id,
                                  full_name: `${selectedDossier.first_name} ${selectedDossier.last_name}`.trim(),
                                  gender: selectedDossier.gender,
                                  patient_registration_number: selectedDossier.patient_registration_number,
                                },
                              });

                              setAppointments((prev) => sortItemsByDate([...prev, normalizedFollowUpAppointment], (appointment) => appointment.created_at, "desc"));
                              setDossierAppointmentHistory((prev) => sortItemsByDate([...prev, normalizedFollowUpAppointment], (appointment) => appointment.created_at, "desc"));
                              setFollowUpAppointmentsByVisitId((prev) => ({
                                ...prev,
                                [createdVisit.id]: normalizedFollowUpAppointment,
                              }));

                              await logAuditEvent({
                                actorId: profile.id,
                                action: "follow_up_appointment_created",
                                entityType: "appointment",
                                entityId: normalizedFollowUpAppointment.id,
                                metadata: {
                                  dossier_id: selectedDossier.id,
                                  visit_id: createdVisit.id,
                                  patient_id: selectedDossier.patient_id,
                                  requested_date: newVisitForm.follow_up_date,
                                  requested_time: followUpTime,
                                  time_pending: !followUpTime,
                                },
                              });
                            }

                            setShowNewVisitModal(false);
                            setNewVisitForm(createEmptyVisitForm());
                            showNotice(
                              shouldScheduleFollowUp
                                ? tr("Consultation ajoutée et contrôle programmé.", "Visit added and follow-up scheduled.", "تمت إضافة الاستشارة وبرمجة المتابعة.")
                                : tr("Consultation ajoutée !", "Visit added!", "تمت إضافة الاستشارة!"),
                              'success'
                            );
                          } catch (err: unknown) { showNotice((err as Error).message, 'error'); }
                          setVisitLoading(false);
                        }} className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-lg shadow-emerald-200 dark:shadow-none disabled:opacity-60">
                          {visitLoading ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <VisitPrescriptionModal
                isOpen={Boolean(prescriptionModalVisit && selectedDossier)}
                isSaving={isPrescriptionSaving}
                draftResetKey={prescriptionModalVisit ? `visit-${prescriptionModalVisit.id}` : "visit-closed"}
                prescription={prescriptionModalVisit ? (prescriptionsByVisitId[prescriptionModalVisit.id] ?? null) : null}
                publicUrl={prescriptionModalVisit ? getPublicPrescriptionUrl(prescriptionsByVisitId[prescriptionModalVisit.id]?.public_token) : null}
                buildPublicUrl={getPublicPrescriptionUrl}
                defaultPatientName={selectedDossier ? `${selectedDossier.first_name} ${selectedDossier.last_name}`.trim() : ""}
                defaultPatientRegistrationNumber={selectedDossier?.patient_registration_number ?? ""}
                defaultDoctorName={profile?.full_name ?? fullName ?? ""}
                defaultDoctorSpecialty={profile?.specialty ?? specialty ?? ""}
                defaultDoctorAddress={profile?.address ?? address ?? ""}
                defaultDoctorPhone={profile?.contact_phone ?? ""}
                defaultDate={prescriptionModalVisit?.visit_date ?? new Date().toISOString().split("T")[0]}
                onClose={() => setPrescriptionModalVisit(null)}
                onSave={saveVisitPrescription}
                onNotify={(message, type = "info") => showNotice(message, type)}
              />

              {/* HEADER */}
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><ClipboardList className="text-blue-500" size={26} /> {t("dashboard.doctor.patients.title")}</h1>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{dossiers.length} {t("dashboard.doctor.patients.registered")}</p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900 sm:w-auto sm:rounded-full">
                    <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {tr("Tri", "Sort", "الترتيب")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDossiersSortOrder("desc")}
                      className={getSortButtonClasses(dossiersSortOrder === "desc")}
                    >
                      {tr("Ajouts récents", "Recent additions", "أحدث الإضافات")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossiersSortOrder("asc")}
                      className={getSortButtonClasses(dossiersSortOrder === "asc")}
                    >
                      {tr("Ajouts anciens", "Oldest additions", "أقدم الإضافات")}
                    </button>
                  </div>
                  <button onClick={openEmptyDossierModal} className="flex min-h-[48px] w-full items-center justify-center gap-2 bg-blue-600 px-5 py-3 font-bold text-white rounded-2xl transition hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none sm:w-auto">
                    <Plus size={18} /> {t("dashboard.doctor.patients.newDossier")}
                  </button>
                </div>
              </div>

              {/* MAIN LAYOUT: LIST + DETAIL */}
              <div className="grid gap-6 xl:grid-cols-3">

                {/* LEFT: Liste des dossiers */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={dossierSearch} onChange={e => setDossierSearch(e.target.value)} placeholder={t("dashboard.doctor.patients.search")} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto" onClick={() => { /* load dossiers on mount */ }}>
                    {filteredDossiers.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                        <UserCircle size={40} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">{t("dashboard.doctor.patients.noDossier")}</p>
                        {dossiers.length === 0 && <p className="text-xs mt-1">{t("dashboard.doctor.patients.clickToCreate")}</p>}
                      </div>
                    ) : (
                      filteredDossiers.map(dossier => (
                        <button key={dossier.id} onClick={() => { void loadDossierDetails(dossier); }} className={`w-full text-left px-4 py-4 flex items-start sm:items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition group ${selectedDossier?.id === dossier.id ? 'bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-600' : ''}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${dossier.gender === 'Femme' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                            {dossier.first_name[0]}{dossier.last_name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{dossier.first_name} {dossier.last_name}</p>
                            {formatPatientRegistrationNumber(dossier.patient_registration_number) ? (
                              <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 font-mono tracking-[0.18em] truncate">
                                ID {formatPatientRegistrationNumber(dossier.patient_registration_number)}
                              </p>
                            ) : null}
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{dossier.phone ?? dossier.email ?? 'Aucun contact'}</p>
                          </div>
                          <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 shrink-0 group-hover:text-blue-500 transition" />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* RIGHT: Détail du dossier */}
                <div className="lg:col-span-2">
                  {!selectedDossier ? (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center flex flex-col items-center justify-center min-h-[400px] shadow-sm">
                      <ClipboardList size={56} className="text-slate-200 dark:text-slate-700 mb-4" />
                      <p className="text-slate-500 dark:text-slate-400 font-medium">{t("dashboard.doctor.patients.selectDossier")}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Fiche patient */}
                      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
                        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-4">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold ${selectedDossier.gender === 'Femme' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
                              {selectedDossier.first_name[0]}{selectedDossier.last_name[0]}
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedDossier.first_name} {selectedDossier.last_name}</h2>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {formatPatientRegistrationNumber(selectedDossier.patient_registration_number) ? (
                                  <span className="text-xs font-black px-3 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-mono tracking-[0.22em]">
                                    ID {formatPatientRegistrationNumber(selectedDossier.patient_registration_number)}
                                  </span>
                                ) : null}
                                {selectedDossier.gender && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{selectedDossier.gender}</span>}
                                {selectedDossier.blood_type && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">🩸 {selectedDossier.blood_type}</span>}
                                {selectedDossier.date_of_birth && <span className="text-xs text-slate-500 dark:text-slate-400">Né(e) le {new Date(selectedDossier.date_of_birth).toLocaleDateString('fr-FR')}</span>}
                              </div>
                            </div>
                          </div>
                          <button onClick={async () => {
                            if (!confirm('Supprimer définitivement ce dossier ?')) return;
                            const { error } = await supabase.from('medical_dossiers').delete().eq('id', selectedDossier.id);
                            if (!error) {
                              setDossiers(prev => prev.filter(d => d.id !== selectedDossier.id));
                              setSelectedDossier(null);
                              setDossierVisits([]);
                              setDossierAppointmentHistory([]);
                              showNotice('Dossier supprimé.', 'info');
                            }
                          }} className="self-start p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 transition sm:self-auto">
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                          {selectedDossier.phone && <div className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300"><Phone size={14} className="shrink-0 text-slate-400" /><span className="break-all">{selectedDossier.phone}</span></div>}
                          {selectedDossier.email && <div className="col-span-1 flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300 sm:col-span-2 xl:col-span-1"><FileText size={14} className="shrink-0 text-slate-400" /><span className="break-all">{selectedDossier.email}</span></div>}
                          {selectedDossier.allergies && <div className="col-span-1 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-3 py-2 rounded-xl border border-amber-100 dark:border-amber-900/50 sm:col-span-2 xl:col-span-3">⚠️ Allergies: {selectedDossier.allergies}</div>}
                          {selectedDossier.chronic_conditions && <div className="col-span-1 text-xs bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 px-3 py-2 rounded-xl border border-purple-100 dark:border-purple-900/50 sm:col-span-2 xl:col-span-3"><Stethoscope size={12} className="inline mr-1" />Chroniques: {selectedDossier.chronic_conditions}</div>}
                        </div>
                      </div>

                      {/* Remarques générales */}
                      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="font-bold text-slate-900 dark:text-white">Remarques Générales</h3>
                          <button onClick={() => { if (editingGeneralRemarks) { setEditingGeneralRemarks(false); } else { setGeneralRemarksEdit(selectedDossier.general_remarks ?? ''); setEditingGeneralRemarks(true); } }} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"><Pencil size={12} />{editingGeneralRemarks ? 'Annuler' : 'Modifier'}</button>
                        </div>
                        {editingGeneralRemarks ? (
                          <div className="space-y-3">
                            <textarea value={generalRemarksEdit} onChange={e => setGeneralRemarksEdit(e.target.value)} rows={4} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm" placeholder="Observations générales sur ce patient..." />
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {isAutoSavingGeneralRemarks
                                ? tr("Sauvegarde automatique en cours...", "Auto-saving...", "جارٍ الحفظ التلقائي...")
                                : tr("Sauvegarde automatique active.", "Auto-save is active.", "الحفظ التلقائي مفعّل.")}
                            </p>
                          </div>
                        ) : (
                          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{selectedDossier.general_remarks || <span className="italic text-slate-400">Aucune remarque générale.</span>}</p>
                        )}
                      </div>

                      {/* Historique des rendez-vous */}
                      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <Clock size={18} className="text-blue-500" />
                              {tr("Historique des rendez-vous", "Appointment history", "سجل المواعيد")} ({dossierAppointmentHistory.length})
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {chronologicalDossierAppointmentHistory.length > 0
                                ? tr(
                                    `Depuis le ${new Date(chronologicalDossierAppointmentHistory[0].appointment_date).toLocaleDateString(locale)}`,
                                    `Since ${new Date(chronologicalDossierAppointmentHistory[0].appointment_date).toLocaleDateString(locale)}`,
                                    `ابتداءً من ${new Date(chronologicalDossierAppointmentHistory[0].appointment_date).toLocaleDateString(locale)}`
                                  )
                                : tr("Toutes les réservations du patient avec vous apparaissent ici.", "All bookings between you and this patient appear here.", "تظهر هنا كل حجوزات هذا المريض معك.")}
                            </p>
                          </div>
                          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                            <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900 sm:w-auto sm:rounded-full">
                              <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                {tr("Tri", "Sort", "الترتيب")}
                              </span>
                              <button
                                type="button"
                                onClick={() => setDossierHistorySortOrder("desc")}
                                className={getSortButtonClasses(dossierHistorySortOrder === "desc")}
                              >
                                {tr("Ajouts récents", "Recent additions", "أحدث الإضافات")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDossierHistorySortOrder("asc")}
                                className={getSortButtonClasses(dossierHistorySortOrder === "asc")}
                              >
                                {tr("Ajouts anciens", "Oldest additions", "أقدم الإضافات")}
                              </button>
                            </div>
                            {selectedDossier.patient_id ? (
                              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                                {tr("Compte patient lié", "Linked patient account", "حساب المريض مرتبط")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                {tr("Dossier manuel non lié", "Manual unlinked record", "ملف يدوي غير مرتبط")}
                              </span>
                            )}
                          </div>
                        </div>

                        {dossierDetailsLoading ? (
                          <div className="py-8 flex justify-center">
                            <RefreshCw size={20} className="animate-spin text-slate-400" />
                          </div>
                        ) : !selectedDossier.patient_id ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            {tr(
                              "Ce dossier a été créé manuellement. Pour afficher l'historique automatique des rendez-vous, créez le dossier directement depuis un rendez-vous du patient.",
                              "This record was created manually. To display automatic appointment history, create the record directly from a patient appointment.",
                              "تم إنشاء هذا الملف يدوياً. لإظهار السجل التلقائي للمواعيد، أنشئ الملف مباشرة من موعد المريض."
                            )}
                          </div>
                        ) : dossierAppointmentHistory.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            {tr("Aucun rendez-vous trouvé pour ce patient avec ce médecin.", "No appointments found for this patient with this doctor.", "لم يتم العثور على مواعيد لهذا المريض مع هذا الطبيب.")}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {sortedDossierAppointmentHistory.map((appointment) => {
                              const chronologicalIndex = chronologicalDossierAppointmentHistory.findIndex((entry) => entry.id === appointment.id);
                              return (
                              <div key={appointment.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                      {chronologicalIndex === 0
                                        ? tr("Premier rendez-vous", "First appointment", "أول موعد")
                                        : tr(
                                            `Rendez-vous #${chronologicalIndex + 1}`,
                                            `Appointment #${chronologicalIndex + 1}`,
                                            `الموعد رقم ${chronologicalIndex + 1}`
                                          )}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                                      {getAppointmentDisplayLabel(appointment)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                      {getBookingModeLabel(appointment.booking_selection_mode)}
                                    </p>
                                  </div>
                                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border ${
                                    appointment.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' :
                                    appointment.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' :
                                    appointment.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' :
                                    'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                  }`}>
                                    {(() => {
                                      const statusKey = `dashboard.doctor.appt.status.${appointment.status}` as const;
                                      return t(statusKey) || appointment.status;
                                    })()}
                                  </span>
                                </div>
                              </div>
                            )})}
                          </div>
                        )}
                      </div>

                      {/* Historique des consultations */}
                      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Activity size={18} className="text-emerald-500" /> Consultations ({dossierVisits.length})</h3>
                          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                            <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900 sm:w-auto sm:rounded-full">
                              <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                {tr("Tri", "Sort", "الترتيب")}
                              </span>
                              <button
                                type="button"
                                onClick={() => setDossierHistorySortOrder("desc")}
                                className={getSortButtonClasses(dossierHistorySortOrder === "desc")}
                              >
                                {tr("Ajouts récents", "Recent additions", "أحدث الإضافات")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDossierHistorySortOrder("asc")}
                                className={getSortButtonClasses(dossierHistorySortOrder === "asc")}
                              >
                                {tr("Ajouts anciens", "Oldest additions", "أقدم الإضافات")}
                              </button>
                            </div>
                            <button onClick={() => { setNewVisitForm(createEmptyVisitForm()); setShowNewVisitModal(true); }} className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-600 transition hover:text-emerald-700 dark:bg-emerald-950/30 sm:w-auto">
                              <Plus size={14} /> Ajouter
                            </button>
                          </div>
                        </div>
                        {dossierVisits.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                            <Activity size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Aucune consultation enregistrée</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {sortedDossierVisits.map(visit => {
                              const linkedFollowUpAppointment = followUpAppointmentsByVisitId[visit.id] ?? null;
                              const linkedPrescription = prescriptionsByVisitId[visit.id] ?? null;
                              return (
                              <div key={visit.id} className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                                <div className="flex items-start gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition sm:items-center">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedVisitId(expandedVisitId === visit.id ? null : visit.id)}
                                    className="flex flex-1 flex-col items-start gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                                        <CalendarIcon size={16} className="text-emerald-500" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{new Date(visit.visit_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">{visit.reason ?? 'Consultation générale'}</p>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {visit.follow_up_date && <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">Suivi: {new Date(visit.follow_up_date).toLocaleDateString('fr-FR')}</span>}
                                      {linkedPrescription ? (
                                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full">
                                          {tr(
                                            `Ordonnance #${linkedPrescription.prescription_number}`,
                                            `Prescription #${linkedPrescription.prescription_number}`,
                                            `الوصفة رقم ${linkedPrescription.prescription_number}`
                                          )}
                                        </span>
                                      ) : null}
                                      {linkedFollowUpAppointment ? (
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                          linkedFollowUpAppointment.follow_up_time_pending
                                            ? "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30"
                                            : "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
                                        }`}>
                                          {linkedFollowUpAppointment.follow_up_time_pending
                                            ? tr("RDV de contrôle à finaliser", "Follow-up time pending", "موعد متابعة بانتظار تحديد الساعة")
                                            : tr("RDV de contrôle programmé", "Follow-up appointment scheduled", "تمت برمجة موعد المتابعة")}
                                        </span>
                                      ) : null}
                                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${expandedVisitId === visit.id ? 'rotate-180' : ''}`} />
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!confirm('Supprimer cette consultation ?')) return;
                                      await supabase.from('dossier_visits').delete().eq('id', visit.id);
                                      setDossierVisits(prev => prev.filter(v => v.id !== visit.id));
                                      setPrescriptionsByVisitId(prev => {
                                        const next = { ...prev };
                                        delete next[visit.id];
                                        return next;
                                      });
                                      if (prescriptionModalVisit?.id === visit.id) {
                                        setPrescriptionModalVisit(null);
                                      }
                                      showNotice('Consultation supprimée.', 'info');
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-300 hover:text-red-400 transition"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                <AnimatePresence>
                                  {expandedVisitId === visit.id && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                      <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                                        {linkedFollowUpAppointment ? (
                                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                              <div>
                                                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300 mb-1">
                                                  {tr("Suivi programmé dans les rendez-vous du patient", "Follow-up created in the patient's appointments", "تمت برمجة المتابعة داخل مواعيد المريض")}
                                                </p>
                                                <p className="text-sm text-slate-700 dark:text-slate-200">
                                                  {getAppointmentDisplayLabel(linkedFollowUpAppointment)}
                                                </p>
                                              </div>
                                              {linkedFollowUpAppointment.follow_up_time_pending ? (
                                                <button
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    openScheduleModal(linkedFollowUpAppointment);
                                                  }}
                                                  className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700"
                                                >
                                                  {tr("Fixer l'heure", "Set the time", "تحديد الساعة")}
                                                </button>
                                              ) : null}
                                            </div>
                                          </div>
                                        ) : null}
                                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                                                {tr("Ordonnance de la visite", "Visit prescription", "وصفة هذه الزيارة")}
                                              </p>
                                              <p className="text-sm text-slate-700 dark:text-slate-200">
                                                {linkedPrescription
                                                  ? tr(
                                                      `Ordonnance n° ${linkedPrescription.prescription_number} prête à être imprimée.`,
                                                      `Prescription no. ${linkedPrescription.prescription_number} is ready to print.`,
                                                      `الوصفة رقم ${linkedPrescription.prescription_number} جاهزة للطباعة.`
                                                    )
                                                  : tr(
                                                      "Aucune ordonnance enregistrée pour cette consultation pour le moment.",
                                                      "No prescription has been saved for this visit yet.",
                                                      "لا توجد وصفة محفوظة لهذه الاستشارة حتى الآن."
                                                    )}
                                              </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => setPrescriptionModalVisit(visit)}
                                                className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                                              >
                                                {linkedPrescription
                                                  ? tr("Voir / modifier", "View / edit", "عرض / تعديل")
                                                  : tr("Créer l'ordonnance", "Create prescription", "إنشاء الوصفة")}
                                              </button>
                                              {linkedPrescription ? (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const publicUrl = getPublicPrescriptionUrl(linkedPrescription.public_token);
                                                    if (!publicUrl) {
                                                      showNotice(
                                                        tr(
                                                          "Le lien public de l'ordonnance est indisponible pour le moment.",
                                                          "The public prescription link is unavailable right now.",
                                                          "رابط الوصفة العام غير متاح حالياً."
                                                        ),
                                                        "error"
                                                      );
                                                      return;
                                                    }

                                                    window.open(`${publicUrl}?print=1`, "_blank", "noopener,noreferrer");
                                                  }}
                                                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
                                                >
                                                  {tr("Imprimer", "Print", "طباعة")}
                                                </button>
                                              ) : null}
                                            </div>
                                          </div>
                                        </div>
                                        {visit.diagnosis && <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3"><p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">Diagnostic</p><p className="text-sm text-slate-700 dark:text-slate-300">{visit.diagnosis}</p></div>}
                                        {visit.treatment && <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3"><p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">Traitement</p><p className="text-sm text-slate-700 dark:text-slate-300">{visit.treatment}</p></div>}
                                        {visit.doctor_notes && <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3"><p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">🔒 Notes du médecin (privé)</p><p className="text-sm text-slate-700 dark:text-slate-300">{visit.doctor_notes}</p></div>}
                                        {!visit.diagnosis && !visit.treatment && !visit.doctor_notes && <p className="text-sm text-slate-400 italic">Aucun détail ajouté pour cette consultation.</p>}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )})}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: AI ASSISTANT — rendered above via fixed overlay, nothing here */}

          {/* TAB: PROFILE */}
          {activeTab === "profile" && (
            <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pb-10">
              <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
                {/* BLOC 1 : PROFIL PUBLIC */}
                <div className="bg-white dark:bg-slate-950 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm h-fit">
                   <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2"><Settings className="text-blue-600"/> {tr("Infos Profil", "Profile Info", "معلومات الملف")}</h2>
                   <div className="space-y-4">
                     <div>
                       <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("common.fullName")}</label>
                       <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 outline-none mt-2 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500" placeholder={tr("Votre nom complet", "Your full name", "اسمك الكامل")} />
                     </div>
                     <div>
                       <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{tr("Photo de profil", "Profile photo", "صورة الملف الشخصي")}</label>
                       <div className="mt-2 flex flex-wrap items-center gap-3">
                         <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                           <Upload size={16} />
                           {isUploadingAvatar ? tr("Téléversement...", "Uploading...", "جارٍ الرفع...") : tr("Téléverser une photo", "Upload photo", "رفع صورة")}
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
                         {avatarUrl ? (
                           <button
                             type="button"
                             onClick={() => setAvatarUrl("")}
                             className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                           >
                             {tr("Supprimer la photo", "Remove photo", "حذف الصورة")}
                           </button>
                         ) : null}
                       </div>
                       <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                         {tr("Formats acceptés: JPG, PNG, WebP (max 5 MB).", "Accepted formats: JPG, PNG, WebP (max 5 MB).", "الصيغ المقبولة: JPG وPNG وWebP (الحد الأقصى 5 MB).")}
                       </p>
                       {avatarUrl ? (
                         <div className="mt-3 flex items-center gap-3">
                           <img src={avatarUrl} alt={tr("Aperçu profil", "Profile preview", "معاينة الملف")} className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                           <span className="text-xs text-slate-500 dark:text-slate-400">{tr("Aperçu de la photo", "Photo preview", "معاينة الصورة")}</span>
                         </div>
                       ) : null}
                     </div>
                     <div>
                       <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{tr("Adresse de consultation", "Practice address", "عنوان العيادة")}</label>
                       <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                         <input
                           type="text"
                           value={address}
                           onChange={e => setAddress(e.target.value)}
                           className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 outline-none text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500"
                           placeholder={tr("Ex: Chéraga, Alger", "Ex: Cheraga, Algiers", "مثال: الشراقة، الجزائر")}
                         />
                         <button
                           type="button"
                           onClick={() => {
                             void handleUseCurrentLocation();
                           }}
                           disabled={isResolvingLocation}
                           className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/40 sm:min-w-[190px] sm:w-auto"
                         >
                           <Crosshair size={16} className={isResolvingLocation ? "animate-pulse" : ""} />
                           {isResolvingLocation
                             ? tr("Localisation en cours...", "Detecting location...", "جارٍ تحديد الموقع...")
                             : tr("Utiliser mon GPS", "Use my GPS", "استخدام GPS الخاص بي")}
                         </button>
                       </div>
                       <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                         {latitude != null && longitude != null
                           ? tr(
                               `Coordonnées cabinet: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}${locationAccuracy != null ? ` · précision ~${Math.round(locationAccuracy)} m` : ""}`,
                               `Practice coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}${locationAccuracy != null ? ` · accuracy ~${Math.round(locationAccuracy)} m` : ""}`,
                               `إحداثيات العيادة: ${latitude.toFixed(5)}، ${longitude.toFixed(5)}${locationAccuracy != null ? ` · الدقة حوالي ${Math.round(locationAccuracy)} م` : ""}`
                             )
                           : tr(
                               "Le bouton GPS renseigne une position exacte pour les patients sur la carte.",
                               "The GPS button saves an exact position for patients on the map.",
                               "زر GPS يحفظ موقعاً دقيقاً للمرضى على الخريطة."
                             )}
                       </p>
                     </div>
                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                       <div>
                         <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{tr("Spécialité", "Specialty", "التخصص")}</label>
                         <input type="text" value={specialty} onChange={e => setSpecialty(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 outline-none mt-2 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500" placeholder={tr("Ex: Cardiologue", "Ex: Cardiologist", "مثال: طبيب قلب")} />
                       </div>
                       <div>
                         <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{tr("Sexe (Genre)", "Sex (Gender)", "الجنس")}</label>
                         <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 outline-none mt-2 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500">
                            <option value="">{tr("Non précisé", "Not specified", "غير محدد")}</option>
                            <option value="Homme">{tr("Homme", "Male", "ذكر")}</option>
                            <option value="Femme">{tr("Femme", "Female", "أنثى")}</option>
                         </select>
                       </div>
                     </div>
                     <div>
                       <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{tr("Biographie", "Biography", "نبذة تعريفية")}</label>
                       <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 outline-none mt-2 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 h-24 resize-none" placeholder={tr("Décrivez votre parcours...", "Describe your background...", "اكتب نبذة عن مسارك المهني...")}></textarea>
                     </div>
                       <div>
                       <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{tr("Lien de la cabine (Google Maps)", "Practice link (Google Maps)", "رابط العيادة (Google Maps)")}</label>
                         <input 
                           type="text" 
                           value={googleMapsLink || ""} 
                           onChange={e => setGoogleMapsLink(e.target.value)} 
                           className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 outline-none mt-2 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500" 
                           placeholder={tr("Ex: https://maps.app.goo.gl/...", "Ex: https://maps.app.goo.gl/...", "مثال: https://maps.app.goo.gl/...")} 
                         />
                         <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 italic">{tr("Ce lien sera utilisé pour le bouton \"Itinéraire\" côté patient.", "This link will be used for the patient \"Directions\" button.", "سيتم استخدام هذا الرابط لزر \"الاتجاهات\" لدى المريض.")}</p>
                       </div>
                     <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4">
                       <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                         <div>
                           <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                             {tr("Coordonnées publiques & réseaux", "Public contact details & social links", "بيانات التواصل العامة وروابط الشبكات")}
                           </label>
                           <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                             {tr(
                               "Activez seulement les canaux que vous voulez montrer aux patients et dans les propositions AI.",
                               "Enable only the channels you want patients and AI suggestions to display.",
                               "فعّل فقط القنوات التي تريد إظهارها للمرضى وداخل اقتراحات الذكاء الاصطناعي."
                             )}
                           </p>
                         </div>
                         <div className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500 shadow-sm dark:bg-slate-950 dark:text-slate-400">
                           {tr("Aperçu public", "Public preview", "معاينة عامة")}
                         </div>
                       </div>

                       <div className="mt-4 grid gap-3">
                         {DOCTOR_CONTACT_INPUTS.map((field) => {
                           const value = contactSettings[field.valueKey];
                           const isEnabled = contactSettings[field.enabledKey];
                           const hasValue = value.trim().length > 0;

                           return (
                             <div
                               key={field.channel}
                               className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
                             >
                               <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                 <div>
                                   <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                     {tr(field.label.fr, field.label.en, field.label.ar)}
                                   </p>
                                   <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                     {tr(field.hint.fr, field.hint.en, field.hint.ar)}
                                   </p>
                                 </div>
                                 <button
                                   type="button"
                                   onClick={() => toggleContactVisibility(field.valueKey, field.enabledKey)}
                                   disabled={!hasValue}
                                   className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-bold transition ${
                                     isEnabled
                                       ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                       : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                   } ${!hasValue ? "cursor-not-allowed opacity-60" : ""}`}
                                 >
                                   <Eye size={13} className="me-1.5" />
                                   {isEnabled
                                     ? tr("Visible", "Visible", "ظاهر")
                                     : tr("Masqué", "Hidden", "مخفي")}
                                 </button>
                               </div>
                               <input
                                 type={field.inputMode === "email" ? "email" : field.inputMode === "tel" ? "tel" : "text"}
                                 inputMode={field.inputMode}
                                 dir={field.inputMode === "email" || field.inputMode === "tel" ? "ltr" : undefined}
                                 value={value}
                                 onChange={(event) => updateContactValue(field.valueKey, field.enabledKey, event.target.value)}
                                 className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-800 outline-none transition focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                 placeholder={tr(field.placeholder.fr, field.placeholder.en, field.placeholder.ar)}
                               />
                             </div>
                           );
                         })}
                       </div>

                       <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/80">
                         <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                           {tr("Ce que le patient verra", "What patients will see", "ما سيراه المريض")}
                         </p>
                         <DoctorPublicLinks doctor={publicContactSettings} variant="detailed" />
                         {Object.values(publicContactSettings).every((entry) =>
                           typeof entry === "boolean" ? !entry : entry.trim().length === 0
                         ) ? (
                           <p className="text-sm text-slate-500 dark:text-slate-400">
                             {tr(
                               "Aucun canal actif pour le moment. Renseignez un lien puis activez sa visibilité.",
                               "No active channel yet. Fill a field, then enable its visibility.",
                               "لا توجد قناة مفعلة حالياً. أدخل رابطاً أو وسيلة تواصل ثم فعّل ظهورها."
                             )}
                           </p>
                         ) : null}
                       </div>
                     </div>
                    </div>
                 </div>

                {/* BLOC 2 : PARAMS RDV & LISTE ATTENTE (LES NOUVELLES OPTIONS) */}
                <div className="bg-white dark:bg-slate-950 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm h-fit">
                   <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2"><Clock className="text-emerald-600"/> {t("dashboard.doctor.bookingSettings")}</h2>
                   <div className="space-y-6">

                     {/* Activation / Désactivation Global */}
                     <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between">
                       <div>
                         <p className="font-bold text-slate-900 dark:text-slate-100">{tr("Activer les Rendez-vous", "Enable appointments", "تفعيل المواعيد")}</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs transition-colors">{tr("Si désactivé, vous restez visible sur la carte mais aucun patient ne peut réserver.", "If disabled, you stay visible on the map but no patient can book.", "إذا تم تعطيله فستبقى ظاهراً على الخريطة لكن لن يتمكن أي مريض من الحجز.")}</p>
                       </div>
                       <label className="relative inline-flex items-center cursor-pointer">
                         <input type="checkbox" className="sr-only peer" checked={isAccepting} onChange={(e) => setIsAccepting(e.target.checked)}/>
                         <div className="w-14 h-7 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                       </label>
                     </div>

                     <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                       <p className="font-bold text-slate-900 dark:text-slate-100">{tr("Mode de prise de rendez-vous", "Booking mode", "وضع حجز الموعد")}</p>
                       <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                         {tr("Choisissez qui décide la date/heure finale.", "Choose who decides the final date/time.", "اختر من يحدد التاريخ والوقت النهائيين.")}
                       </p>
                       <div className="grid gap-2 sm:grid-cols-3">
                         <button
                           type="button"
                           onClick={() => setBookingMode("patient_datetime")}
                           className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                             bookingMode === "patient_datetime"
                               ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                               : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                           }`}
                        >
                           {tr("Patient choisit date + heure", "Patient chooses date + time", "المريض يختار التاريخ والوقت")}
                        </button>
                         <button
                           type="button"
                           onClick={() => setBookingMode("patient_date_only")}
                           className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                             bookingMode === "patient_date_only"
                               ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                               : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                           }`}
                        >
                           {tr("Patient choisit date, docteur heure", "Patient chooses date, doctor chooses time", "المريض يختار التاريخ والطبيب يختار الوقت")}
                        </button>
                         <button
                           type="button"
                           onClick={() => setBookingMode("doctor_datetime")}
                           className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                             bookingMode === "doctor_datetime"
                               ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                               : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                           }`}
                        >
                           {tr("Docteur choisit date + heure", "Doctor chooses date + time", "الطبيب يختار التاريخ والوقت")}
                        </button>
                      </div>
                    </div>

                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                       <div>
                         <label className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-1">{tr("Période par RDV (min)", "Duration per appointment (min)", "مدة الموعد (دقيقة)")}</label>
                         <input type="number" min="5" step="5" value={durationParams} onChange={e => setDurationParams(parseInt(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
                       </div>
                       <div>
                         <label className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-1">{tr("Quota Journalier", "Daily quota", "الحصة اليومية")}</label>
                         <div className="flex flex-col gap-2">
                           <div className="flex items-center gap-2">
                              <button 
                               onClick={() => setIsUnlimited(!isUnlimited)}
                               className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isUnlimited ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                              >
                                {isUnlimited ? `✅ ${tr("Illimité", "Unlimited", "غير محدود")}` : `🔢 ${tr("Limiter", "Set limit", "تحديد حد")}`}
                              </button>
                              {!isUnlimited && (
                                <input type="number" min="1" placeholder={tr("Ex: 10", "Ex: 10", "مثال: 10")} value={maxAppointments} onChange={e => setMaxAppointments(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
                              )}
                           </div>
                         </div>
                       </div>
                     </div>

                     <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                       <p className="font-bold text-slate-900 dark:text-slate-100 mb-2">🕒 {tr("Horaires d'Ouverture", "Opening hours", "ساعات العمل")}</p>
                       <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{tr("Définissez vos heures globales de travail. Les patients ne pourront pas réserver en dehors de ces heures de façon automatique.", "Set your general working hours. Patients will not be able to book automatically outside these hours.", "حدد ساعات عملك العامة. لن يتمكن المرضى من الحجز تلقائياً خارج هذه الساعات.")}</p>
                       <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                         <div>
                           <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">{tr("Heure d'ouverture", "Opening time", "وقت البداية")}</label>
                           <div className="relative">
                             <Clock className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                             <input type="time" value={workingHoursStart} onChange={e => setWorkingHoursStart(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pe-4 ps-10 font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                           </div>
                         </div>
                         <div>
                           <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">{tr("Heure de fin", "Closing time", "وقت النهاية")}</label>
                           <div className="relative">
                             <Clock className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                             <input type="time" value={workingHoursEnd} onChange={e => setWorkingHoursEnd(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pe-4 ps-10 font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                           </div>
                         </div>
                       </div>
                     </div>

                     <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                       <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">🏖️ {tr("Mode Vacances", "Vacation mode", "وضع العطلة")}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0">{tr("Indiquez si vous êtes en congé actuellement.", "Indicate whether you are currently on leave.", "حدد ما إذا كنت في عطلة حالياً.")}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                             <input type="checkbox" className="sr-only peer" checked={isOnVacation} onChange={(e) => setIsOnVacation(e.target.checked)}/>
                             <div className="w-12 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                          </label>
                       </div>
                       <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                         <div>
                           <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">{tr("Date de début", "Start date", "تاريخ البداية")}</label>
                           <input type="date" value={vacationStart} onChange={e => setVacationStart(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500" />
                         </div>
                         <div>
                           <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">{tr("Date de fin", "End date", "تاريخ النهاية")}</label>
                           <input type="date" value={vacationEnd} onChange={e => setVacationEnd(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500" />
                         </div>
                       </div>
                       <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                         {tr("Le mode vacances bloque immédiatement les prises de rendez-vous. Les dates sont optionnelles et servent surtout d'information pour les patients.", "Vacation mode blocks new bookings immediately. Dates are optional and mainly inform patients.", "وضع العطلة يوقف الحجوزات الجديدة فوراً. التواريخ اختيارية وتستخدم أساساً لإعلام المرضى.")}
                       </p>
                     </div>

                     <p className="text-xs text-slate-500 dark:text-slate-400">
                       {isAutoSavingSettings ? tr("Sauvegarde automatique...", "Auto-saving...", "حفظ تلقائي...") : tr("Sauvegarde automatique activée.", "Auto-save enabled.", "الحفظ التلقائي مفعّل.")}
                     </p>
                     <button onClick={handleSaveSettings} disabled={isUpdatingParams} className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 transition flex justify-center items-center disabled:opacity-60">
                       {isUpdatingParams ? tr("Sauvegarde...", "Saving...", "جارٍ الحفظ...") : `💾 ${tr("Enregistrer les Modifications", "Save changes", "حفظ التعديلات")}`}
                     </button>
                   </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
      </div>

      <AnimatePresence>
        {notice ? (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className={`fixed top-5 z-[90] max-w-sm rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ltr:right-5 rtl:left-5 ${
              notice.type === "error"
                ? "border-rose-200 bg-rose-50/95 text-rose-700 dark:border-rose-800 dark:bg-rose-900/80 dark:text-rose-200"
                : notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50/95 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200"
                  : "border-blue-200 bg-blue-50/95 text-blue-700 dark:border-blue-800 dark:bg-blue-900/80 dark:text-blue-200"
            }`}
          >
            <p className="text-sm font-semibold leading-snug">{notice.message}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {appointmentToSchedule ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                {appointmentToSchedule.follow_up_time_pending
                  ? tr("Fixer l'heure du contrôle", "Set the follow-up time", "تحديد ساعة المتابعة")
                  : tr("Planifier le rendez-vous", "Schedule the appointment", "جدولة الموعد")}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
                {appointmentToSchedule.appointment_source === "doctor_follow_up"
                  ? tr(
                      `Patient: ${appointmentToSchedule.patient?.full_name ?? "Patient"}. Ce contrôle a déjà été ajouté dans son dashboard.`,
                      `Patient: ${appointmentToSchedule.patient?.full_name ?? "Patient"}. This follow-up already appears in the patient's dashboard.`,
                      `المريض: ${appointmentToSchedule.patient?.full_name ?? "المريض"}. هذه المتابعة تظهر بالفعل في لوحة تحكم المريض.`
                    )
                  : tr(
                      `Patient: ${appointmentToSchedule.patient?.full_name ?? "Patient"}.`,
                      `Patient: ${appointmentToSchedule.patient?.full_name ?? "Patient"}.`,
                      `المريض: ${appointmentToSchedule.patient?.full_name ?? "المريض"}.`
                    )}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(event) => setScheduledDate(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Heure</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(event) => setScheduledTime(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={closeScheduleModal}
                  className="w-1/3 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={() => void scheduleAndConfirmAppointment()}
                  disabled={isSchedulingAppointment}
                  className="w-2/3 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {isSchedulingAppointment ? "Validation..." : "Planifier et confirmer"}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selectedCommunityDoctorDetails ? (
          <DoctorDetailsModal
            doctor={selectedCommunityDoctorDetails}
            onClose={closeCommunityDoctorDetails}
          />
        ) : null}
      </AnimatePresence>
    
      <AnimatePresence>
        {reportTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl w-full max-w-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Signaler</h3>
              <form onSubmit={submitReport}>
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none mb-4 text-sm text-slate-700 dark:text-slate-300">
                  <option value="Contenu inapproprié">Contenu inapproprié</option>
                  <option value="Spam">Spam ou publicité</option>
                  <option value="Désinformation médicale">Désinformation médicale</option>
                </select>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setReportTarget(null)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-medium transition text-sm">Annuler</button>
                  <button type="submit" disabled={isSubmittingReport} className="flex-1 px-4 py-2 bg-rose-600 text-white hover:bg-rose-700 rounded-xl font-medium transition disabled:bg-rose-400 text-sm">
                    {isSubmittingReport ? "Envoi..." : "Signaler"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

</div>
  );
}
// made by larabi
