import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import PublicPrescriptionPageClient from "@/components/prescriptions/PublicPrescriptionPageClient";
import type { VisitPrescription, VisitPrescriptionItem } from "@/components/prescriptions/types";
import { sortPrescriptionItems } from "@/components/prescriptions/types";
import { buildPrescriptionPublicUrl } from "@/utils/prescriptions/publicUrl";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const admin = createAdminClient();

  const visitPrescriptionResult = await admin
    .from("visit_prescriptions")
    .select("id, visit_id, dossier_id, doctor_id, patient_id, prescription_number, public_token, prescription_date, patient_display_name, doctor_display_name, doctor_specialty, doctor_address, doctor_phone, signature_label, notes, created_at, updated_at, dossier:medical_dossiers!dossier_id(patient_registration_number), items:visit_prescription_items(id, prescription_id, line_number, medication_name, dosage, instructions, duration, created_at, updated_at)")
    .eq("public_token", token)
    .maybeSingle();

  const standalonePrescriptionResult = !visitPrescriptionResult.data
    ? await admin
        .from("standalone_prescriptions")
        .select("id, dossier_id, doctor_id, patient_id, patient_registration_number, prescription_number, public_token, prescription_date, patient_display_name, doctor_display_name, doctor_specialty, doctor_address, doctor_phone, signature_label, notes, created_at, updated_at, items:standalone_prescription_items(id, prescription_id, line_number, medication_name, dosage, instructions, duration, created_at, updated_at)")
        .eq("public_token", token)
        .maybeSingle()
    : { data: null, error: null };

  const data = visitPrescriptionResult.data ?? standalonePrescriptionResult.data;
  const error = visitPrescriptionResult.error ?? standalonePrescriptionResult.error;

  if (error || !data) {
    notFound();
  }

  const prescription = normalizePrescriptionRecord(data as unknown as VisitPrescription);
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const runtimeOrigin = host
    ? `${forwardedProto ?? (host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("172.") ? "http" : "https")}://${host}`
    : null;
  const publicUrl = buildPrescriptionPublicUrl(prescription.public_token, {
    configuredOrigin: process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_BASE_URL?.trim(),
    runtimeOrigin,
  })!;
  const isPrintMode = resolvedSearchParams.print === "1";

  return <PublicPrescriptionPageClient prescription={prescription} publicUrl={publicUrl} isPrintMode={isPrintMode} />;
}
