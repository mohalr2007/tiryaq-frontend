import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildLocalDateTime,
  getLocalIsoDate,
  isDoctorOnVacation,
  normalizeTimeValue,
} from "@/utils/doctorAvailability";

export type BookingSelectionMode = "patient_datetime" | "patient_date_only" | "doctor_datetime";

export type BookableDoctor = {
  id: string;
  full_name: string | null;
  specialty: string | null;
  avatar_url?: string | null;
  address?: string | null;
  is_accepting_appointments?: boolean | null;
  appointment_duration_minutes?: number | null;
  max_appointments_per_day?: number | null;
  vacation_start?: string | null;
  vacation_end?: string | null;
  is_on_vacation?: boolean | null;
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  appointment_booking_mode?: BookingSelectionMode | null;
};

export type AppointmentInsertResult = {
  id: string;
  appointment_date: string;
  status: string;
  doctor_id: string;
  booking_selection_mode: string | null;
  requested_date: string | null;
  requested_time: string | null;
};

type AvailabilityAppointmentRow = {
  id?: string;
  appointment_date: string;
  status: string;
  follow_up_time_pending?: boolean | null;
};

export type BookingRequestInput = {
  supabaseClient: SupabaseClient;
  doctor: BookableDoctor;
  patientId: string;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
};

export type BookingRequestResult =
  | {
      ok: true;
      code: "success" | "patient_date_only_success" | "doctor_datetime_success";
      message: string;
      bookingMode: BookingSelectionMode;
      appointment: AppointmentInsertResult;
    }
  | {
      ok: false;
      code:
        | "missing_date_time"
        | "missing_date"
        | "invalid_datetime"
        | "past_datetime"
        | "doctor_unavailable"
        | "vacation"
        | "day_full"
        | "outside_hours"
        | "slot_overlap"
        | "insert_error";
      message: string;
      bookingMode: BookingSelectionMode;
    };

export type BookingSuccessResult = Extract<BookingRequestResult, { ok: true }>;

export type DoctorBookingSlot = {
  time: string;
  isBooked: boolean;
  isPast: boolean;
  isSelectable: boolean;
};

export type DoctorBookingDay = {
  date: string;
  status: "available" | "full" | "vacation" | "past";
  isSelectable: boolean;
  bookedCount: number;
  capacity: number | null;
  availableSlots: number;
  totalSlots: number;
  slots: DoctorBookingSlot[];
};

export const BOOKING_LOOKAHEAD_DAYS = 14;

function getDoctorBookingMode(doctor: BookableDoctor) {
  return doctor.appointment_booking_mode ?? "patient_datetime";
}

function getDoctorDurationMinutes(doctor: BookableDoctor) {
  return doctor.appointment_duration_minutes || 30;
}

export function getDoctorWorkHours(doctor: BookableDoctor) {
  const workStart = normalizeTimeValue(doctor.working_hours_start, "08:00");
  const workEnd = normalizeTimeValue(doctor.working_hours_end, "17:00");
  return { workStart, workEnd };
}

export function buildDoctorTimeSlots(doctor: BookableDoctor) {
  const bookingMode = getDoctorBookingMode(doctor);
  if (bookingMode === "doctor_datetime") {
    return [] as string[];
  }

  const { workStart, workEnd } = getDoctorWorkHours(doctor);
  const [startHour, startMinute] = workStart.split(":").map(Number);
  const [endHour, endMinute] = workEnd.split(":").map(Number);
  const duration = getDoctorDurationMinutes(doctor);
  const generatedSlots: string[] = [];

  let cursorMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  while (cursorMinutes + duration <= endMinutes) {
    const slotHour = Math.floor(cursorMinutes / 60);
    const slotMinute = cursorMinutes % 60;
    generatedSlots.push(`${String(slotHour).padStart(2, "0")}:${String(slotMinute).padStart(2, "0")}`);
    cursorMinutes += duration;
  }

  return generatedSlots;
}

function getRangeEndIso(startDate: string, days: number) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(days - 1, 0));
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

function getAppointmentLocalDateKey(value: string) {
  return getLocalIsoDate(new Date(value));
}

function buildDateOffset(baseDate: string, offsetDays: number) {
  const base = new Date(`${baseDate}T00:00:00`);
  base.setDate(base.getDate() + offsetDays);
  return getLocalIsoDate(base);
}

function doesAppointmentOverlapSlot(
  appointmentIso: string,
  slotDateTime: Date,
  durationMinutes: number
) {
  const appointmentTimestamp = new Date(appointmentIso).getTime();
  return Math.abs(slotDateTime.getTime() - appointmentTimestamp) / (1000 * 60) < durationMinutes;
}

