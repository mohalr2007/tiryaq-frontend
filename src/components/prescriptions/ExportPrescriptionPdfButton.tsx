'use client';

import { Download } from "lucide-react";
import { useState } from "react";
import type { PrescriptionPrintTexts } from "./PrescriptionPrintView";
import type { VisitPrescription } from "./types";
import { generatePrescriptionPdf } from "./generatePrescriptionPdf";

type ExportPrescriptionPdfButtonProps = {
  prescription: VisitPrescription;
  publicUrl?: string;
  texts: PrescriptionPrintTexts;
  locale?: string;
  fileName: string;
  label: string;
  exportingLabel: string;
  className?: string;
  onError?: (message: string) => void;
};

export default function ExportPrescriptionPdfButton({
  prescription,
  publicUrl,
  texts,
  locale,
  fileName,
  label,
  exportingLabel,
  className = "",
  onError,
}: ExportPrescriptionPdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      await generatePrescriptionPdf({
        prescription,
        publicUrl,
        texts,
        locale,
        fileName,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to export the PDF.";

      if (onError) {
        onError(message);
      } else {
        console.error(message);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        void handleExport();
      }}
      disabled={isExporting}
      className={className}
    >
      <Download size={16} />
      {isExporting ? exportingLabel : label}
    </button>
  );
}
