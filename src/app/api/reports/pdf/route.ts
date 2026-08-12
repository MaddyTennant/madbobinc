import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { requireAction } from "@/lib/tenant";
import { toApiErrorResponse } from "@/lib/api-error";
import { generateMonthlyReport } from "@/lib/llm/report";
import { formatCurrency, formatPercent } from "@/lib/format";

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function GET() {
  try {
    const session = await requireAction("reports:view");
    const report = await generateMonthlyReport(session.workspaceId);

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page: PDFPage = pdf.addPage([612, 792]); // US Letter
    const margin = 56;
    let y = 792 - margin;
    const contentWidth = 612 - margin * 2;

    function ensureSpace(lineHeight: number) {
      if (y < margin + lineHeight) {
        page = pdf.addPage([612, 792]);
        y = 792 - margin;
      }
    }

    function drawHeading(text: string) {
      ensureSpace(24);
      page.drawText(text, { x: margin, y, size: 16, font: bold, color: rgb(0.05, 0.05, 0.05) });
      y -= 24;
    }

    function drawSubheading(text: string) {
      ensureSpace(18);
      page.drawText(text, { x: margin, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1) });
      y -= 18;
    }

    function drawParagraph(text: string, size = 10) {
      for (const line of wrapText(text, font, size, contentWidth)) {
        ensureSpace(size + 4);
        page.drawText(line, { x: margin, y, size, font, color: rgb(0.15, 0.15, 0.15) });
        y -= size + 4;
      }
      y -= 6;
    }

    drawHeading(`Monthly Spend Summary — ${report.periodLabel}`);
    y -= 4;

    drawSubheading("Key numbers");
    const s = report.summary;
    drawParagraph(`Total spend (MTD): ${formatCurrency(s.totalSpendMTD, s.currency)}`);
    drawParagraph(`Revenue (MTD): ${formatCurrency(s.revenueMTD, s.currency)}`);
    drawParagraph(`Food cost %: ${formatPercent(s.foodCostPct)}   Prime cost %: ${formatPercent(s.primeCostPct)}`);
    drawParagraph(`30-day cash-out forecast: ${formatCurrency(s.cashOutForecast30d, s.currency)}`);
    y -= 6;

    drawSubheading("Narrative");
    drawParagraph(report.narrative);

    drawSubheading("Top recommended actions");
    if (report.topActions.length === 0) {
      drawParagraph("No open AI insights this period.");
    } else {
      for (const action of report.topActions) {
        drawParagraph(`• ${action.title} — ${action.recommendation} (est. ${formatCurrency(action.estimatedImpact, s.currency)})`);
      }
    }

    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="spend-report-${s.periodLabel.replace(/\s+/g, "-")}.pdf"`,
      },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