function buildDayAvailability(
  doctor: BookableDoctor,
  date: string,
  appointments: AvailabilityAppointmentRow[],
  now: Date
): DoctorBookingDay {
  const bookingMode = getDoctorBookingMode(doctor);
  const maxAppointments = doctor.max_appointments_per_day ?? null;
  const duration = getDoctorDurationMinutes(doctor);
  const slotTemplates = buildDoctorTimeSlots(doctor);
  const isPastDay = date < getLocalIsoDate(now);

  if (isPastDay) {
    return {
      date,
      status: "past",
      isSelectable: false,
      bookedCount: appointments.length,
      capacity: maxAppointments,
      availableSlots: 0,
      totalSlots: slotTemplates.length,
      slots: [],
    };
  }

  if (isDoctorOnVacation(doctor, new Date(`${date}T12:00:00`))) {
    return {
      date,
      status: "vacation",
      isSelectable: false,
      bookedCount: appointments.length,
      capacity: maxAppointments,
      availableSlots: 0,
      totalSlots: slotTemplates.length,
      slots: [],
    };
  }

  if (bookingMode === "doctor_datetime") {
    return {
      date,
      status: "available",
      isSelectable: false,
      bookedCount: 0,
      capacity: maxAppointments,
      availableSlots: 0,
      totalSlots: 0,
      slots: [],
    };
  }

  const slots: DoctorBookingSlot[] =
    bookingMode === "patient_datetime"
      ? slotTemplates.map((time) => {
          const slotDateTime = buildLocalDateTime(date, time);
          const isPast = slotDateTime.getTime() <= now.getTime();
          const isBooked = appointments.some(
            (appointment) =>
              !appointment.follow_up_time_pending &&
              doesAppointmentOverlapSlot(appointment.appointment_date, slotDateTime, duration)
          );

          return {
            time,
            isBooked,
            isPast,
            isSelectable: !isBooked && !isPast,
          };
        })
      : [];

  const availableSlots = slots.filter((slot) => slot.isSelectable).length;
  const hasReachedDailyLimit = maxAppointments != null && appointments.length >= maxAppointments;
  const isFull =
    bookingMode === "patient_datetime"
      ? hasReachedDailyLimit || availableSlots === 0
      : hasReachedDailyLimit;

  return {
    date,
    status: isFull ? "full" : "available",
    isSelectable: !isFull,
    bookedCount: appointments.length,
    capacity: maxAppointments,
    availableSlots,
    totalSlots: slots.length,
    slots,
  };
}

export async function listDoctorAvailabilityRange({
  supabaseClient,
  doctor,
  startDate = getLocalIsoDate(),
  days = BOOKING_LOOKAHEAD_DAYS,
}: {
  supabaseClient: SupabaseClient;
  doctor: BookableDoctor;
  startDate?: string;
  days?: number;
}) {
  const bookingMode = getDoctorBookingMode(doctor);

  if (bookingMode === "doctor_datetime") {
    return [] as DoctorBookingDay[];
  }

  const rangeEndIso = getRangeEndIso(startDate, days);
  const { data, error } = await supabaseClient
    .from("appointments")
    .select("id, appointment_date, status, follow_up_time_pending")
    .eq("doctor_id", doctor.id)
    .gte("appointment_date", `${startDate}T00:00:00`)
    .lte("appointment_date", rangeEndIso)
    .neq("status", "cancelled");

  if (error) {
    throw error;
  }

  const appointmentsByDate = new Map<string, AvailabilityAppointmentRow[]>();
  (data ?? []).forEach((appointment) => {
    const key = getAppointmentLocalDateKey(appointment.appointment_date);
    const existing = appointmentsByDate.get(key) ?? [];
    existing.push(appointment);
    appointmentsByDate.set(key, existing);
  });

  const now = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = buildDateOffset(startDate, index);
    return buildDayAvailability(doctor, date, appointmentsByDate.get(date) ?? [], now);
  });
}

