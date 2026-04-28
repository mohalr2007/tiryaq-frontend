'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, ExternalLink, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import ExportPrescriptionPdfButton from "./ExportPrescriptionPdfButton";
import PrescriptionPrintView, { type PrescriptionPrintTexts } from "./PrescriptionPrintView";
import type { VisitPrescription, VisitPrescriptionDraft, VisitPrescriptionItemDraft } from "./types";
import { isPrivatePrescriptionPublicUrl, isSecurePrescriptionPublicUrl } from "@/utils/prescriptions/publicUrl";
import {
  createEmptyPrescriptionItem,
  createPrescriptionDraft,
  formatPrescriptionItemLine,
} from "./types";

const DOSAGE_UNITS = ["mg", "g", "ml", "cuillere(s)", "comprime(s)", "capsule(s)", "goutte(s)", "ampoule(s)", "sachet(s)"] as const;
const DURATION_UNITS = ["jour(s)", "semaine(s)", "mois", "prise(s)"] as const;

function parseStructuredField(
  rawValue: string | null | undefined,
  knownUnits: readonly string[]
) {
  const normalized = (rawValue ?? "").trim();

  if (!normalized) {
    return { value: "", unit: "" };
  }

  const sortedUnits = [...knownUnits].sort((left, right) => right.length - left.length);
  const matchedUnit = sortedUnits.find((unit) => normalized.toLowerCase().endsWith(` ${unit.toLowerCase()}`));

  if (!matchedUnit) {
    return { value: normalized, unit: "" };
  }

  return {
    value: normalized.slice(0, -matchedUnit.length).trim(),
    unit: matchedUnit,
  };
}

function buildStructuredField(value: string, unit: string) {
  const trimmedValue = value.trim();
  const trimmedUnit = unit.trim();

  if (!trimmedValue && !trimmedUnit) {
    return "";
  }

  if (!trimmedValue) {
    return trimmedUnit;
  }

  if (!trimmedUnit) {
    return trimmedValue;
  }

  return `${trimmedValue} ${trimmedUnit}`.trim();
}

type VisitPrescriptionModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  draftResetKey: string;
  prescription: VisitPrescription | null;
  publicUrl: string | null;
  buildPublicUrl: (publicToken: string | null | undefined) => string | null;
  defaultPatientName: string;
  defaultPatientRegistrationNumber: string;
  defaultDoctorName: string;
  defaultDoctorSpecialty: string;
  defaultDoctorAddress: string;
  defaultDoctorPhone: string;
  defaultDate: string;
  onClose: () => void;
  onSave: (
    draft: VisitPrescriptionDraft,
    options?: { closeAfterSave?: boolean; quiet?: boolean }
  ) => Promise<VisitPrescription | null | void> | VisitPrescription | null | void;
  onNotify: (message: string, type?: "success" | "error" | "info") => void;
};

export default function VisitPrescriptionModal({
  isOpen,
  isSaving,
  draftResetKey,
  prescription,
  publicUrl,
  buildPublicUrl,
  defaultPatientName,
  defaultPatientRegistrationNumber,
  defaultDoctorName,
  defaultDoctorSpecialty,
  defaultDoctorAddress,
  defaultDoctorPhone,
  defaultDate,
  onClose,
  onSave,
  onNotify,
}: VisitPrescriptionModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <VisitPrescriptionModalContent
      isSaving={isSaving}
      draftResetKey={draftResetKey}
      prescription={prescription}
      publicUrl={publicUrl}
      buildPublicUrl={buildPublicUrl}
      defaultPatientName={defaultPatientName}
      defaultPatientRegistrationNumber={defaultPatientRegistrationNumber}
      defaultDoctorName={defaultDoctorName}
      defaultDoctorSpecialty={defaultDoctorSpecialty}
      defaultDoctorAddress={defaultDoctorAddress}
      defaultDoctorPhone={defaultDoctorPhone}
      defaultDate={defaultDate}
      onClose={onClose}
      onSave={onSave}
      onNotify={onNotify}
    />
  );
}

