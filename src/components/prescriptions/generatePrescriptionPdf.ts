import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { PrescriptionPrintTexts } from "./PrescriptionPrintView";
import type { VisitPrescription } from "./types";
import { formatPatientRegistrationNumber, formatPrescriptionItemLine, sortPrescriptionItems } from "./types";

type GeneratePrescriptionPdfOptions = {
  prescription: VisitPrescription;
  publicUrl?: string;
  texts: PrescriptionPrintTexts;
  locale?: string;
  fileName: string;
};

const PAGE_MARGIN = 8;
const CONTENT_PADDING = 6;
const SHEET_RADIUS = 6;
const BOX_RADIUS = 4;

const COLORS = {
  border: [15, 23, 42] as const,
  lightBorder: [226, 232, 240] as const,
  softFill: [248, 250, 252] as const,
  label: [148, 163, 184] as const,
  text: [15, 23, 42] as const,
  muted: [71, 85, 105] as const,
  brand: [37, 99, 235] as const,
};

let logoDataUrlPromise: Promise<string | null> | null = null;
let tahomaFontsPromise: Promise<{ regular: string | null; bold: string | null }> | null = null;

function normalizeFileName(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
}

function formatPrescriptionDate(dateValue: string, locale: string) {
  const parsedDate = new Date(`${dateValue}T12:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? dateValue : parsedDate.toLocaleDateString(locale);
}

function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to convert blob to data URL."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read the blob."));
    reader.readAsDataURL(blob);
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function getLogoDataUrl() {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch("/images/logo-light.png")
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return toDataUrl(await response.blob());
      })
      .catch(() => null);
  }

  return logoDataUrlPromise;
}

async function getTahomaFonts() {
  if (!tahomaFontsPromise) {
    tahomaFontsPromise = Promise.all([
      fetch("/fonts/tahoma.ttf")
        .then(async (response) => (response.ok ? arrayBufferToBase64(await response.arrayBuffer()) : null))
        .catch(() => null),
      fetch("/fonts/tahomabd.ttf")
        .then(async (response) => (response.ok ? arrayBufferToBase64(await response.arrayBuffer()) : null))
        .catch(() => null),
    ]).then(([regular, bold]) => ({ regular, bold }));
  }

  return tahomaFontsPromise;
}

function applyDrawColor(pdf: jsPDF, rgb: readonly [number, number, number]) {
  pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function applyFillColor(pdf: jsPDF, rgb: readonly [number, number, number]) {
  pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function applyTextColor(pdf: jsPDF, rgb: readonly [number, number, number]) {
  pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function containsArabic(value: string) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(value);
}

function normalizePdfText(pdf: jsPDF, value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return containsArabic(normalized) ? pdf.processArabic(normalized) : normalized;
}

function limitLines(lines: string[], maxLines: number) {
  if (lines.length <= maxLines) {
    return lines;
  }

  const trimmed = lines.slice(0, maxLines);
  const lastIndex = trimmed.length - 1;
  trimmed[lastIndex] = `${trimmed[lastIndex].replace(/\.\.\.$/, "").trimEnd()}...`;
  return trimmed;
}

function splitLines(pdf: jsPDF, value: string, maxWidth: number, maxLines?: number) {
  const normalized = normalizePdfText(pdf, value);
  if (!normalized) {
    return [];
  }

  const split = pdf.splitTextToSize(normalized, maxWidth) as string[];
  return typeof maxLines === "number" ? limitLines(split, maxLines) : split;
}

function setPdfFont(pdf: jsPDF, style: "normal" | "bold" = "normal") {
  pdf.setFont("TahomaPdf", style);
}

async function ensurePdfFonts(pdf: jsPDF) {
  const { regular, bold } = await getTahomaFonts();

  if (!regular) {
    return;
  }

  pdf.addFileToVFS("TahomaPdf-Regular.ttf", regular);
  pdf.addFont("TahomaPdf-Regular.ttf", "TahomaPdf", "normal");

  if (bold) {
    pdf.addFileToVFS("TahomaPdf-Bold.ttf", bold);
    pdf.addFont("TahomaPdf-Bold.ttf", "TahomaPdf", "bold");
  }
}

function drawRoundedBox(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = BOX_RADIUS,
  filled = true
) {
  applyDrawColor(pdf, COLORS.lightBorder);
  pdf.setLineWidth(0.3);

  if (filled) {
    applyFillColor(pdf, COLORS.softFill);
    pdf.roundedRect(x, y, width, height, radius, radius, "FD");
  } else {
    pdf.roundedRect(x, y, width, height, radius, radius, "S");
  }
}

export async function generatePrescriptionPdf({
  prescription,
  publicUrl,
  texts,
  locale = "fr-FR",
  fileName,
}: GeneratePrescriptionPdfOptions) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  await ensurePdfFonts(pdf);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const sheetX = PAGE_MARGIN;
  const sheetY = PAGE_MARGIN;
  const sheetWidth = pageWidth - PAGE_MARGIN * 2;
  const sheetHeight = pageHeight - PAGE_MARGIN * 2;
  const contentX = sheetX + CONTENT_PADDING;
  const contentY = sheetY + CONTENT_PADDING;
  const contentWidth = sheetWidth - CONTENT_PADDING * 2;
  const sheetBottom = sheetY + sheetHeight;
  const documentDate = formatPrescriptionDate(prescription.prescription_date, locale);
  const patientIdentifier = formatPatientRegistrationNumber(prescription.patient_registration_number) ?? prescription.prescription_number;
  const logoDataUrl = await getLogoDataUrl();
  const qrDataUrl = publicUrl
    ? await QRCode.toDataURL(publicUrl, {
        margin: 1,
        width: 256,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      }).catch(() => "")
    : "";

  const printableItems = (() => {
    const ordered = sortPrescriptionItems(prescription.items ?? []);
    return ordered.length > 0
      ? ordered
      : [
          {
            id: "placeholder-1",
            line_number: 1,
            medication_name: "",
            dosage: "",
            instructions: "",
            duration: "",
          },
        ];
  })();

  applyFillColor(pdf, [255, 255, 255]);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  applyDrawColor(pdf, COLORS.border);
  pdf.setLineWidth(0.55);
  pdf.roundedRect(sheetX, sheetY, sheetWidth, sheetHeight, SHEET_RADIUS, SHEET_RADIUS, "S");

  const headerY = contentY;
  const headerHeight = 52;
  const doctorCardWidth = 62;
  const headerGap = 6;
  const leftHeaderWidth = contentWidth - doctorCardWidth - headerGap;
  const doctorCardX = contentX + leftHeaderWidth + headerGap;

  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, "PNG", contentX, headerY + 2, 28, 10);
  } else {
    applyTextColor(pdf, COLORS.brand);
    setPdfFont(pdf, "bold");
    pdf.setFontSize(15);
    pdf.text("TIRYAQ", contentX, headerY + 8);
  }

  applyDrawColor(pdf, COLORS.lightBorder);
  pdf.setLineWidth(0.25);
  pdf.line(contentX + 32, headerY + 1, contentX + 32, headerY + headerHeight - 2);

  const titleX = contentX + 36;
  applyTextColor(pdf, COLORS.text);
  setPdfFont(pdf, "bold");
  pdf.setFontSize(14.5);
  const titleLines = splitLines(pdf, texts.platformTagline, leftHeaderWidth - 40, 2);
  pdf.text(titleLines, titleX, headerY + 7);

  setPdfFont(pdf, "normal");
  pdf.setFontSize(8.1);
  applyTextColor(pdf, COLORS.muted);
  const descriptionY = headerY + (titleLines.length > 1 ? 18 : 14);
  const descriptionLines = splitLines(pdf, texts.structuredDescription, leftHeaderWidth - 40, 4);
  pdf.text(descriptionLines, titleX, descriptionY);

  drawRoundedBox(pdf, doctorCardX, headerY, doctorCardWidth, headerHeight, BOX_RADIUS, true);

  const doctorName = `Dr. ${prescription.doctor_display_name || texts.doctorFallback}`;
  setPdfFont(pdf, "bold");
  pdf.setFontSize(11.2);
  applyTextColor(pdf, COLORS.text);
  pdf.text(splitLines(pdf, doctorName, doctorCardWidth - 8, 2), doctorCardX + 4, headerY + 7);

  setPdfFont(pdf, "bold");
  pdf.setFontSize(8.1);
  applyTextColor(pdf, COLORS.muted);
  const specialtyLabel = (prescription.doctor_specialty || texts.specialtyFallback).toUpperCase();
  pdf.text(splitLines(pdf, specialtyLabel, doctorCardWidth - 8, 2), doctorCardX + 4, headerY + 14);

  let doctorMetaY = headerY + 20;

  if (prescription.doctor_address?.trim()) {
    setPdfFont(pdf, "bold");
    pdf.setFontSize(6.5);
    applyTextColor(pdf, COLORS.label);
    pdf.text(normalizePdfText(pdf, `${texts.addressLabel}:`), doctorCardX + 4, doctorMetaY);
    doctorMetaY += 3.4;

    setPdfFont(pdf, "normal");
    pdf.setFontSize(6.8);
    applyTextColor(pdf, COLORS.muted);
    const addressLines = limitLines(splitLines(pdf, prescription.doctor_address, doctorCardWidth - 8), 2);
    pdf.text(addressLines, doctorCardX + 4, doctorMetaY);
    doctorMetaY += addressLines.length * 3.2 + 1.2;
  }

  if (prescription.doctor_phone?.trim()) {
    setPdfFont(pdf, "bold");
    pdf.setFontSize(6.5);
    applyTextColor(pdf, COLORS.label);
    pdf.text(normalizePdfText(pdf, `${texts.phoneLabel}:`), doctorCardX + 4, doctorMetaY);
    doctorMetaY += 3.2;

    setPdfFont(pdf, "normal");
    pdf.setFontSize(7);
    applyTextColor(pdf, COLORS.muted);
    pdf.text(splitLines(pdf, prescription.doctor_phone, doctorCardWidth - 8, 1), doctorCardX + 4, doctorMetaY);
  }

  const numberBoxHeight = 10;
  const numberBoxY = headerY + headerHeight - numberBoxHeight - 2.6;
  drawRoundedBox(pdf, doctorCardX + 4, numberBoxY, doctorCardWidth - 8, numberBoxHeight, 3, false);
  setPdfFont(pdf, "bold");
  pdf.setFontSize(7.2);
  applyTextColor(pdf, COLORS.label);
  pdf.text(texts.numberLabel.toUpperCase(), doctorCardX + 7, numberBoxY + 4.1);
  pdf.setFontSize(11);
  applyTextColor(pdf, COLORS.text);
  pdf.text(patientIdentifier, doctorCardX + doctorCardWidth - 7, numberBoxY + 7.5, {
    align: "right",
  });

  applyDrawColor(pdf, COLORS.border);
  pdf.setLineWidth(0.45);
  const headerDividerY = headerY + headerHeight + 4;
  pdf.line(contentX, headerDividerY, contentX + contentWidth, headerDividerY);

  const infoY = headerDividerY + 5;
  const infoHeight = 15;
  const infoGap = 5;
  const infoBoxWidth = (contentWidth - infoGap) / 2;

  drawRoundedBox(pdf, contentX, infoY, infoBoxWidth, infoHeight);
  drawRoundedBox(pdf, contentX + infoBoxWidth + infoGap, infoY, infoBoxWidth, infoHeight);

  setPdfFont(pdf, "bold");
  pdf.setFontSize(6.8);
  applyTextColor(pdf, COLORS.label);
  pdf.text(texts.dateLabel.toUpperCase(), contentX + 4, infoY + 4.4);
  pdf.text(texts.patientLabel.toUpperCase(), contentX + infoBoxWidth + infoGap + 4, infoY + 4.4);

  setPdfFont(pdf, "bold");
  pdf.setFontSize(10.3);
  applyTextColor(pdf, COLORS.text);
  pdf.text(documentDate, contentX + 4, infoY + 10.8);
  pdf.text(
    splitLines(pdf, prescription.patient_display_name || texts.patientFallback, infoBoxWidth - 8, 2),
    contentX + infoBoxWidth + infoGap + 4,
    infoY + 10.8
  );

  const footerHeight = 20;
  const footerY = sheetBottom - CONTENT_PADDING - footerHeight;
  const bottomBlocksHeight = 28;
  const bottomBlocksY = footerY - bottomBlocksHeight - 5;
  const notesHeight = prescription.notes?.trim() ? 17 : 0;
  const notesY = notesHeight > 0 ? bottomBlocksY - notesHeight - 4 : bottomBlocksY;

  const rpLabelY = infoY + infoHeight + 8;
  setPdfFont(pdf, "bold");
  pdf.setFontSize(13);
  applyTextColor(pdf, COLORS.text);
  pdf.text("Rp.", contentX, rpLabelY);

  const itemsTopY = rpLabelY + 5;
  const itemsBottomY = (notesHeight > 0 ? notesY : bottomBlocksY) - 4;
  const displayedRowCount = Math.max(printableItems.length, 3);
  const rowHeight = Math.max(11, Math.min(16, (itemsBottomY - itemsTopY) / displayedRowCount));
  const circleX = contentX + 5.2;
  const textX = contentX + 12;
  const lineEndX = contentX + contentWidth - 1.2;

  printableItems.slice(0, displayedRowCount).forEach((item, index) => {
    const rowY = itemsTopY + index * rowHeight;
    const lineText = formatPrescriptionItemLine({
      medication_name: item.medication_name || "",
      dosage: item.dosage || "",
      instructions: item.instructions || "",
      duration: item.duration || "",
    });

    pdf.setLineWidth(0.35);
    applyDrawColor(pdf, COLORS.lightBorder);
    pdf.circle(circleX, rowY + rowHeight * 0.45, 3.4, "S");
    setPdfFont(pdf, "bold");
    pdf.setFontSize(8.2);
    applyTextColor(pdf, COLORS.text);
    pdf.text(String(index + 1), circleX, rowY + rowHeight * 0.45 + 1, { align: "center" });

    setPdfFont(pdf, lineText ? "bold" : "normal");
    pdf.setFontSize(8.7);
    applyTextColor(pdf, lineText ? COLORS.text : COLORS.label);
    const itemLines = lineText
      ? splitLines(pdf, lineText, lineEndX - textX - 1, rowHeight < 12 ? 2 : 3)
      : ["................................................................................................"];
    pdf.text(itemLines, textX, rowY + 4.5);

    pdf.setLineDashPattern([1.1, 1.1], 0);
    pdf.line(textX, rowY + rowHeight - 2, lineEndX, rowY + rowHeight - 2);
    pdf.setLineDashPattern([], 0);
  });

  if (notesHeight > 0) {
    drawRoundedBox(pdf, contentX, notesY, contentWidth, notesHeight);
    setPdfFont(pdf, "bold");
    pdf.setFontSize(6.6);
    applyTextColor(pdf, COLORS.label);
    pdf.text(texts.observationsLabel.toUpperCase(), contentX + 4, notesY + 4.1);
    setPdfFont(pdf, "normal");
    pdf.setFontSize(8.3);
    applyTextColor(pdf, COLORS.text);
    pdf.text(limitLines(splitLines(pdf, prescription.notes ?? "", contentWidth - 8), 4), contentX + 4, notesY + 9);
  }

  const signatureWidth = 56;
  const documentWidth = contentWidth - signatureWidth - 5;

  drawRoundedBox(pdf, contentX, bottomBlocksY, documentWidth, bottomBlocksHeight, BOX_RADIUS, false);
  drawRoundedBox(pdf, contentX + documentWidth + 5, bottomBlocksY, signatureWidth, bottomBlocksHeight, BOX_RADIUS, false);

  setPdfFont(pdf, "bold");
  pdf.setFontSize(6.6);
  applyTextColor(pdf, COLORS.label);
  pdf.text(texts.documentLabel.toUpperCase(), contentX + 4, bottomBlocksY + 4.1);
  pdf.text(texts.signatureLabel.toUpperCase(), contentX + documentWidth + 9, bottomBlocksY + 4.1);

  setPdfFont(pdf, "normal");
  pdf.setFontSize(8.1);
  applyTextColor(pdf, COLORS.muted);
  pdf.text(limitLines(splitLines(pdf, texts.documentBody, documentWidth - 8), 4), contentX + 4, bottomBlocksY + 10);

  applyDrawColor(pdf, COLORS.lightBorder);
  pdf.setLineDashPattern([1, 1], 0);
  pdf.line(
    contentX + documentWidth + 9,
    bottomBlocksY + bottomBlocksHeight - 10,
    contentX + documentWidth + signatureWidth - 5,
    bottomBlocksY + bottomBlocksHeight - 10
  );
  pdf.setLineDashPattern([], 0);

  setPdfFont(pdf, "bold");
  pdf.setFontSize(9.3);
  applyTextColor(pdf, COLORS.text);
  pdf.text(
    splitLines(pdf, prescription.signature_label || prescription.doctor_display_name, signatureWidth - 10, 2),
    contentX + documentWidth + signatureWidth - 5,
    bottomBlocksY + bottomBlocksHeight - 6,
    { align: "right" }
  );
  setPdfFont(pdf, "normal");
  pdf.setFontSize(7.5);
  applyTextColor(pdf, COLORS.muted);
  pdf.text(
    splitLines(pdf, prescription.doctor_specialty || "TIRYAQ", signatureWidth - 10, 1),
    contentX + documentWidth + signatureWidth - 5,
    bottomBlocksY + bottomBlocksHeight - 2.5,
    { align: "right" }
  );

  applyDrawColor(pdf, COLORS.border);
  pdf.setLineWidth(0.45);
  pdf.line(contentX, footerY, contentX + contentWidth, footerY);

  setPdfFont(pdf, "bold");
  pdf.setFontSize(7.2);
  applyTextColor(pdf, COLORS.text);
  pdf.text(texts.generatedBy.toUpperCase(), contentX, footerY + 6);

  setPdfFont(pdf, "normal");
  pdf.setFontSize(7.7);
  applyTextColor(pdf, COLORS.muted);
  pdf.text(limitLines(splitLines(pdf, texts.securedBy, 78), 2), contentX, footerY + 11);

  const secureBoxWidth = 68;
  const secureBoxX = contentX + contentWidth - secureBoxWidth;
  drawRoundedBox(pdf, secureBoxX, footerY + 2.5, secureBoxWidth, 15.5);

  if (qrDataUrl) {
    pdf.addImage(qrDataUrl, "PNG", secureBoxX + 2.5, footerY + 4.3, 11.5, 11.5);
  } else {
    applyDrawColor(pdf, COLORS.lightBorder);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(secureBoxX + 2.5, footerY + 4.3, 11.5, 11.5, 2, 2, "S");
    setPdfFont(pdf, "bold");
    pdf.setFontSize(6.5);
    applyTextColor(pdf, COLORS.label);
    pdf.text("QR", secureBoxX + 8.25, footerY + 11.4, { align: "center" });
  }

  setPdfFont(pdf, "bold");
  pdf.setFontSize(6.6);
  applyTextColor(pdf, COLORS.label);
  pdf.text(texts.secureLinkLabel.toUpperCase(), secureBoxX + 17, footerY + 7);

  setPdfFont(pdf, "normal");
  pdf.setFontSize(6.7);
  applyTextColor(pdf, COLORS.muted);
  pdf.text(
    limitLines(splitLines(pdf, publicUrl || texts.secureLinkFallback, secureBoxWidth - 20), 3),
    secureBoxX + 17,
    footerY + 10.8
  );

  pdf.save(normalizeFileName(fileName));
}