export async function createAppointmentRequest({
  supabaseClient,
  doctor,
  patientId,
  appointmentDate,
  appointmentTime,
}: BookingRequestInput): Promise<BookingRequestResult> {
  const bookingMode = getDoctorBookingMode(doctor);
  const { workStart, workEnd } = getDoctorWorkHours(doctor);
  const [startH, startM] = workStart.split(":").map(Number);
  const [endH, endM] = workEnd.split(":").map(Number);
  const duration = getDoctorDurationMinutes(doctor);

  if (bookingMode === "patient_datetime" && (!appointmentDate || !appointmentTime)) {
    return { ok: false, code: "missing_date_time", message: "Veuillez choisir une date et une heure valides.", bookingMode };
  }

  if (bookingMode === "patient_date_only" && !appointmentDate) {
    return { ok: false, code: "missing_date", message: "Veuillez choisir une date valide.", bookingMode };
  }

  let chosenDate: Date;
  let requestedDate: string | null = null;
  let requestedTime: string | null = null;

  if (bookingMode === "patient_datetime") {
    const normalizedAppointmentTime = normalizeTimeValue(appointmentTime, workStart);
    chosenDate = buildLocalDateTime(appointmentDate!, normalizedAppointmentTime);
    requestedDate = appointmentDate!;
    requestedTime = `${normalizedAppointmentTime}:00`;
  } else if (bookingMode === "patient_date_only") {
    chosenDate = buildLocalDateTime(appointmentDate!, workStart);
    requestedDate = appointmentDate!;
    requestedTime = null;
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    chosenDate = buildLocalDateTime(getLocalIsoDate(tomorrow), workStart);
    requestedDate = null;
    requestedTime = null;
  }

  if (Number.isNaN(chosenDate.getTime())) {
    return { ok: false, code: "invalid_datetime", message: "Date ou heure invalide.", bookingMode };
  }

  const todayIso = getLocalIsoDate();
  if (
    (bookingMode === "patient_datetime" && chosenDate.getTime() <= Date.now()) ||
    ((bookingMode === "patient_date_only" || bookingMode === "patient_datetime") &&
      requestedDate != null &&
      requestedDate < todayIso)
  ) {
    return {
      ok: false,
      code: "past_datetime",
      message: "Merci de choisir une date ou une heure future pour ce rendez-vous.",
      bookingMode,
    };
  }

  if (doctor.is_accepting_appointments === false) {
    return {
      ok: false,
      code: "doctor_unavailable",
      message: "Réservation impossible. Ce médecin n'accepte pas de nouveaux rendez-vous pour le moment.",
      bookingMode,
    };
  }

  if (isDoctorOnVacation(doctor, chosenDate)) {
    return {
      ok: false,
      code: "vacation",
      message: "Ce médecin est actuellement en congé sur cette période. Merci de choisir un autre praticien ou une autre date.",
      bookingMode,
    };
  }

  const startTimeMinutes = startH * 60 + startM;
  const endTimeMinutes = endH * 60 + endM;
  const startOfDay = new Date(chosenDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(chosenDate);
  endOfDay.setHours(23, 59, 59, 999);

  let dayAppointments: AvailabilityAppointmentRow[] = [];
  if (bookingMode !== "doctor_datetime") {
    const { data, error } = await supabaseClient
      .from("appointments")
      .select("id, appointment_date, status, follow_up_time_pending")
      .eq("doctor_id", doctor.id)
      .gte("appointment_date", startOfDay.toISOString())
      .lte("appointment_date", endOfDay.toISOString())
      .neq("status", "cancelled");

    if (error) {
      return { ok: false, code: "insert_error", message: error.message, bookingMode };
    }

    dayAppointments = data ?? [];
  }

  const maxAppointments = doctor.max_appointments_per_day;
  if (bookingMode !== "doctor_datetime" && maxAppointments != null && dayAppointments.length >= maxAppointments) {
    return {
      ok: false,
      code: "day_full",
      message: `Cette journée est complète pour ce médecin (limite: ${maxAppointments} rendez-vous).`,
      bookingMode,
    };
  }

  if (bookingMode === "patient_datetime") {
    const requestedTimeMinutes = chosenDate.getHours() * 60 + chosenDate.getMinutes();
    const requestedEndMinutes = requestedTimeMinutes + duration;

    if (requestedTimeMinutes < startTimeMinutes || requestedEndMinutes > endTimeMinutes) {
      return {
        ok: false,
        code: "outside_hours",
        message: `Le créneau demandé est en dehors des horaires du cabinet (${workStart} - ${workEnd}).`,
        bookingMode,
      };
    }

    const requestedTimestamp = chosenDate.getTime();
    const hasOverlap = dayAppointments.some((appointment) => {
      if (appointment.follow_up_time_pending) {
        return false;
      }
      const appointmentTimestamp = new Date(appointment.appointment_date).getTime();
      return Math.abs(requestedTimestamp - appointmentTimestamp) / (1000 * 60) < duration;
    });

    if (hasOverlap) {
      return {
        ok: false,
        code: "slot_overlap",
        message: `Ce créneau est déjà pris ou trop proche d'un autre rendez-vous (${duration} min minimum).`,
        bookingMode,
      };
    }
  }

  const { data: insertedAppointment, error: insertError } = await supabaseClient
    .from("appointments")
    .insert({
      patient_id: patientId,
      doctor_id: doctor.id,
      appointment_date: chosenDate.toISOString(),
      status: "pending",
      booking_selection_mode: bookingMode,
      requested_date: requestedDate,
      requested_time: requestedTime,
    })
    .select("id, appointment_date, status, doctor_id, booking_selection_mode, requested_date, requested_time")
    .single();

  if (insertError || !insertedAppointment) {
    return {
      ok: false,
      code: "insert_error",
      message: insertError?.message ?? "Impossible d'enregistrer le rendez-vous.",
      bookingMode,
    };
  }

  const successCode =
    bookingMode === "doctor_datetime"
      ? "doctor_datetime_success"
      : bookingMode === "patient_date_only"
        ? "patient_date_only_success"
        : "success";

  let successMessage = "La demande de rendez-vous a bien été envoyée.";
  if (bookingMode === "doctor_datetime") {
    successMessage = "La demande a été envoyée. Le médecin vous proposera une date et une heure.";
  } else if (bookingMode === "patient_date_only") {
    successMessage = "La demande a été envoyée. Le médecin définira ensuite l'heure du rendez-vous.";
  }

  return {
    ok: true,
    code: successCode,
    message: successMessage,
    bookingMode,
    appointment: insertedAppointment as AppointmentInsertResult,
  };
}
