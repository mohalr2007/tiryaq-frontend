"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Calendar, CalendarDays, CheckCircle, ChevronLeft, Clock3, Loader2, MapPin, X } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import {
  BOOKING_LOOKAHEAD_DAYS,
  createAppointmentRequest,
  listDoctorAvailabilityRange,
  type BookingSuccessResult,
  type DoctorBookingDay,
} from "./booking";
import type { RecommendedDoctor } from "./types";
import { getLocalIsoDate, normalizeTimeValue } from "@/utils/doctorAvailability";
import { useI18n } from "@/lib/i18n";
import ModalScrollRail from "@/components/ModalScrollRail";

type Props = {
  doctor: RecommendedDoctor;
  patientId: string | null;
  onClose: () => void;
  onSuccess: (result: BookingSuccessResult) => void | Promise<void>;
};

type BookingMode = "patient_datetime" | "patient_date_only" | "doctor_datetime";

function getDayCardClasses(day: DoctorBookingDay, isSelected: boolean) {
  if (isSelected && !day.isSelectable) {
    return "ring-2 ring-inset ring-amber-400 bg-amber-50 text-amber-800 dark:ring-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200";
  }

  if (isSelected) {
    return "ring-2 ring-inset ring-blue-500 bg-blue-50 text-blue-900 shadow-sm dark:ring-blue-400 dark:bg-blue-600 dark:text-white";
  }

  if (!day.isSelectable) {
    return "border border-slate-100 bg-slate-50 text-slate-400 dark:border-[#18366f] dark:bg-[#0b1838] dark:text-blue-100/35";
  }

  return "border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50 hover:shadow-sm transition-all dark:border-[#27509b] dark:bg-[#0c1c42] dark:text-slate-100 dark:hover:border-blue-400/60 dark:hover:bg-[#13306a]";
}

