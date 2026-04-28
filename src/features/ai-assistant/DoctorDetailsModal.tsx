"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Calendar, Clock, ExternalLink, MapPin, Star, X } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { clearExpiredVacationFlag, isDoctorOnVacation } from "@/utils/doctorAvailability";
import type { DoctorReviewDetail, RecommendedDoctor } from "./types";
import DoctorPublicLinks from "@/components/DoctorPublicLinks";
import { buildDoctorPublicChannels } from "@/utils/doctorContactChannels";
import { useI18n } from "@/lib/i18n";
import ModalScrollRail from "@/components/ModalScrollRail";

type Props = {
  doctor: RecommendedDoctor;
  onClose: () => void;
  onBook?: (doctor: RecommendedDoctor) => void;
};

function renderStars(value: number, size = 13) {
  const roundedValue = Math.round(value);
  return Array.from({ length: 5 }).map((_, index) => (
    <Star
      key={`doctor-rating-star-${index}`}
      size={size}
      className={index < roundedValue ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200 dark:fill-slate-700 dark:text-slate-700"}
    />
  ));
}

export default function DoctorDetailsModal({ doctor, onClose, onBook }: Props) {
  const { language } = useI18n();
  const tr = useCallback(
    (fr: string, en: string, ar: string) => (language === "ar" ? ar : language === "en" ? en : fr),
    [language]
  );
  const locale = language === "ar" ? "ar-DZ" : language === "en" ? "en-US" : "fr-FR";

  const normalizedDoctor = clearExpiredVacationFlag(doctor);
  const [reviews, setReviews] = useState<DoctorReviewDetail[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const doctorUnavailable = !normalizedDoctor.is_accepting_appointments || isDoctorOnVacation(normalizedDoctor);
  const publicChannels = buildDoctorPublicChannels(normalizedDoctor);

  const bookingModeLabel = useMemo(() => {
    if (normalizedDoctor.appointment_booking_mode === "doctor_datetime") {
      return tr("Le médecin fixe date et heure", "Doctor sets date and time", "الطبيب يحدد التاريخ والساعة");
    }
    if (normalizedDoctor.appointment_booking_mode === "patient_date_only") {
      return tr("Patient choisit la date", "Patient chooses the date", "المريض يختار التاريخ");
    }
    return tr("Patient choisit date et heure", "Patient chooses date and time", "المريض يختار التاريخ والساعة");
  }, [normalizedDoctor.appointment_booking_mode, tr]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [normalizedDoctor.avatar_url]);

  useEffect(() => {
    let cancelled = false;

    async function loadReviews() {
      setLoadingReviews(true);
      try {
        const { data } = await supabase
          .from("reviews")
          .select("id, rating, comment, created_at, patient:profiles!patient_id(full_name)")
          .eq("doctor_id", doctor.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (cancelled) return;

        const normalized: DoctorReviewDetail[] = (data ?? []).map((review) => {
          const patientProfile = Array.isArray(review.patient) ? review.patient[0] : review.patient;
          return {
            id: review.id,
            rating: review.rating,
            comment: review.comment ?? null,
            created_at: review.created_at,
            patient_name:
              (patientProfile as { full_name?: string | null } | null)?.full_name ??
              tr("Patient", "Patient", "مريض"),
          };
        });

        setReviews(normalized);
      } finally {
        if (!cancelled) setLoadingReviews(false);
      }
    }

    void loadReviews();
    return () => { cancelled = true; };
  }, [doctor.id, tr]);

  const initials = (normalizedDoctor.full_name ?? "DR").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const modalContent = (
    <div
      className="fixed inset-0 z-[240] flex items-end justify-center overflow-y-auto overscroll-contain bg-[#030814]/72 p-0 sm:items-center sm:p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: "spring", damping: 30, stiffness: 400 }}
        style={{ width: "min(100vw, 560px)" }}
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[92dvh] w-full flex-none flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[24px] dark:bg-[#07142d]"
      >
        {/* ── Hero Header ── */}
        <div className="relative flex-none">
          {/* Gradient banner */}
          <div className="h-24 w-full bg-[#143dbd] bg-gradient-to-br from-[#3672ff] via-[#2057ef] to-[#143dbd]" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/30"
          >
            <X size={16} />
          </button>

          {/* Avatar + name — overlapping the banner */}
          <div className="px-5 pb-4">
            <div className="flex items-center gap-4 -mt-9">
              <div className="relative flex h-[72px] w-[72px] flex-none items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-blue-600 bg-gradient-to-br from-[#3672ff] to-[#1d4fe0] text-xl font-black text-white shadow-lg dark:border-[#07142d] dark:bg-[#12306d]">
                <span className="pointer-events-none select-none">{initials}</span>
                {normalizedDoctor.avatar_url && !avatarLoadFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={normalizedDoctor.avatar_url}
                    alt={normalizedDoctor.full_name || "Doctor"}
                    onError={() => setAvatarLoadFailed(true)}
                    className="absolute inset-0 h-full w-full bg-[#143dbd] object-cover"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 rounded-2xl bg-white/96 px-3 py-2 shadow-[0_14px_28px_-20px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/80 dark:bg-[#0c1c42] dark:ring-[#27509b]">
                <h3 className="truncate text-lg font-black leading-tight tracking-tight text-slate-950 dark:text-white">
                  Dr. {normalizedDoctor.full_name}
                </h3>
                <p className="truncate text-sm font-semibold text-blue-700 dark:text-blue-200">
                  {normalizedDoctor.specialty || tr("Médecin", "Doctor", "طبيب")}
                </p>
              </div>
            </div>

            {/* Badges row */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 dark:bg-amber-500/10">
                <div className="flex items-center gap-0.5">{renderStars(normalizedDoctor.rating)}</div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  {normalizedDoctor.rating > 0 ? normalizedDoctor.rating.toFixed(1) : tr("Nouveau", "New", "جديد")}
                </span>
              </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-[#16377a] dark:text-blue-50">
                {normalizedDoctor.reviews > 0
                  ? tr(`${normalizedDoctor.reviews} avis`, `${normalizedDoctor.reviews} reviews`, `${normalizedDoctor.reviews} تقييم`)
                  : tr("Aucun avis", "No reviews", "لا توجد تقييمات")}
              </span>
              {normalizedDoctor.distanceKm != null && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-[#0d3140] dark:text-emerald-100">
                  📍 {normalizedDoctor.distanceKm.toFixed(1)} km
                </span>
              )}
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${doctorUnavailable ? "bg-rose-50 text-rose-600 dark:bg-[#3b1220] dark:text-rose-200" : "bg-emerald-50 text-emerald-700 dark:bg-[#0d3140] dark:text-emerald-100"}`}>
                {doctorUnavailable
                  ? tr("Indisponible", "Unavailable", "غير متاح")
                  : tr("Disponible", "Available", "متاح")}
              </span>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain ps-16">

          {/* Stats strip */}
          <div className="grid grid-cols-3 border-y border-slate-100 dark:border-[#17386f]">
            <div className="flex flex-col items-center justify-center px-3 py-4 text-center">
              <Clock size={16} className="mb-1.5 text-blue-500" />
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                {normalizedDoctor.appointment_duration_minutes ?? "—"}{normalizedDoctor.appointment_duration_minutes ? " min" : ""}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {tr("Durée", "Duration", "المدة")}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center border-x border-slate-100 px-3 py-4 text-center dark:border-[#17386f]">
              <Calendar size={16} className="mb-1.5 text-blue-500" />
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                {normalizedDoctor.working_hours_start && normalizedDoctor.working_hours_end
                  ? `${normalizedDoctor.working_hours_start} - ${normalizedDoctor.working_hours_end}`
                  : tr("À confirmer", "TBD", "تأكيد لاحق")}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {tr("Horaires", "Schedule", "الجدول")}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center px-3 py-4 text-center">
              <Star size={16} className="mb-1.5 text-blue-500 fill-blue-500" />
              <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight text-center">
                {bookingModeLabel}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {tr("Réservation", "Booking", "الحجز")}
              </p>
            </div>
          </div>

          <div className="space-y-0 divide-y divide-slate-100 px-5 dark:divide-[#17386f]">

            {/* Address */}
            <div className="py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-[#12306d]">
                  <MapPin size={15} className="text-blue-600 dark:text-blue-100" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-blue-200/45">
                    {tr("Adresse du cabinet", "Clinic address", "عنوان العيادة")}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-blue-50/90">
                    {normalizedDoctor.address || tr("Adresse non renseignée", "Address not provided", "العنوان غير متوفر")}
                  </p>
                </div>
              </div>
            </div>

            {/* Public channels */}
            {publicChannels.length > 0 && (
              <div className="py-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-blue-200/45">
                  {tr("Coordonnées de contact", "Contact information", "معلومات الاتصال")}
                </p>
                <DoctorPublicLinks doctor={normalizedDoctor} variant="compact" />
              </div>
            )}

            {/* Vacation notice */}
            {isDoctorOnVacation(normalizedDoctor) && (
              <div className="py-4">
                <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 dark:bg-[#3a2a06]">
                  <span className="text-2xl">🌴</span>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-100">
                    {tr("Ce praticien est actuellement en congé.", "This practitioner is currently on leave.", "الطبيب في إجازة حالياً.")}
                  </p>
                </div>
              </div>
            )}

            {/* Reviews */}
            <div className="py-4">
              <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-blue-200/45">
                  {tr("Avis des patients", "Patient reviews", "آراء المرضى")}
                </p>
                {reviews.length > 0 && (
                  <div className="flex items-center gap-1">
                    {renderStars(normalizedDoctor.rating, 12)}
                    <span className="ms-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                      {normalizedDoctor.rating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              {loadingReviews ? (
                <div className="space-y-3">
                  {[0, 1].map((i) => (
                    <div key={i} className="flex gap-3">
                      <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                        <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-blue-100/55">
                  {tr("Aucun avis pour le moment.", "No reviews yet.", "لا توجد تقييمات حتى الآن.")}
                </p>
              ) : (
                <div className="max-h-48 space-y-4 overflow-y-auto pe-1">
                  {reviews.map((review) => (
                    <article key={review.id}>
                      <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-xs font-black text-blue-700 dark:from-[#12306d] dark:to-[#1f4da8] dark:text-blue-100">
                          {(review.patient_name ?? "P")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-bold text-slate-800 dark:text-white">
                              {review.patient_name}
                            </p>
                            <div className="flex items-center gap-1">
                              {renderStars(review.rating, 11)}
                            </div>
                          </div>
                            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-blue-100/45">
                            {new Date(review.created_at).toLocaleDateString(locale, { month: "long", year: "numeric" })}
                          </p>
                          {review.comment && (
                            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-blue-100/72">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sticky footer CTA ── */}
        <div className="flex-none border-t border-slate-100 bg-white px-5 py-4 dark:border-[#17386f] dark:bg-[#07142d]">
          <div className={`grid gap-3 ${normalizedDoctor.google_maps_link && onBook ? "grid-cols-2" : "grid-cols-1"}`}>
            {normalizedDoctor.google_maps_link && (
              <a
                href={normalizedDoctor.google_maps_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-[#27509b] dark:bg-[#0c1c42] dark:text-blue-50 dark:hover:bg-[#13306a]"
              >
                <ExternalLink size={16} />
                {tr("Itinéraire", "Directions", "الاتجاهات")}
              </a>
            )}
            {onBook ? (
              <button
                type="button"
                onClick={() => onBook(normalizedDoctor)}
                disabled={doctorUnavailable}
                className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white transition
                  ${doctorUnavailable
                    ? "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-[#102654] dark:text-blue-100/40"
                    : "bg-blue-600 shadow-lg shadow-blue-500/25 hover:bg-blue-700 active:scale-[0.98] dark:bg-blue-500 dark:hover:bg-blue-400"}`}
              >
                <Calendar size={16} />
                {tr("Prendre rendez-vous", "Book appointment", "حجز موعد")}
              </button>
            ) : null}
          </div>
        </div>
        <ModalScrollRail targetRef={scrollAreaRef} />
      </motion.div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
