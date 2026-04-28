import type { DoctorRow, UserLocation } from "./types";

export function computeDistanceKm(userLocation: UserLocation | null, doctor: DoctorRow): number | null {
  if (!userLocation || doctor.latitude == null || doctor.longitude == null) {
    return null;
  }

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(doctor.latitude - userLocation.lat);
  const dLon = toRadians(doctor.longitude - userLocation.lng);
  const lat1 = toRadians(userLocation.lat);
  const lat2 = toRadians(doctor.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}
