import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import PublicPrescriptionPageClient from "@/components/prescriptions/PublicPrescriptionPageClient";
import type { VisitPrescription, VisitPrescriptionItem } from "@/components/prescriptions/types";
import { sortPrescriptionItems } from "@/components/prescriptions/types";
import { buildPrescriptionPublicUrl } from "@/utils/prescriptions/publicUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const PUBLIC_PRESCRIPTION_FETCH_TIMEOUT_MS = 15_000;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Ordonnance TIRYAQ",
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        "max-snippet": 0,
      },
    },
  };
}

type PrescriptionPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ print?: string }>;
};

function normalizePrescriptionRecord(record: {
  id: string;
  visit_id?: string | null;
  dossier_id?: string | null;
  doctor_id: string;
  patient_id: string | null;
  patient_registration_number?: string | null;
  prescription_number: string;
  public_token: string;
  prescription_date: string;
  patient_display_name: string;
  doctor_display_name: string;
  doctor_specialty: string | null;
  doctor_address: string | null;
  doctor_phone: string | null;
  signature_label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: VisitPrescriptionItem[] | null;
  dossier?: { patient_registration_number: string | null } | { patient_registration_number: string | null }[] | null;
}): VisitPrescription {
  const normalizedDossier = Array.isArray(record.dossier) ? (record.dossier[0] ?? null) : (record.dossier ?? null);
  return {
    ...record,
    visit_id: record.visit_id ?? null,
    dossier_id: record.dossier_id ?? null,
    patient_registration_number: record.patient_registration_number ?? normalizedDossier?.patient_registration_number ?? null,
    items: sortPrescriptionItems(record.items ?? []),
  };
}

export default async function PublicPrescriptionPage({ params, searchParams }: PrescriptionPageProps) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const runtimeOrigin = host
    ? `${forwardedProto ?? (host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("172.") ? "http" : "https")}://${host}`
    : null;
  const backendOrigin = process.env.BACKEND_ORIGIN?.trim() || process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() || "";
  const primaryLookupUrl = backendOrigin
    ? `${backendOrigin.replace(/\/+$/, "")}/api/public-prescriptions/${token}`
    : runtimeOrigin
      ? `${runtimeOrigin}/api/public-prescriptions/${token}`
      : null;

  if (!primaryLookupUrl) {
    notFound();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PUBLIC_PRESCRIPTION_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(primaryLookupUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch {
    notFound();
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    notFound();
  }

  const data = await response.json();
  const prescription = normalizePrescriptionRecord(data as VisitPrescription);
  const publicUrl = buildPrescriptionPublicUrl(prescription.public_token, {
    configuredOrigin: process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_BASE_URL?.trim(),
    runtimeOrigin,
  })!;
  const isPrintMode = resolvedSearchParams.print === "1";

  return <PublicPrescriptionPageClient prescription={prescription} publicUrl={publicUrl} isPrintMode={isPrintMode} />;
}
