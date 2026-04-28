import type { DoctorContactFields } from "@/utils/doctorContactChannels";

export type UserLocation = {
  lat: number;
  lng: number;
};

export type DoctorRow = DoctorContactFields & {
  id: string;
  full_name: string | null;
  specialty: string | null;
  address: string | null;
  avatar_url: string | null;
  latitude: number | null;
  longitude: number | null;
  is_accepting_appointments?: boolean | null;
  appointment_duration_minutes?: number | null;
  max_appointments_per_day?: number | null;
  vacation_start?: string | null;
  vacation_end?: string | null;
  is_on_vacation?: boolean | null;
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  appointment_booking_mode?: "patient_datetime" | "patient_date_only" | "doctor_datetime" | null;
  google_maps_link?: string | null;
  gender?: string | null;
};

export type RatingRow = {
  doctor_id: string;
  avg_rating: number;
  total_reviews: number;
};

export type RecommendedDoctor = DoctorRow & {
  rating: number;
  reviews: number;
  distanceKm: number | null;
};

export type AssistantScope = "patient" | "doctor";

export type ChatAttachment = {
  name: string;
  mimeType: string;
  kind: "image" | "pdf";
  previewUrl?: string | null;
};

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  attachments?: ChatAttachment[];
  suggestedDoctors?: RecommendedDoctor[];
};

export type LunaAnalysis = {
  specialty: string | null;
  bodyZone: string | null;
  isEmergency: boolean;
  forceAll?: boolean;
};

export type DoctorReviewDetail = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  patient_name: string | null;
};