type VisitPrescriptionModalContentProps = Omit<VisitPrescriptionModalProps, "isOpen">;

type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

function serializeDraft(draft: VisitPrescriptionDraft) {
  return JSON.stringify({
    prescription_date: draft.prescription_date,
    patient_display_name: draft.patient_display_name.trim(),
    doctor_display_name: draft.doctor_display_name.trim(),
    doctor_specialty: draft.doctor_specialty.trim(),
    doctor_address: draft.doctor_address.trim(),
    doctor_phone: draft.doctor_phone.trim(),
    signature_label: draft.signature_label.trim(),
    notes: draft.notes.trim(),
    items: draft.items.map((item, index) => ({
      line_number: index + 1,
      medication_name: item.medication_name.trim(),
      dosage: item.dosage.trim(),
      instructions: item.instructions.trim(),
      duration: item.duration.trim(),
    })),
  });
}

function canPersistDraft(draft: VisitPrescriptionDraft) {
  return (
    draft.patient_display_name.trim().length > 0 &&
    draft.doctor_display_name.trim().length > 0 &&
    draft.items.some((item) => item.medication_name.trim().length > 0)
  );
}

function VisitPrescriptionModalContent({
  isSaving,
  draftResetKey,
  prescription,
  publicUrl,
  buildPublicUrl,
  defaultPatientName,
  defaultPatientRegistrationNumber,
  defaultDoctorName,
  defaultDoctorSpecialty,
  defaultDoctorAddress,
  defaultDoctorPhone,
  defaultDate,
  onClose,
  onSave,
  onNotify,
}: VisitPrescriptionModalContentProps) {
  const { language } = useI18n();
  const tr = useCallback(
    (fr: string, en: string, ar: string) =>
      language === "ar" ? ar : language === "en" ? en : fr,
    [language]
  );

  const sourceDraft = useMemo(
    () =>
      createPrescriptionDraft({
        prescription,
        patientDisplayName: defaultPatientName,
        doctorDisplayName: defaultDoctorName,
        doctorSpecialty: defaultDoctorSpecialty,
        doctorAddress: defaultDoctorAddress,
        doctorPhone: defaultDoctorPhone,
        defaultDate,
      }),
    [
      prescription,
      defaultPatientName,
      defaultDoctorName,
      defaultDoctorSpecialty,
      defaultDoctorAddress,
      defaultDoctorPhone,
      defaultDate,
    ]
  );

  const [draft, setDraft] = useState<VisitPrescriptionDraft>(sourceDraft);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>(prescription ? "saved" : "idle");
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef<string | null>(prescription ? serializeDraft(sourceDraft) : null);
  const saveAttemptRef = useRef(0);
  const sourceDraftRef = useRef(sourceDraft);
  const sourceStartsSavedRef = useRef(Boolean(prescription));

  useEffect(() => {
    sourceDraftRef.current = sourceDraft;
    sourceStartsSavedRef.current = Boolean(prescription);
  }, [sourceDraft, prescription]);

  useEffect(() => {
    setDraft(sourceDraftRef.current);
    setAutosaveError(null);
    setAutosaveStatus(sourceStartsSavedRef.current ? "saved" : "idle");
    lastSavedSnapshotRef.current = sourceStartsSavedRef.current ? serializeDraft(sourceDraftRef.current) : null;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, [draftResetKey]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const persistDraft = useCallback(
    async (currentDraft: VisitPrescriptionDraft, options?: { quiet?: boolean }) => {
      const normalizedSnapshot = serializeDraft(currentDraft);
      const result = await onSave(currentDraft, {
        closeAfterSave: false,
        quiet: options?.quiet ?? false,
      });

      if (!result) {
        return null;
      }

      lastSavedSnapshotRef.current = normalizedSnapshot;
      setAutosaveError(null);
      setAutosaveStatus("saved");
      return result;
    },
    [onSave]
  );

  useEffect(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const currentSnapshot = serializeDraft(draft);

    if (currentSnapshot === lastSavedSnapshotRef.current) {
      setAutosaveStatus((current) => (current === "error" ? current : lastSavedSnapshotRef.current ? "saved" : "idle"));
      return;
    }

    setAutosaveStatus("dirty");

    if (!canPersistDraft(draft) || isSaving) {
      return;
    }

    autosaveTimerRef.current = setTimeout(() => {
      const attemptId = ++saveAttemptRef.current;
      setAutosaveStatus("saving");
      setAutosaveError(null);

      void persistDraft(draft, { quiet: true }).then((result) => {
        if (attemptId !== saveAttemptRef.current) {
          return;
        }

        if (!result) {
          setAutosaveStatus("error");
          setAutosaveError(
            tr(
              "L'enregistrement automatique a échoué. Utilisez le bouton Enregistrer pour réessayer.",
              "Autosave failed. Use the Save button to retry.",
              "فشل الحفظ التلقائي. استخدم زر الحفظ للمحاولة مرة أخرى."
            )
          );
        }
      });
    }, 900);
  }, [draft, isSaving, persistDraft, prescription, tr]);

  const updateItem = (lineNumber: number, patch: Partial<VisitPrescriptionItemDraft>) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.line_number === lineNumber ? { ...item, ...patch } : item
      ),
    }));
  };

  const updateStructuredItemField = (
    lineNumber: number,
    field: "dosage" | "duration",
    nextValue: string,
    nextUnit: string
  ) => {
    updateItem(lineNumber, {
      [field]: buildStructuredField(nextValue, nextUnit),
    } as Partial<VisitPrescriptionItemDraft>);
  };

  const addItem = () => {
    setDraft((current) => ({
      ...current,
      items: [...current.items, createEmptyPrescriptionItem(current.items.length + 1)],
    }));
  };

  const removeItem = (lineNumber: number) => {
    setDraft((current) => {
      const filtered = current.items.filter((item) => item.line_number !== lineNumber);
      const reindexed = filtered.map((item, index) => ({ ...item, line_number: index + 1 }));

      return {
        ...current,
        items: reindexed.length > 0 ? reindexed : [createEmptyPrescriptionItem(1)],
      };
    });
  };

  const handleCopyLink = async () => {
    const resolvedPublicUrl = publicUrl ?? buildPublicUrl(prescription?.public_token);

    if (!resolvedPublicUrl) {
      onNotify(
        tr(
          "Enregistrez d'abord l'ordonnance pour générer son lien public.",
          "Save the prescription first to generate its public link.",
          "احفظ الوصفة أولاً لتوليد رابطها العام."
        ),
        "info"
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(resolvedPublicUrl);
      onNotify(
        tr("Lien de l'ordonnance copié.", "Prescription link copied.", "تم نسخ رابط الوصفة."),
        "success"
      );
    } catch {
      onNotify(
        tr("Impossible de copier le lien.", "Unable to copy the link.", "تعذر نسخ الرابط."),
        "error"
      );
    }
  };

  const handleManualSave = async () => {
    if (!draft.patient_display_name.trim() || !draft.doctor_display_name.trim()) {
      onNotify(
        tr(
          "Le nom du patient et du docteur sont requis.",
          "Patient and doctor names are required.",
          "اسم المريض واسم الطبيب مطلوبان."
        ),
        "error"
      );
      return;
    }

    if (!hasAtLeastOneMedication) {
      onNotify(
        tr(
          "Ajoutez au moins un médicament avant d'enregistrer l'ordonnance.",
          "Add at least one medicine before saving the prescription.",
          "أضف دواءً واحداً على الأقل قبل حفظ الوصفة."
        ),
        "error"
      );
      return;
    }

    const result = await persistDraft(draft, { quiet: false });
    if (!result) {
      setAutosaveStatus("error");
      setAutosaveError(
        tr(
          "L'enregistrement a échoué. Vérifiez les champs puis réessayez.",
          "Saving failed. Check the fields and try again.",
          "فشل الحفظ. تحقق من الحقول ثم أعد المحاولة."
        )
      );
    }
  };

  const handlePrint = async () => {
    const currentSnapshot = serializeDraft(draft);
    const resolvedPublicUrl = publicUrl ?? buildPublicUrl(prescription?.public_token);

    if (!resolvedPublicUrl || currentSnapshot !== lastSavedSnapshotRef.current) {
      if (!canPersistDraft(draft)) {
        onNotify(
          tr(
            "Complétez l'ordonnance avec au moins un médicament avant l'impression.",
            "Complete the prescription with at least one medicine before printing.",
            "أكمل الوصفة بدواء واحد على الأقل قبل الطباعة."
          ),
          "error"
        );
        return;
      }

      setIsPreparingPrint(true);
      const savedPrescription = await persistDraft(draft, { quiet: true });
      setIsPreparingPrint(false);

      if (!savedPrescription) {
        setAutosaveStatus("error");
        setAutosaveError(
          tr(
            "Impossible de préparer l'impression tant que l'ordonnance n'est pas enregistrée.",
            "Unable to prepare printing until the prescription is saved.",
            "تعذر تجهيز الطباعة ما دامت الوصفة غير محفوظة."
          )
        );
        onNotify(
          tr(
            "Impossible de préparer l'impression. Réessayez après l'enregistrement.",
            "Unable to prepare printing. Retry after saving.",
            "تعذر تجهيز الطباعة. أعد المحاولة بعد الحفظ."
          ),
          "error"
        );
        return;
      }

      const freshPublicUrl = buildPublicUrl(savedPrescription.public_token);
      if (!freshPublicUrl) {
        onNotify(
          tr(
            "Le lien public de l'ordonnance est indisponible pour le moment.",
            "The public prescription link is unavailable right now.",
            "رابط الوصفة العامة غير متاح حالياً."
          ),
          "error"
        );
        return;
      }

      window.open(`${freshPublicUrl}?print=1`, "_blank", "noopener,noreferrer");
      return;
    }

    window.open(`${resolvedPublicUrl}?print=1`, "_blank", "noopener,noreferrer");
  };

  const previewPrescription: VisitPrescription = {
    id: prescription?.id ?? "preview",
    visit_id: prescription?.visit_id ?? "preview-visit",
    dossier_id: prescription?.dossier_id ?? "preview-dossier",
    doctor_id: prescription?.doctor_id ?? "preview-doctor",
    patient_id: prescription?.patient_id ?? null,
    patient_registration_number: prescription?.patient_registration_number ?? defaultPatientRegistrationNumber ?? null,
    prescription_number: prescription?.prescription_number ?? "000000",
    public_token: prescription?.public_token ?? "preview-token",
    prescription_date: draft.prescription_date,
    patient_display_name: draft.patient_display_name,
    doctor_display_name: draft.doctor_display_name,
    doctor_specialty: draft.doctor_specialty || null,
    doctor_address: draft.doctor_address || null,
    doctor_phone: draft.doctor_phone || null,
    signature_label: draft.signature_label || null,
    notes: draft.notes || null,
    created_at: prescription?.created_at ?? new Date().toISOString(),
    updated_at: prescription?.updated_at ?? new Date().toISOString(),
    items: draft.items.map((item, index) => ({
      id: item.id ?? `preview-item-${index + 1}`,
      line_number: index + 1,
      medication_name: item.medication_name,
      dosage: item.dosage || null,
      instructions: item.instructions || null,
      duration: item.duration || null,
    })),
  };

  const hasAtLeastOneMedication = draft.items.some((item) => item.medication_name.trim().length > 0);
  const resolvedPublicUrl = publicUrl ?? buildPublicUrl(prescription?.public_token);
  const isSecurePublicUrl = isSecurePrescriptionPublicUrl(resolvedPublicUrl);
  const isPrivatePublicUrl = isPrivatePrescriptionPublicUrl(resolvedPublicUrl);
  const showSecurePresentation = isSecurePublicUrl || isPrivatePublicUrl;
  const printTexts: PrescriptionPrintTexts = {
    platformTagline: tr("Plateforme Médicale", "Medical Platform", "المنصة الطبية"),
    structuredDescription: tr(
      "Ordonnance médicale structurée, générée depuis le dossier patient de la plateforme TIRYAQ.",
      "Structured medical prescription generated from the patient's record on the TIRYAQ platform.",
      "وصفة طبية منظمة تم إنشاؤها من ملف المريض على منصة TIRYAQ."
    ),
    doctorFallback: tr("Nom du docteur", "Doctor name", "اسم الطبيب"),
    specialtyFallback: tr("Spécialité", "Specialty", "التخصص"),
    addressLabel: tr("Adresse", "Address", "العنوان"),
    phoneLabel: tr("Téléphone", "Phone", "الهاتف"),
    numberLabel: tr("ID Patient", "Patient ID", "معرف المريض"),
    dateLabel: tr("Date", "Date", "التاريخ"),
    patientLabel: tr("Nom du patient", "Patient name", "اسم المريض"),
    patientFallback: tr("Patient", "Patient", "المريض"),
    observationsLabel: tr("Observations", "Notes", "ملاحظات"),
    documentLabel: tr("Document médical", "Medical document", "وثيقة طبية"),
    documentBody: tr(
      "Cette ordonnance est conservée sous forme structurée dans TIRYAQ pour faciliter l'impression, la vérification et le suivi clinique.",
      "This prescription is stored in a structured format in TIRYAQ to simplify printing, verification, and clinical follow-up.",
      "يتم حفظ هذه الوصفة بصيغة منظمة داخل TIRYAQ لتسهيل الطباعة والتحقق والمتابعة السريرية."
    ),
    signatureLabel: tr("Tampon / Signature", "Stamp / Signature", "الختم / التوقيع"),
    generatedBy: tr("Document généré par TIRYAQ", "Document generated by TIRYAQ", "مستند تم إنشاؤه بواسطة TIRYAQ"),
    securedBy: showSecurePresentation
      ? tr("Sécurisé par QR Code pour vérification instantanée.", "Secured by QR code for instant verification.", "مؤمّن برمز QR للتحقق الفوري.")
      : tr(
          "QR Code de vérification généré. Utilisez une URL HTTPS de production pour un partage sécurisé.",
          "Verification QR code generated. Use a production HTTPS URL for secure sharing.",
          "تم إنشاء رمز التحقق QR. استخدم رابط HTTPS في بيئة الإنتاج للمشاركة الآمنة."
        ),
    secureLinkLabel: showSecurePresentation
      ? tr("Lien sécurisé", "Secure link", "الرابط الآمن")
      : tr("Lien public", "Public link", "الرابط العام"),
    secureLinkFallback: tr("Lien public disponible après enregistrement", "Public link available after saving", "الرابط العام متاح بعد الحفظ"),
  };
  const printLocale = language === "ar" ? "ar-DZ" : language === "en" ? "en-US" : "fr-FR";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-[1540px] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
              {tr("Ordonnance", "Prescription", "الوصفة الطبية")}
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
              {prescription
                ? tr("Modifier l'ordonnance", "Edit prescription", "تعديل الوصفة")
                : tr("Nouvelle ordonnance", "New prescription", "وصفة جديدة")}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {tr(
                "Les champs sont stockés en base, la vue PDF reste générée à la demande pour économiser le stockage.",
                "Fields are stored in the database, and the PDF-like view is generated on demand to save storage.",
                "يتم حفظ الحقول في قاعدة البيانات، وتُنشأ نسخة PDF عند الطلب لتقليل التخزين."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid flex-1 gap-0 overflow-hidden xl:grid-cols-[minmax(560px,0.94fr)_minmax(0,1.06fr)]">
          <div className="overflow-y-auto border-b border-slate-200 px-6 py-6 dark:border-slate-800 xl:border-b-0 xl:border-r xl:px-7">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {tr("Date", "Date", "التاريخ")}
                  </label>
                  <input
                    type="date"
                    value={draft.prescription_date}
                    onChange={(event) => setDraft((current) => ({ ...current, prescription_date: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    N°
                  </label>
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 font-black tracking-[0.22em] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {prescription?.prescription_number ?? "000000"}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  {tr("Nom du patient", "Patient name", "اسم المريض")}
                </label>
                <input
                  value={draft.patient_display_name}
                  onChange={(event) => setDraft((current) => ({ ...current, patient_display_name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {tr("Docteur", "Doctor", "الطبيب")}
                  </label>
                  <input
                    value={draft.doctor_display_name}
                    onChange={(event) => setDraft((current) => ({ ...current, doctor_display_name: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {tr("Spécialité", "Specialty", "التخصص")}
                  </label>
                  <input
                    value={draft.doctor_specialty}
                    onChange={(event) => setDraft((current) => ({ ...current, doctor_specialty: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {tr("Adresse du docteur", "Doctor address", "عنوان الطبيب")}
                  </label>
                  <input
                    value={draft.doctor_address}
                    onChange={(event) => setDraft((current) => ({ ...current, doctor_address: event.target.value }))}
                    placeholder={tr(
                      "Adresse affichée sur l'ordonnance",
                      "Address shown on the prescription",
                      "العنوان المعروض على الوصفة"
                    )}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {tr("Téléphone du docteur", "Doctor phone", "هاتف الطبيب")}
                  </label>
                  <input
                    value={draft.doctor_phone}
                    onChange={(event) => setDraft((current) => ({ ...current, doctor_phone: event.target.value }))}
                    placeholder={tr(
                      "Numéro affiché sur l'ordonnance",
                      "Phone number shown on the prescription",
                      "رقم الهاتف المعروض على الوصفة"
                    )}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  {tr("Libellé signature", "Signature label", "تسمية التوقيع")}
                </label>
                <input
                  value={draft.signature_label}
                  onChange={(event) => setDraft((current) => ({ ...current, signature_label: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                />
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-black text-slate-950 dark:text-white">
                      {tr("Médicaments", "Medicines", "الأدوية")}
                    </p>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {tr(
                        "Ajoutez les lignes utiles. Quantité, unité, durée et consignes sont guidées pour gagner du temps sans alourdir l'écran.",
                        "Add the useful lines. Quantity, unit, duration and instructions are guided to save time without crowding the screen.",
                        "أضف السطور اللازمة. الكمية والوحدة والمدة والتعليمات موجهة لتوفير الوقت دون ازدحام الشاشة."
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300"
                  >
                    <Plus size={16} />
                    {tr("Ligne", "Line", "سطر")}
                  </button>
                </div>

                <div className="space-y-5">
                  {draft.items.map((item) => {
                    const dosageField = parseStructuredField(item.dosage, DOSAGE_UNITS);
                    const durationField = parseStructuredField(item.duration, DURATION_UNITS);

                    return (
                    <div key={item.line_number} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-black text-slate-900 dark:text-white">
                          {tr(`Médicament ${item.line_number}`, `Medicine ${item.line_number}`, `الدواء ${item.line_number}`)}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                            {tr("Ligne structurée", "Structured line", "سطر منظم")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.line_number)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 dark:border-slate-700 dark:hover:border-rose-900/40 dark:hover:bg-rose-950/20"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <input
                          value={item.medication_name}
                          onChange={(event) => updateItem(item.line_number, { medication_name: event.target.value })}
                          placeholder={tr("Nom du médicament", "Medicine name", "اسم الدواء")}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                        />
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                              {tr("Dosage", "Dosage", "الجرعة")}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                              <input
                                value={dosageField.value}
                                onChange={(event) =>
                                  updateStructuredItemField(item.line_number, "dosage", event.target.value, dosageField.unit)
                                }
                                placeholder={tr("Ex: 500", "Ex: 500", "مثال: 500")}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                              />
                              <select
                                value={dosageField.unit}
                                onChange={(event) =>
                                  updateStructuredItemField(item.line_number, "dosage", dosageField.value, event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                              >
                                <option value="">{tr("Unité", "Unit", "الوحدة")}</option>
                                {DOSAGE_UNITS.map((unit) => (
                                  <option key={unit} value={unit}>
                                    {unit}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                              {tr("Durée", "Duration", "المدة")}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                              <input
                                value={durationField.value}
                                onChange={(event) =>
                                  updateStructuredItemField(item.line_number, "duration", event.target.value, durationField.unit)
                                }
                                placeholder={tr("Ex: 7", "Ex: 7", "مثال: 7")}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                              />
                              <select
                                value={durationField.unit}
                                onChange={(event) =>
                                  updateStructuredItemField(item.line_number, "duration", durationField.value, event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                              >
                                <option value="">{tr("Unité", "Unit", "الوحدة")}</option>
                                {DURATION_UNITS.map((unit) => (
                                  <option key={unit} value={unit}>
                                    {unit}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                        <textarea
                          rows={3}
                          value={item.instructions}
                          onChange={(event) => updateItem(item.line_number, { instructions: event.target.value })}
                          placeholder={tr("Consignes / posologie", "Instructions / dosage", "التعليمات / الوصفة")}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                        />
                        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                          {formatPrescriptionItemLine(item) ||
                            tr(
                              "La ligne apparaîtra ici dès que vous remplirez le médicament.",
                              "The rendered line will appear here as soon as you fill the medicine.",
                              "سيظهر السطر هنا بمجرد ملء بيانات الدواء."
                            )}
                        </p>
                      </div>
                    </div>
                  )})}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  {tr("Observations", "Notes", "ملاحظات")}
                </label>
                <textarea
                  rows={3}
                  value={draft.notes}
                  onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                  placeholder={tr(
                    "Observation libre qui apparaîtra sous les médicaments si nécessaire.",
                    "Optional note displayed under the medicine list.",
                    "ملاحظة اختيارية تظهر أسفل قائمة الأدوية."
                  )}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                />
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden bg-slate-50/70 dark:bg-slate-900/40">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <p className="text-sm font-black text-slate-950 dark:text-white">
                  {tr("Prévisualisation imprimable", "Printable preview", "معاينة قابلة للطباعة")}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {resolvedPublicUrl
                    ? showSecurePresentation
                      ? tr(
                          "Le QR code et le lien public sont actifs sur cette version.",
                          "The QR code and public link are active on this version.",
                          "رمز QR والرابط العام نشطان في هذه النسخة."
                        )
                      : tr(
                          "Le QR code est actif, mais cette URL publique n'est pas encore en HTTPS.",
                          "The QR code is active, but this public URL is not using HTTPS yet.",
                          "رمز QR نشط، لكن هذا الرابط العام لا يستخدم HTTPS بعد."
                        )
                    : tr(
                        "Enregistrez une première fois pour générer le QR code et le lien public.",
                        "Save once to generate the QR code and public link.",
                        "احفظ مرة أولى لتوليد رمز QR والرابط العام."
                      )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <Copy size={16} />
                  {tr("Copier le lien", "Copy link", "نسخ الرابط")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!resolvedPublicUrl) {
                      onNotify(
                        tr(
                          "Enregistrez d'abord l'ordonnance pour ouvrir sa copie publique.",
                          "Save the prescription first to open its public copy.",
                          "احفظ الوصفة أولاً لفتح نسختها العامة."
                        ),
                        "info"
                      );
                      return;
                    }

                    window.open(resolvedPublicUrl, "_blank", "noopener,noreferrer");
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <ExternalLink size={16} />
                  {tr("Ouvrir la copie", "Open copy", "فتح النسخة")}
                </button>
                <ExportPrescriptionPdfButton
                  prescription={previewPrescription}
                  publicUrl={resolvedPublicUrl ?? undefined}
                  texts={printTexts}
                  locale={printLocale}
                  fileName={`ordonnance-${previewPrescription.prescription_number}.pdf`}
                  label={tr("Exporter PDF", "Export PDF", "تصدير PDF")}
                  exportingLabel={tr("Export...", "Exporting...", "جارٍ التصدير...")}
                  onError={() => {
                    onNotify(
                      tr(
                        "Impossible d'exporter l'ordonnance en PDF pour le moment.",
                        "Unable to export the prescription as PDF right now.",
                        "تعذر تصدير الوصفة بصيغة PDF حالياً."
                      ),
                      "error"
                    );
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                />
                <button
                  type="button"
                  disabled={isSaving || isPreparingPrint}
                  onClick={() => {
                    void handlePrint();
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
                >
                  <Printer size={16} />
                  {isPreparingPrint
                    ? tr("Préparation...", "Preparing...", "جارٍ التحضير...")
                    : tr("Imprimer", "Print", "طباعة")}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <PrescriptionPrintView
                prescription={previewPrescription}
                publicUrl={resolvedPublicUrl ?? undefined}
                texts={printTexts}
                locale={printLocale}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="space-y-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {tr(
                "Astuce: la vue PDF n'est pas stockée. Elle est reconstruite depuis les champs à chaque ouverture.",
                "Tip: the PDF-like view is not stored. It is rebuilt from the fields every time.",
                "نصيحة: لا يتم تخزين نسخة PDF. تُعاد بناؤها من الحقول في كل مرة."
              )}
            </p>
            <p className={`text-xs font-semibold ${
              autosaveStatus === "error"
                ? "text-rose-600 dark:text-rose-300"
                : autosaveStatus === "saving" || isPreparingPrint
                  ? "text-amber-600 dark:text-amber-300"
                  : autosaveStatus === "saved"
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-slate-400 dark:text-slate-500"
            }`}>
              {isPreparingPrint
                ? tr(
                    "Impression: l'ordonnance est en cours d'enregistrement.",
                    "Printing: the prescription is being saved first.",
                    "الطباعة: يتم حفظ الوصفة أولاً."
                  )
                : autosaveStatus === "saving"
                  ? tr(
                      "Enregistrement automatique en cours...",
                      "Autosaving...",
                      "جارٍ الحفظ التلقائي..."
                    )
                  : autosaveStatus === "saved"
                    ? tr(
                        "Ordonnance enregistrée automatiquement.",
                        "Prescription autosaved.",
                        "تم حفظ الوصفة تلقائياً."
                      )
                    : autosaveStatus === "error"
                      ? autosaveError
                      : tr(
                          "Les modifications sont enregistrées automatiquement dès que l'ordonnance est complète.",
                          "Changes are autosaved as soon as the prescription is complete.",
                          "يتم حفظ التعديلات تلقائياً بمجرد اكتمال الوصفة."
                        )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              {tr("Fermer", "Close", "إغلاق")}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                void handleManualSave();
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <Save size={16} />
              {isSaving
                ? tr("Enregistrement...", "Saving...", "جارٍ الحفظ...")
                : tr("Enregistrer l'ordonnance", "Save prescription", "حفظ الوصفة")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
