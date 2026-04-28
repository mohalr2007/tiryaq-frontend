import { supabase } from "@/utils/supabase/client";
import { filterApprovedDoctors, getApprovedDoctorIdsSet } from "@/utils/approvedDoctorsClient";
import { clearExpiredVacationFlag, syncExpiredDoctorVacations } from "@/utils/doctorAvailability";
import { computeDistanceKm } from "./distance";
import { specialtyMatchesQuery } from "./specialty";
import type { DoctorRow, RatingRow, RecommendedDoctor, UserLocation } from "./types";

const MAX_DISTANCE_KM = 50;
const DOCTOR_LOOKUP_LIMIT = 300;

export const AI_DOCTOR_SELECT =
  "id, full_name, specialty, address, avatar_url, gender, latitude, longitude, is_accepting_appointments, appointment_duration_minutes, max_appointments_per_day, vacation_start, vacation_end, is_on_vacation, working_hours_start, working_hours_end, appointment_booking_mode, google_maps_link, contact_phone, contact_phone_enabled, contact_email, contact_email_enabled, facebook_url, facebook_enabled, instagram_url, instagram_enabled, x_url, x_enabled, whatsapp_url, whatsapp_enabled, telegram_url, telegram_enabled, linkedin_url, linkedin_enabled, gmail_url, gmail_enabled";

type FetchRecommendationsInput = {
  targetSpecialty: string;
  location: UserLocation | null;
};

type FetchRecommendationsOutput = {
  recommendations: RecommendedDoctor[];
};

type SearchDoctorsByMessageInput = {
  message: string;
  specialties?: string[];
  location?: UserLocation | null;
  limit?: number;
};

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDoctorNameMatchScore(fullName: string | null | undefined, message: string) {
  const normalizedName = normalizeSearchText(fullName);
  if (!normalizedName) {
    return 0;
  }

  if (message.includes(normalizedName)) {
    return 100;
  }

  const nameTokens = normalizedName.split(" ").filter((token) => token.length > 1);
  if (nameTokens.length === 0) {
    return 0;
  }

  const matchedTokens = nameTokens.filter((token) => message.includes(token));
  if (matchedTokens.length === 0) {
    return 0;
  }

  if (nameTokens.length === 1) {
    return matchedTokens.length === 1 ? 55 : 0;
  }

  if (matchedTokens.length >= Math.min(2, nameTokens.length)) {
    return 70 + matchedTokens.length * 10;
  }

  const surname = nameTokens[nameTokens.length - 1];
  if (surname && message.includes(surname)) {
    return 45;
  }

  return 0;
}

async function fetchDoctorRatings(doctorIds: string[]) {
  const ratingsByDoctorId: Record<string, RatingRow> = {};
  if (doctorIds.length === 0) {
    return ratingsByDoctorId;
  }

  const { data: ratingsData } = await supabase
    .from("doctor_ratings")
    .select("doctor_id, avg_rating, total_reviews")
    .in("doctor_id", doctorIds);

  (ratingsData ?? []).forEach((row) => {
    ratingsByDoctorId[row.doctor_id] = {
      doctor_id: row.doctor_id,
      avg_rating: Number(row.avg_rating ?? 0),
      total_reviews: Number(row.total_reviews ?? 0),
    };
  });

  return ratingsByDoctorId;
}

async function fetchAiEligibleDoctors() {
  const query = await supabase
    .from("profiles")
    .select(AI_DOCTOR_SELECT)
    .eq("account_type", "doctor")
    .limit(DOCTOR_LOOKUP_LIMIT);

  if (query.error) {
    throw new Error(query.error.message);
  }

  const approvedIds = await getApprovedDoctorIdsSet();
  return filterApprovedDoctors((query.data ?? []) as DoctorRow[], approvedIds);
}