export default function DoctorBookingModal({ doctor, patientId, onClose, onSuccess }: Props) {
  const { language } = useI18n();
  const tr = useCallback(
    (fr: string, en: string, ar: string) => (language === "ar" ? ar : language === "en" ? en : fr),
    [language]
  );
  const locale = language === "ar" ? "ar-DZ" : language === "en" ? "en-US" : "fr-FR";

  const bookingMode: BookingMode = doctor.appointment_booking_mode ?? "patient_datetime";
  const [availability, setAvailability] = useState<DoctorBookingDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingStep, setBookingStep] = useState<"date" | "time">("date");
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(bookingMode !== "doctor_datetime");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const { workStart, workEnd } = useMemo(
    () => ({
      workStart: normalizeTimeValue(doctor.working_hours_start, "08:00"),
      workEnd: normalizeTimeValue(doctor.working_hours_end, "17:00"),
    }),
    [doctor.working_hours_end, doctor.working_hours_start]
  );
  const durationMinutes = doctor.appointment_duration_minutes ?? 30;
  const dateInputMin = useMemo(() => getLocalIsoDate(), []);
  const dateInputMax = useMemo(() => {
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 20);
    return getLocalIsoDate(maxDate);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [doctor.avatar_url]);

  const loadAvailabilityWindow = useCallback(
    async (
      startDate: string,
      options?: {
        preferredDate?: string | null;
        advanceToTime?: boolean;
      }
    ) => {
      if (bookingMode === "doctor_datetime") {
        setAvailability([]);
        setSelectedDate(null);
        setSelectedTime(null);
        setIsLoadingAvailability(false);
        return;
      }

      setIsLoadingAvailability(true);
      setError(null);

      try {
        const days = await listDoctorAvailabilityRange({
          supabaseClient: supabase,
          doctor,
          startDate,
          days: BOOKING_LOOKAHEAD_DAYS,
        });

        setAvailability(days);

        const preferredDay = options?.preferredDate
          ? days.find((day) => day.date === options.preferredDate) ?? null
          : null;
        const firstAvailableDay = days.find((day) => day.isSelectable) ?? null;
        const nextSelectedDay = preferredDay ?? firstAvailableDay;

        setSelectedDate(nextSelectedDay?.date ?? options?.preferredDate ?? null);

        if (bookingMode === "patient_datetime") {
          const nextSelectedSlot =
            nextSelectedDay?.slots.find((slot) => slot.isSelectable)?.time ?? null;
          setSelectedTime(nextSelectedSlot);

          if (options?.advanceToTime && preferredDay?.isSelectable) {
            setBookingStep("time");
          } else if (options?.advanceToTime) {
            setBookingStep("date");
          }
        } else {
          setSelectedTime(null);
        }

        if (options?.preferredDate && preferredDay && !preferredDay.isSelectable) {
          setError(
            tr(
              "Cette date est complète ou indisponible. Choisissez une autre date.",
              "This date is full or unavailable. Please choose another date.",
              "هذا التاريخ ممتلئ أو غير متاح. اختر تاريخاً آخر."
            )
          );
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : tr(
                "Impossible de charger les disponibilités.",
                "Could not load availability.",
                "تعذر تحميل المواعيد المتاحة."
              );
        setError(message);
      } finally {
        setIsLoadingAvailability(false);
      }
    },
    [bookingMode, doctor, tr]
  );

  useEffect(() => {
    void loadAvailabilityWindow(getLocalIsoDate(), { preferredDate: null, advanceToTime: false });
  }, [loadAvailabilityWindow]);

  useEffect(() => {
    if (bookingMode !== "patient_datetime") {
      setBookingStep("date");
      return;
    }

    if (!selectedDate) {
      setBookingStep("date");
    }
  }, [bookingMode, selectedDate]);

  const selectedDay = availability.find((day) => day.date === selectedDate) ?? null;
  const selectableDateSet = useMemo(() => {
    return new Set(availability.filter((day) => day.isSelectable).map((day) => day.date));
  }, [availability]);
  const visibleSlots = useMemo(() => {
    if (!selectedDay) {
      return [];
    }
    return selectedDay.slots.filter((slot) => slot.isSelectable);
  }, [selectedDay]);
  const isSelectedDateSelectable = selectedDay?.isSelectable ?? false;
  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const selectedDateShortLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(locale, {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
    : null;

  useEffect(() => {
    if (bookingMode !== "patient_datetime") {
      return;
    }

    const nextAvailableSlot = selectedDay?.slots.find((slot) => slot.isSelectable) ?? null;
    if (!selectedDay) {
      setSelectedTime(null);
      return;
    }

    if (!selectedTime || !selectedDay.slots.some((slot) => slot.time === selectedTime && slot.isSelectable)) {
      setSelectedTime(nextAvailableSlot?.time ?? null);
    }
  }, [bookingMode, selectedDay, selectedTime]);

  const getBookingMessage = useCallback(
    (
      code:
        | BookingSuccessResult["code"]
        | "missing_date_time"
        | "missing_date"
        | "invalid_datetime"
        | "past_datetime"
        | "doctor_unavailable"
        | "vacation"
        | "day_full"
        | "outside_hours"
        | "slot_overlap"
        | "insert_error"
    ) => {
      switch (code) {
        case "success":
          return tr(
            "Le rendez-vous a bien été enregistré.",
            "The appointment has been booked.",
            "تم تسجيل الموعد بنجاح."
          );
        case "patient_date_only_success":
          return tr(
            "La date a été transmise. Le cabinet vous confirmera ensuite l'heure.",
            "The date was sent. The clinic will confirm the time afterwards.",
            "تم إرسال التاريخ. ستؤكد العيادة الساعة لاحقاً."
          );
        case "doctor_datetime_success":
          return tr(
            "La demande a été envoyée. Le médecin vous proposera la date et l'heure.",
            "Your request has been sent. The doctor will propose the final date and time.",
            "تم إرسال الطلب. سيقترح الطبيب التاريخ والساعة."
          );
        case "missing_date_time":
          return tr(
            "Choisissez une date et une heure valides.",
            "Choose a valid date and time.",
            "اختر تاريخاً وساعة صالحين."
          );
        case "missing_date":
          return tr("Choisissez une date valide.", "Choose a valid date.", "اختر تاريخاً صالحاً.");
        case "invalid_datetime":
          return tr(
            "La date ou l'heure choisie est invalide.",
            "The chosen date or time is invalid.",
            "التاريخ أو الساعة المختارة غير صالحة."
          );
        case "past_datetime":
          return tr(
            "Choisissez une date ou une heure future pour ce rendez-vous.",
            "Choose a future date or time for this appointment.",
            "اختر تاريخاً أو ساعة مستقبلية لهذا الموعد."
          );
        case "doctor_unavailable":
          return tr(
            "Ce médecin n'accepte pas de nouveaux rendez-vous pour le moment.",
            "This doctor is not accepting new appointments right now.",
            "هذا الطبيب لا يستقبل مواعيد جديدة حالياً."
          );
        case "vacation":
          return tr(
            "Ce médecin est en congé sur cette période.",
            "This doctor is on leave for that period.",
            "هذا الطبيب في عطلة خلال هذه الفترة."
          );
        case "day_full":
          return tr(
            "Cette journée est complète. Choisissez une autre date.",
            "This day is full. Choose another date.",
            "هذا اليوم ممتلئ. اختر تاريخاً آخر."
          );
        case "outside_hours":
          return tr(
            `Le créneau doit rester entre ${workStart} et ${workEnd}.`,
            `The slot must stay between ${workStart} and ${workEnd}.`,
            `يجب أن يكون الموعد بين ${workStart} و${workEnd}.`
          );
        case "slot_overlap":
          return tr(
            `Ce créneau est déjà pris ou trop proche d'un autre rendez-vous (${durationMinutes} min).`,
            `This slot is already taken or too close to another appointment (${durationMinutes} min).`,
            `هذه الفترة محجوزة أو قريبة جداً من موعد آخر (${durationMinutes} دقيقة).`
          );
        case "insert_error":
        default:
          return tr(
            "Impossible d'enregistrer la réservation pour le moment.",
            "Could not save the booking right now.",
            "تعذر حفظ الحجز حالياً."
          );
      }
    },
    [durationMinutes, tr, workEnd, workStart]
  );

  const handleSubmit = async () => {
    if (!patientId) {
      setError(tr("Vous devez vous connecter pour réserver.", "You must log in to book.", "يجب تسجيل الدخول للحجز."));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createAppointmentRequest({
        supabaseClient: supabase,
        doctor,
        patientId,
        appointmentDate: bookingMode !== "doctor_datetime" ? selectedDate : null,
        appointmentTime: bookingMode === "patient_datetime" ? selectedTime : null,
      });

      if (!result.ok) {
        throw new Error(getBookingMessage(result.code));
      }

      setSuccessMessage(getBookingMessage(result.code));
      await onSuccess(result);
      window.setTimeout(() => {
        onClose();
      }, 1400);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : tr(
              "Une erreur est survenue pendant la réservation.",
              "A booking error occurred.",
              "حدث خطأ أثناء الحجز."
            )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const title =
    bookingMode === "doctor_datetime"
      ? tr("Envoyer une demande", "Send a request", "إرسال طلب")
      : tr("Réserver un rendez-vous", "Book an appointment", "حجز موعد");

  const modeChip =
    bookingMode === "patient_datetime"
      ? tr("Date + heure", "Date + time", "تاريخ + ساعة")
      : bookingMode === "patient_date_only"
        ? tr("Date seulement", "Date only", "التاريخ فقط")
        : tr("Demande libre", "Open request", "طلب مباشر");

  const submitLabel =
    bookingMode === "doctor_datetime"
      ? tr("Envoyer la demande", "Send request", "إرسال الطلب")
      : bookingMode === "patient_date_only"
        ? tr("Confirmer la date", "Confirm date", "تأكيد التاريخ")
        : tr("Confirmer le créneau", "Confirm slot", "تأكيد الموعد");

  const handleCalendarDateSelect = (dateValue: string) => {
    if (!dateValue) {
      return;
    }

    const matchedDay = availability.find((day) => day.date === dateValue) ?? null;
    if (!matchedDay) {
      void loadAvailabilityWindow(dateValue, { preferredDate: dateValue, advanceToTime: true });
      return;
    }

    if (!matchedDay.isSelectable || !selectableDateSet.has(dateValue)) {
      setSelectedDate(dateValue);
      setSelectedTime(null);
      setBookingStep("date");
      setError(
        tr(
          "Cette date est complète ou indisponible. Choisissez une autre date.",
          "This date is full or unavailable. Please choose another date.",
          "هذا التاريخ ممتلئ أو غير متاح. اختر تاريخاً آخر."
        )
      );
      return;
    }

    setError(null);
    setSelectedDate(dateValue);

    if (bookingMode === "patient_datetime") {
      const firstAvailableSlot = matchedDay.slots.find((slot) => slot.isSelectable) ?? null;
      setSelectedTime(firstAvailableSlot?.time ?? null);
      setBookingStep("time");
    }
  };

  const initials = (doctor.full_name ?? "DR").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const isSubmitDisabled =
    isSubmitting ||
    !!successMessage ||
    (bookingMode !== "doctor_datetime" && (!selectedDate || !isSelectedDateSelectable)) ||
    (bookingMode === "patient_datetime" && !selectedTime);

  const modalContent = (
    <div
      className="fixed inset-0 z-[250] flex items-end justify-center overflow-y-auto overscroll-contain bg-[#030814]/72 p-0 backdrop-blur-md sm:items-center sm:p-4"
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
          <div className="h-20 w-full bg-[#143dbd] bg-gradient-to-br from-[#3672ff] via-[#2057ef] to-[#143dbd]" />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/30"
          >
            <X size={16} />
          </button>

          <div className="px-5 pb-4">
            <div className="flex items-center gap-3 -mt-8">
              <div className="relative flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-blue-600 bg-gradient-to-br from-[#3672ff] to-[#1d4fe0] text-lg font-black text-white shadow-lg dark:border-[#07142d] dark:bg-[#12306d]">
                <span className="pointer-events-none select-none">{initials}</span>
                {doctor.avatar_url && !avatarLoadFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={doctor.avatar_url}
                    alt={doctor.full_name || "Doctor"}
                    onError={() => setAvatarLoadFailed(true)}
                    className="absolute inset-0 h-full w-full bg-[#143dbd] object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-3 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.5)] ring-1 ring-slate-200 dark:bg-[#0c1c42] dark:ring-[#27509b]">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-600 dark:text-blue-200">{title}</p>
                <h3 className="truncate text-base font-black leading-tight text-slate-950 dark:text-white">
                  Dr. {doctor.full_name}
                </h3>
                <p className="mt-1 truncate text-sm font-semibold text-blue-700 dark:text-blue-200">
                  {doctor.specialty || tr("Médecin", "Doctor", "طبيب")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-[#16377a] dark:text-blue-50">{modeChip}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-[#16377a] dark:text-blue-50">{workStart} – {workEnd}</span>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-[#2057ef] dark:text-white">{durationMinutes} min</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain ps-16">
          <div className="space-y-0 divide-y divide-slate-100 dark:divide-[#17386f]">

            {/* Address */}
            {doctor.address && (
              <div className="flex items-start gap-3 px-5 py-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-[#12306d]">
                  <MapPin size={15} className="text-blue-600 dark:text-blue-100" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-200/55">
                    {tr("Adresse du cabinet", "Clinic address", "عنوان العيادة")}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-blue-50/90">{doctor.address}</p>
                </div>
              </div>
            )}

            {/* Date / Time Picker Zone */}
            <div className="px-5 py-5">
              {bookingMode === "doctor_datetime" ? (
                <div className="rounded-2xl bg-blue-50 p-5 dark:bg-[#0e2350]">
                  <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 dark:bg-[#14367b]">
                        <CalendarDays size={15} className="text-blue-600 dark:text-blue-100" />
                      </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {tr("Demande de rendez-vous", "Appointment request", "طلب موعد")}
                    </h4>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-blue-100/70">
                    {tr(
                      "Envoyez une demande maintenant. Le cabinet vous recontactera pour confirmer la date et l'heure.",
                      "Send a request now. The clinic will follow up with the final date and time.",
                      "أرسل طلبك الآن. ستتواصل معك العيادة لتأكيد التاريخ والساعة."
                    )}
                  </p>
                </div>
              ) : (
                <div>
                  {/* Step indicator for patient_datetime */}
                  {bookingMode === "patient_datetime" && (
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black transition ${bookingStep === "date" ? "bg-blue-600 text-white" : "bg-emerald-500 text-white"}`}>
                          {bookingStep === "date" ? "1" : "✓"}
                        </div>
                        <div className="h-px w-6 bg-slate-200 dark:bg-[#23467f]" />
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black transition ${bookingStep === "time" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 dark:bg-[#102654] dark:text-blue-100/55"}`}>
                          2
                        </div>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        {bookingStep === "time"
                          ? tr("Choisissez l'heure", "Choose a time", "اختر الساعة")
                          : tr("Choisissez la date", "Choose a date", "اختر التاريخ")}
                      </h4>
                    </div>
                  )}

                  {/* Date input */}
                  <div className="mb-4">
                    <div className="relative">
                      <Calendar size={15} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        type="date"
                        value={selectedDate ?? ""}
                        min={dateInputMin}
                        max={dateInputMax}
                        onChange={(event) => handleCalendarDateSelect(event.target.value)}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-10 pe-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-[#27509b] dark:bg-[#0c1c42] dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-500/10"
                      />
                    </div>
                    {bookingMode === "patient_date_only" && (
                        <p className="mt-2 text-xs text-slate-600 dark:text-blue-100/62">
                        {tr("Le cabinet confirmera l'heure exacte.", "The clinic will confirm the exact time.", "العيادة ستؤكد الساعة الدقيقة.")}
                      </p>
                    )}
                  </div>

                  {isLoadingAvailability ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                      ))}
                    </div>
                  ) : bookingMode === "patient_datetime" && bookingStep === "time" ? (
                    /* Time grid */
                    <div>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setBookingStep("date")}
                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-[#102654] dark:text-blue-50 dark:hover:bg-[#153271]"
                        >
                          <ChevronLeft size={13} />
                          {tr("Changer la date", "Change date", "تغيير التاريخ")}
                        </button>
                        {selectedDateShortLabel && (
                            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-[#14367b] dark:text-blue-100">
                            {selectedDateShortLabel}
                          </span>
                        )}
                      </div>

                      {selectedDay ? (
                        visibleSlots.length > 0 ? (
                          <div className="grid max-h-[220px] grid-cols-3 gap-2 overflow-y-auto pe-1 sm:grid-cols-4">
                            {visibleSlots.map((slot) => (
                              <button
                                key={`${selectedDay.date}-${slot.time}`}
                                type="button"
                                onClick={() => { setError(null); setSelectedTime(slot.time); }}
                                className={`flex flex-col items-center justify-center rounded-2xl py-3 text-sm font-bold transition ${
                                  selectedTime === slot.time
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                    : "bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-[#0d214b] dark:text-slate-100 dark:hover:bg-[#16377a] dark:hover:text-white"
                                }`}
                              >
                                <Clock3 size={13} className={`mb-1 ${selectedTime === slot.time ? "text-blue-200" : "text-slate-400 dark:text-slate-500"}`} />
                                {slot.time}
                              </button>
                            ))}
                          </div>
                        ) : (
                            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-[#3a2a06] dark:text-amber-100">
                            {tr("Aucun créneau disponible. Choisissez une autre date.", "No slots available. Choose another date.", "لا توجد فترات متاحة. اختر تاريخاً آخر.")}
                          </div>
                        )
                      ) : (
                          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-[#0d214b] dark:text-blue-100/62">
                          {tr("Choisissez d'abord une date.", "Choose a date first.", "اختر تاريخاً أولاً.")}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Day grid */
                    availability.length > 0 && (
                      <div className="grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto pe-1 sm:grid-cols-3">
                        {availability.map((day) => {
                          const dayLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString(locale, {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          });
                          const isSelected = selectedDate === day.date;
                          return (
                            <button
                              key={day.date}
                              type="button"
                              disabled={!day.isSelectable}
                              onClick={() => {
                                setError(null);
                                setSelectedDate(day.date);
                                if (bookingMode === "patient_datetime") {
                                  const firstSlot = day.slots.find((s) => s.isSelectable) ?? null;
                                  setSelectedTime(firstSlot?.time ?? null);
                                  setBookingStep("time");
                                }
                              }}
                              className={`w-full rounded-2xl px-3 py-3.5 text-start transition disabled:cursor-not-allowed ${getDayCardClasses(day, isSelected)}`}
                            >
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{dayLabel}</p>
                              <p className="mt-1 text-sm font-bold">
                                {day.status === "vacation" ? tr("Congé", "Vacation", "عطلة")
                                  : day.status === "full" ? tr("Complet", "Full", "ممتلئ")
                                  : day.status === "past" ? tr("Passé", "Past", "منتهي")
                                  : tr("Disponible", "Available", "متاح")}
                              </p>
                              {bookingMode === "patient_datetime" && (
                                <p className={`mt-1 text-[11px] font-semibold ${isSelected && day.isSelectable ? "text-blue-700/70 dark:text-blue-300/70" : "opacity-50"}`}>
                                  {day.availableSlots}/{day.totalSlots} {tr("libres", "free", "متاحة")}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Summary panel */}
            <div className="px-5 py-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-200/55">
                {tr("Récapitulatif", "Summary", "الملخص")}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-[#0d214b]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-200/55">
                    {tr("Date", "Date", "التاريخ")}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                    {selectedDateLabel
                      ? selectedDateLabel
                      : bookingMode === "doctor_datetime"
                        ? tr("Le médecin choisira", "Doctor will choose", "الطبيب سيحدد")
                        : "—"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-[#0d214b]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-200/55">
                    {tr("Heure", "Time", "الساعة")}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                    {bookingMode === "patient_datetime"
                      ? (selectedTime ?? "—")
                      : bookingMode === "patient_date_only"
                        ? tr("Confirmée par le cabinet", "By clinic", "من العيادة")
                        : tr("Par le médecin", "By doctor", "من الطبيب")}
                  </p>
                </div>
              </div>

              {error && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-[#3b1220] dark:text-rose-200">
                  <span className="text-base leading-none">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-[#0d3140] dark:text-emerald-100">
                  <CheckCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sticky footer CTA ── */}
        <div className="flex-none border-t border-slate-100 bg-white px-5 py-4 dark:border-[#17386f] dark:bg-[#07142d]">
          {!patientId && (
            <p className="mb-3 text-center text-xs text-slate-500 dark:text-slate-400">
              {tr("Vous devez être connecté pour réserver.", "You must be logged in to book.", "يجب تسجيل الدخول للحجز.")}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitDisabled}
            className={`inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition active:scale-[0.98]
              ${isSubmitDisabled
                ? "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-[#102654] dark:text-blue-100/40"
                    : "bg-blue-600 shadow-lg shadow-blue-500/25 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"}`}
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
            {isSubmitting ? tr("Envoi en cours...", "Sending...", "جارٍ الإرسال...") : submitLabel}
          </button>
        </div>
        <ModalScrollRail targetRef={scrollAreaRef} />
      </motion.div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
