import { redirect } from "next/navigation";

type LegacyDashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toQueryString(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry) {
          params.append(key, entry);
        }
      }
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export default async function LegacyDoctorDashboardPage({
  searchParams,
}: LegacyDashboardPageProps) {
  redirect(`/doctor-dashboard${toQueryString(await searchParams)}`);
}