export async function fetchRecommendedDoctors(
  input: FetchRecommendationsInput
): Promise<FetchRecommendationsOutput> {
  try {
    const { targetSpecialty, location } = input;
    await syncExpiredDoctorVacations();

    let doctors: DoctorRow[] = [];

    if (location) {
      const { data, error: rpcError } = await supabase.rpc("get_nearby_doctors", {
        user_lat: location.lat,
        user_lon: location.lng,
        radius_km: MAX_DISTANCE_KM,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      doctors = ((data ?? []) as DoctorRow[])
        .map((doctor) => clearExpiredVacationFlag(doctor))
        .filter((doctor) => {
          const dist = computeDistanceKm(location, doctor);
          return dist == null || dist <= MAX_DISTANCE_KM;
        });

      const bySpecialty = doctors.filter((doctor) => specialtyMatchesQuery(doctor.specialty, targetSpecialty));
      doctors = bySpecialty;
    } else {
      doctors = (await fetchAiEligibleDoctors())
        .map((doctor) => clearExpiredVacationFlag(doctor))
        .filter((doctor) => specialtyMatchesQuery(doctor.specialty, targetSpecialty));
    }

    const doctorIds = doctors.map((doctor) => doctor.id);
    const ratingsByDoctorId = await fetchDoctorRatings(doctorIds);

    const recommendations: RecommendedDoctor[] = doctors
      .map((doctor) => {
        const ratingEntry = ratingsByDoctorId[doctor.id];
        return {
          ...doctor,
          rating: ratingEntry?.avg_rating ?? 0,
          reviews: ratingEntry?.total_reviews ?? 0,
          distanceKm: computeDistanceKm(location, doctor),
        };
      })
      .sort((left, right) => {
        const leftMatch = specialtyMatchesQuery(left.specialty, targetSpecialty);
        const rightMatch = specialtyMatchesQuery(right.specialty, targetSpecialty);
        if (leftMatch && !rightMatch) return -1;
        if (!leftMatch && rightMatch) return 1;
        if (left.distanceKm != null && right.distanceKm != null) {
          return left.distanceKm - right.distanceKm;
        }
        return right.rating - left.rating;
      });

    return { recommendations: recommendations.filter((doctor) => Boolean(doctor.id)) };
  } catch {
    return { recommendations: [] };
  }
}

export async function searchDoctorsByMessage(
  input: SearchDoctorsByMessageInput
): Promise<RecommendedDoctor[]> {
  try {
    const {
      message,
      specialties = [],
      location = null,
      limit = 8,
    } = input;

    const normalizedMessage = normalizeSearchText(message);
    if (!normalizedMessage) {
      return [];
    }

    await syncExpiredDoctorVacations();

    const scoredDoctors = (await fetchAiEligibleDoctors())
      .map((doctor) => clearExpiredVacationFlag(doctor))
      .map((doctor) => {
        const nameScore = getDoctorNameMatchScore(doctor.full_name, normalizedMessage);
        const specialtyScore =
          specialties.length === 0 || specialties.some((specialty) => specialtyMatchesQuery(doctor.specialty, specialty))
            ? specialties.length === 0
              ? 10
              : 25
            : 0;

        return {
          doctor,
          nameScore,
          specialtyScore,
        };
      })
      .filter((entry) => entry.nameScore > 0 && (specialties.length === 0 || entry.specialtyScore > 0));

    if (scoredDoctors.length === 0) {
      return [];
    }

    const ratingsByDoctorId = await fetchDoctorRatings(scoredDoctors.map((entry) => entry.doctor.id));

    return scoredDoctors
      .map((entry) => {
        const ratingEntry = ratingsByDoctorId[entry.doctor.id];
        return {
          ...entry,
          recommendation: {
            ...entry.doctor,
            rating: ratingEntry?.avg_rating ?? 0,
            reviews: ratingEntry?.total_reviews ?? 0,
            distanceKm: computeDistanceKm(location, entry.doctor),
          } satisfies RecommendedDoctor,
        };
      })
      .sort((left, right) => {
        if (left.nameScore !== right.nameScore) {
          return right.nameScore - left.nameScore;
        }

        if (left.specialtyScore !== right.specialtyScore) {
          return right.specialtyScore - left.specialtyScore;
        }

        if (left.recommendation.distanceKm != null && right.recommendation.distanceKm != null) {
          return left.recommendation.distanceKm - right.recommendation.distanceKm;
        }

        if (left.recommendation.distanceKm != null) {
          return -1;
        }

        if (right.recommendation.distanceKm != null) {
          return 1;
        }

        if (left.recommendation.rating !== right.recommendation.rating) {
          return right.recommendation.rating - left.recommendation.rating;
        }

        return right.recommendation.reviews - left.recommendation.reviews;
      })
      .slice(0, limit)
      .map((entry) => entry.recommendation);
  } catch {
    return [];
  }
}
