'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { VisitPrescription } from "./types";
import { formatPatientRegistrationNumber, formatPrescriptionItemLine, sortPrescriptionItems } from "./types";

export type PrescriptionPrintTexts = {
  platformTagline: string;
  structuredDescription: string;
  doctorFallback: string;
  specialtyFallback: string;
  addressLabel: string;
  phoneLabel: string;
  numberLabel: string;
  dateLabel: string;
  patientLabel: string;
  patientFallback: string;
  observationsLabel: string;
  documentLabel: string;
  documentBody: string;
  signatureLabel: string;
  generatedBy: string;
  securedBy: string;
  secureLinkLabel: string;
  secureLinkFallback: string;
};

type PrescriptionPrintViewProps = {
  prescription: VisitPrescription;
  publicUrl?: string;
  id?: string;
  className?: string;
  texts?: PrescriptionPrintTexts;
  locale?: string;
  onReadyChange?: (ready: boolean) => void;
};

export default function PrescriptionPrintView({
  prescription,
  publicUrl,
  id,
  className = "",
  texts,
  locale = "fr-FR",
  onReadyChange,
}: PrescriptionPrintViewProps) {
  const [qrResult, setQrResult] = useState<{
    sourceUrl: string | null;
    dataUrl: string | null;
    failed: boolean;
  }>({
    sourceUrl: null,
    dataUrl: null,
    failed: false,
  });
  const resolvedQrDataUrl = publicUrl && qrResult.sourceUrl === publicUrl ? qrResult.dataUrl : null;
  const shouldRenderQrImage = Boolean(publicUrl && resolvedQrDataUrl);

  useEffect(() => {
    let cancelled = false;
    let readinessTimeoutId: number | null = null;

    if (!publicUrl) {
      onReadyChange?.(true);
      return;
    }

    if (qrResult.sourceUrl === publicUrl && (qrResult.dataUrl || qrResult.failed)) {
      onReadyChange?.(true);
      return;
    }

    onReadyChange?.(false);

    readinessTimeoutId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      setQrResult({
        sourceUrl: publicUrl,
        dataUrl: null,
        failed: true,
      });
      onReadyChange?.(true);
    }, 2500);

    void QRCode.toDataURL(publicUrl, {
      margin: 2,
      width: 256,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    }).then((value) => {
      if (!cancelled) {
        if (readinessTimeoutId !== null) {
          window.clearTimeout(readinessTimeoutId);
        }
        setQrResult({
          sourceUrl: publicUrl,
          dataUrl: value,
          failed: false,
        });
        onReadyChange?.(true);
      }
    }).catch(() => {
      if (!cancelled) {
        if (readinessTimeoutId !== null) {
          window.clearTimeout(readinessTimeoutId);
        }
        setQrResult({
          sourceUrl: publicUrl,
          dataUrl: null,
          failed: true,
        });
        onReadyChange?.(true);
      }
    });

    return () => {
      cancelled = true;
      if (readinessTimeoutId !== null) {
        window.clearTimeout(readinessTimeoutId);
      }
    };
  }, [publicUrl, onReadyChange, qrResult.dataUrl, qrResult.failed, qrResult.sourceUrl]);

  const parsedDate = new Date(`${prescription.prescription_date}T12:00:00`);
  const documentDate = Number.isNaN(parsedDate.getTime())
    ? prescription.prescription_date
    : parsedDate.toLocaleDateString(locale);

  const orderedItems = sortPrescriptionItems(prescription.items ?? []);
  const printableItems = orderedItems.length > 0 ? orderedItems : [{
    id: "placeholder-1",
    line_number: 1,
    medication_name: "",
    dosage: "",
    instructions: "",
    duration: "",
  }];
  const patientIdentifier = formatPatientRegistrationNumber(prescription.patient_registration_number) ?? prescription.prescription_number;

  const labels: PrescriptionPrintTexts = texts ?? {
    platformTagline: "Plateforme Medicale",
    structuredDescription: "Ordonnance medicale structuree, generee depuis le dossier patient de la plateforme TIRYAQ.",
    doctorFallback: "Nom du docteur",
    specialtyFallback: "Specialite",
    addressLabel: "Adresse",
    phoneLabel: "Telephone",
    numberLabel: "N°",
    dateLabel: "Date",
    patientLabel: "Nom du patient",
    patientFallback: "Patient",
    observationsLabel: "Observations",
    documentLabel: "Document medical",
    documentBody: "Cette ordonnance est conservee sous forme structuree dans TERIAQ pour faciliter l'impression, la verification et le suivi clinique.",
    signatureLabel: "Tampon / Signature",
    generatedBy: "Document genere par TIRYAQ",
    securedBy: "Securise par QR Code pour verification instantanee.",
    secureLinkLabel: "Lien securise",
    secureLinkFallback: "Lien public disponible apres enregistrement",
  };

  return (
    <div
      id={id}
      data-prescription-sheet="true"
      className={`prescription-print-page mx-auto flex w-full max-w-[920px] flex-col overflow-hidden rounded-[18px] bg-white p-1 text-slate-900 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.4)] sm:rounded-[28px] sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none ${className}`}
    >
      <div className="prescription-print-card flex min-h-full flex-1 flex-col rounded-[18px] border-[1.5px] border-slate-800 p-3 sm:rounded-[22px] sm:p-7 print:rounded-[16px] print:border-[1.5px] print:p-5">
        <div className="grid gap-4 border-b-[1.5px] border-slate-800 pb-4 sm:gap-5 sm:pb-5 sm:grid-cols-[1.14fr_0.86fr]">
          <div className="flex flex-col items-start gap-4">
            <div className="flex h-[48px] w-[112px] shrink-0 items-center justify-start sm:h-[56px] sm:w-[138px]">
              <img src="/images/logo-light.png" alt="TIRYAQ" className="h-auto max-h-[46px] w-full object-contain object-left" />
            </div>
            <div className="min-w-0 w-full border-t border-slate-200 pt-4 sm:border-s sm:border-t-0 sm:ps-4 sm:pt-0">
              <h1 className="text-lg font-black tracking-tight text-slate-950 sm:text-[2rem]">{labels.platformTagline}</h1>
              <p className="mt-2 text-xs leading-6 text-slate-600 sm:text-sm">
                {labels.structuredDescription}
              </p>
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-black text-slate-950 sm:text-lg">
              Dr. {prescription.doctor_display_name || labels.doctorFallback}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-sm sm:tracking-[0.18em]">
              {prescription.doctor_specialty || labels.specialtyFallback}
            </p>
            {prescription.doctor_address || prescription.doctor_phone ? (
              <div className="mt-3 space-y-1.5 text-[11px] leading-5 text-slate-600">
                {prescription.doctor_address ? (
                  <p className="break-words">
                    <span className="font-semibold text-slate-500">{labels.addressLabel}: </span>
                    {prescription.doctor_address}
                  </p>
                ) : null}
                {prescription.doctor_phone ? (
                  <p className="break-words">
                    <span className="font-semibold text-slate-500">{labels.phoneLabel}: </span>
                    {prescription.doctor_phone}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 sm:mt-5 sm:px-4">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{labels.numberLabel}</span>
              <span className="text-sm font-black tracking-[0.16em] text-slate-950 sm:text-lg sm:tracking-[0.2em]">
                {patientIdentifier}
              </span>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 py-4 sm:py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{labels.dateLabel}</p>
              <p className="mt-2 text-base font-bold text-slate-950 sm:text-lg">{documentDate}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{labels.patientLabel}</p>
              <p className="mt-2 text-base font-bold text-slate-950 sm:text-lg">{prescription.patient_display_name || labels.patientFallback}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col border-b border-slate-200 py-4 sm:py-5">
          <p className="text-lg font-black text-slate-950">Rp.</p>
          <div className="mt-4 flex-1 space-y-3">
            {printableItems.map((item, index) => {
              const lineText = formatPrescriptionItemLine({
                medication_name: item.medication_name || "",
                dosage: item.dosage || "",
                instructions: item.instructions || "",
                duration: item.duration || "",
              });

              return (
                <div key={item.id || item.line_number} className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 text-sm font-black text-slate-700">
                    {index + 1}
                  </div>
                  <div className="min-h-9 flex-1 border-b border-dashed border-slate-300 pb-2">
                    <p className={`text-sm leading-7 sm:text-base ${lineText ? "font-semibold text-slate-900" : "text-transparent select-none"}`}>
                      {lineText || "................................................................................................"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {prescription.notes ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{labels.observationsLabel}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{prescription.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 py-4 sm:py-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-h-[108px] flex-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{labels.documentLabel}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {labels.documentBody}
            </p>
          </div>

          <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left sm:min-w-[210px] sm:w-auto sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{labels.signatureLabel}</p>
            <div className="mt-8 border-t border-dashed border-slate-300 pt-3">
              <p className="text-base font-bold text-slate-950">
                {prescription.signature_label || prescription.doctor_display_name}
              </p>
              <p className="mt-1 text-sm text-slate-500">{prescription.doctor_specialty || "TIRYAQ"}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t-[1.5px] border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-700">
              {labels.generatedBy}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {labels.securedBy}
            </p>
          </div>

          <div className="flex w-full flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center border border-slate-200 bg-white p-2">
              {shouldRenderQrImage ? (
                <img
                  src={resolvedQrDataUrl ?? undefined}
                  aria-label="QR Code ordonnance"
                  alt="QR Code ordonnance"
                  className="block h-full w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div className="px-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  QR
                </div>
              )}
            </div>
            <div className="max-w-full sm:max-w-[220px]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{labels.secureLinkLabel}</p>
              {publicUrl ? (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all text-xs leading-5 text-blue-600 underline-offset-2 hover:underline"
                >
                  {publicUrl}
                </a>
              ) : (
                <p className="mt-1 break-all text-xs leading-5 text-slate-500">
                  {labels.secureLinkFallback}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
