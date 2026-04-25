// Generate a Submissions Report PDF (Arabic, RTL).
// Uses jsPDF + canvas-based text rendering so Arabic shows up correctly without bundling fonts.
import { jsPDF } from "jspdf";

export interface SubmissionRow {
  national_id: string;
  full_name: string;
  status_label: string;
  is_late: boolean;
  submitted_at: string | null;
  reviewer_notes: string | null;
}

export interface ReportMeta {
  title: string;
  course_name: string;
  due_date: string | null;
  generated_at: string;
}

/** Render a string of text as a PNG dataURL via a canvas. */
function renderTextLine(
  text: string,
  opts: { width: number; height: number; fontPx: number; bold?: boolean; align?: "right" | "left" | "center"; color?: string }
): string {
  const canvas = document.createElement("canvas");
  // Use device pixel ratio = 2 for crisp text
  const dpr = 2;
  canvas.width = Math.ceil(opts.width * dpr);
  canvas.height = Math.ceil(opts.height * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "transparent";
  ctx.clearRect(0, 0, opts.width, opts.height);
  ctx.fillStyle = opts.color ?? "#0f172a";
  ctx.font = `${opts.bold ? "bold " : ""}${opts.fontPx}px "Tajawal","Cairo","Segoe UI","Helvetica","Arial",sans-serif`;
  ctx.textBaseline = "middle";
  ctx.direction = "rtl" as CanvasDirection;
  const x =
    opts.align === "left" ? 4 : opts.align === "center" ? opts.width / 2 : opts.width - 4;
  ctx.textAlign = (opts.align ?? "right") as CanvasTextAlign;
  ctx.fillText(text, x, opts.height / 2);
  return canvas.toDataURL("image/png");
}

export async function generateSubmissionsPdf(meta: ReportMeta, rows: SubmissionRow[]): Promise<Blob> {
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 32;
  const contentW = pageW - margin * 2;

  // Header band
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageW, 64, "F");
  const titleImg = renderTextLine(meta.title, {
    width: contentW,
    height: 36,
    fontPx: 22,
    bold: true,
    color: "#ffffff",
    align: "right",
  });
  pdf.addImage(titleImg, "PNG", margin, 14, contentW, 36);

  // Sub-meta line
  let y = 80;
  const sub = `المقرر: ${meta.course_name}${
    meta.due_date ? "  ·  الموعد النهائي: " + meta.due_date : ""
  }  ·  تاريخ التقرير: ${meta.generated_at}`;
  const subImg = renderTextLine(sub, {
    width: contentW,
    height: 22,
    fontPx: 13,
    color: "#475569",
    align: "right",
  });
  pdf.addImage(subImg, "PNG", margin, y, contentW, 22);
  y += 32;

  // Table column widths (in pt). Total = contentW.
  // Order in RTL visually: [#, الاسم, الرقم القومي, الحالة, التسليم]
  // Internally we draw left-to-right, but each cell is rendered RTL via canvas.
  const colWidths = [40, 180, 110, 90, 110];
  const sumW = colWidths.reduce((a, b) => a + b, 0);
  const scale = contentW / sumW;
  const cw = colWidths.map((w) => w * scale);
  const headers = ["م", "اسم الطالب", "الرقم القومي", "الحالة", "موعد التسليم"];
  const headerH = 26;
  const rowH = 22;

  const drawHeader = () => {
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, y, contentW, headerH, "F");
    pdf.setDrawColor(203, 213, 225);
    pdf.rect(margin, y, contentW, headerH);
    let x = margin;
    for (let i = 0; i < headers.length; i++) {
      const img = renderTextLine(headers[i], {
        width: cw[i],
        height: headerH,
        fontPx: 12,
        bold: true,
        color: "#0f172a",
        align: "center",
      });
      pdf.addImage(img, "PNG", x, y, cw[i], headerH);
      x += cw[i];
    }
    y += headerH;
  };

  drawHeader();

  rows.forEach((row, idx) => {
    if (y + rowH > pageH - margin) {
      pdf.addPage();
      y = margin;
      drawHeader();
    }
    // Row separator
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + rowH, margin + contentW, y + rowH);
    const cells = [
      String(idx + 1),
      row.full_name || "—",
      row.national_id || "—",
      row.status_label + (row.is_late ? " (متأخر)" : ""),
      row.submitted_at ? new Date(row.submitted_at).toLocaleDateString("ar-EG") : "—",
    ];
    let x = margin;
    for (let i = 0; i < cells.length; i++) {
      const img = renderTextLine(cells[i], {
        width: cw[i],
        height: rowH,
        fontPx: 11,
        color: i === 3 && cells[i].includes("متأخر") ? "#b91c1c" : "#1f2937",
        align: i === 0 ? "center" : "right",
      });
      pdf.addImage(img, "PNG", x, y, cw[i], rowH);
      x += cw[i];
    }
    y += rowH;
  });

  // Footer
  const footer = `إجمالي الطلاب: ${rows.length}  ·  منصة التسليم - كلية العلاج الطبيعي جامعة قنا`;
  const fImg = renderTextLine(footer, {
    width: contentW,
    height: 18,
    fontPx: 10,
    color: "#64748b",
    align: "center",
  });
  pdf.addImage(fImg, "PNG", margin, pageH - margin, contentW, 18);

  return pdf.output("blob");
}
