export type VisitPrescriptionItem = {
  id: string;
  prescription_id?: string;
  line_number: number;
  medication_name: string;
  dosage: string | null;
  instructions: string | null;
  duration: string | null;
  created_at?: string;
  updated_at?: string;
};

export type VisitPrescription = {
  id: string;
  visit_id: string | null;
  dossier_id: string | null;
  doctor_id: string;
  patient_id: string | null;
  patient_registration_number: string | null;
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
  items: VisitPrescriptionItem[];
};

export type VisitPrescriptionItemDraft = {
  id?: string;
  line_number: number;
  medication_name: string;
  dosage: string;
  instructions: string;
  duration: string;
};

export type VisitPrescriptionDraft = {
  prescription_date: string;
  patient_display_name: string;
  doctor_display_name: string;
  doctor_specialty: string;
  doctor_address: string;
  doctor_phone: string;
  signature_label: string;
  notes: string;
  items: VisitPrescriptionItemDraft[];
};

export function createEmptyPrescriptionItem(lineNumber: number): VisitPrescriptionItemDraft {
  return {
    line_number: lineNumber,
    medication_name: "",
    dosage: "",
    instructions: "",
    duration: "",
  };
}

export function sortPrescriptionItems<T extends { line_number: number }>(items: T[]) {
  return [...items].sort((left, right) => left.line_number - right.line_number);
}

export function formatPrescriptionItemLine(
  item: Pick<VisitPrescriptionItemDraft, "medication_name" | "dosage" | "instructions" | "duration">
) {
  const parts = [
    item.medication_name.trim(),
    item.dosage.trim(),
    item.instructions.trim(),
    item.duration.trim() ? `(${item.duration.trim()})` : "",
  ].filter(Boolean);

  return parts.join(" — ");
}

export function formatPatientRegistrationNumber(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length !== 13) {
    return null;
  }

  return `${digits.slice(0, 6)} ${digits.slice(6, 12)} ${digits.slice(12)}`;
}

export function createPrescriptionDraft(params: {
  prescription?: VisitPrescription | null;
  patientDisplayName: string;
  doctorDisplayName: string;
  doctorSpecialty: string;
  doctorAddress?: string;
  doctorPhone?: string;
  defaultDate: string;
}): VisitPrescriptionDraft {
  const { prescription, patientDisplayName, doctorDisplayName, doctorSpecialty, doctorAddress, doctorPhone, defaultDate } = params;

  if (prescription) {
    const existingItems = sortPrescriptionItems(prescription.items).map((item) => ({
      id: item.id,
      line_number: item.line_number,
      medication_name: item.medication_name,
      dosage: item.dosage ?? "",
      instructions: item.instructions ?? "",
      duration: item.duration ?? "",
    }));

    return {
      prescription_date: prescription.prescription_date,
      patient_display_name: prescription.patient_display_name,
      doctor_display_name: prescription.doctor_display_name,
      doctor_specialty: prescription.doctor_specialty ?? "",
      doctor_address: prescription.doctor_address ?? "",
      doctor_phone: prescription.doctor_phone ?? "",
      signature_label: prescription.signature_label ?? prescription.doctor_display_name,
      notes: prescription.notes ?? "",
      items: existingItems.length > 0 ? existingItems : [createEmptyPrescriptionItem(1)],
    };
  }

  return {
    prescription_date: defaultDate,
    patient_display_name: patientDisplayName,
    doctor_display_name: doctorDisplayName,
    doctor_specialty: doctorSpecialty,
    doctor_address: doctorAddress ?? "",
    doctor_phone: doctorPhone ?? "",
    signature_label: doctorDisplayName,
    notes: "",
    items: [createEmptyPrescriptionItem(1)],
  };
}
