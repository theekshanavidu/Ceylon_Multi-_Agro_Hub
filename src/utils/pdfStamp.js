/**
 * Shared PDF Stamping logic — stamps data onto template.pdf
 * Coordinates are calibrated for Ceylon Multi Agro Hub template (595.5 × 842.25 pt A4)
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const calcSub = (r) => (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0);

function fmtDate(dateStr) {
    if (dateStr) return dateStr;
    const now = new Date();
    const day = now.getDate();
    const s = ["th", "st", "nd", "rd"][(day % 10 > 3 || Math.floor(day / 10) === 1) ? 0 : day % 10];
    return `${day}${s} ${now.toLocaleDateString("en-GB", { month: "long" })} ${now.getFullYear()}`;
}

export async function stampPDF({ issuedTo, date, currency, rows, grandTotal, invoiceNote }) {
    /* ── Load template ── */
    let tplBytes;
    try {
        const resp = await fetch("/template.pdf");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        tplBytes = await resp.arrayBuffer();
        // Validate PDF header (%PDF)
        const header = new Uint8Array(tplBytes, 0, 4);
        const isPDF = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
        if (!isPDF) throw new Error(`Not a valid PDF (got header: ${Array.from(header).map(b => String.fromCharCode(b)).join("")})`);
    } catch (e) {
        throw new Error("Could not load template.pdf: " + e.message + " | bytes received: " + (tplBytes?.byteLength ?? 0));
    }
    const pdfDoc = await PDFDocument.load(tplBytes);
    const page = pdfDoc.getPages()[0];
    // page size is 595.5 × 842.25 pt (A4) — coordinates are hardcoded below

    /* ── Fonts ── */
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontB = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    /* ── Colors ── */
    const GREEN = rgb(0.10, 0.28, 0.10);
    const BLACK = rgb(0, 0, 0);
    const WHITE = rgb(1, 1, 1);
    const GRAY = rgb(0.35, 0.35, 0.35);

    /* ── Helpers ── */
    const draw = (text, x, y, { size = 10, bold = false, color = BLACK, maxWidth } = {}) => {
        if (!text && text !== 0) return;
        page.drawText(String(text), {
            x, y, size,
            font: bold ? fontB : font,
            color,
            ...(maxWidth ? { maxWidth, lineHeight: size * 1.4 } : {}),
        });
    };

    const cAlign = (text, lx, cw, y, opts = {}) => {
        const f = opts.bold ? fontB : font;
        const w = f.widthOfTextAtSize(String(text), opts.size || 10);
        draw(text, lx + (cw - w) / 2, y, opts);
    };

    /* ══════════════════════════════════════════════════════
       INVOICE HEADER  (below the letterhead graphic)
       Template letterhead ends ~y=722 from bottom.
       Contact icons on right start ~y=680.
       "INVOICE" in sample is at top-left → approx y=640
    ══════════════════════════════════════════════════════ */
    const HDR_Y = 636;

    draw("INVOICE", 35, HDR_Y, { size: 14, bold: true });

    // "Issued to:" line — wraps if long
    draw(`Issued to: ${issuedTo || ""}`, 35, HDR_Y - 20, {
        size: 10, maxWidth: 240,
    });

    draw(`Issued date: ${fmtDate(date)}`, 35, HDR_Y - 36, { size: 10 });

    /* ══════════════════════════════════════════════════════
       TABLE
       From sample analysis:
         Outer border: x=35..560, top y≈552, columns dividers at x=235,335,450
         Header height: 40pt
         Row height:    38pt
         5 data rows + 1 total row minimum
    ══════════════════════════════════════════════════════ */
    const TL = 35, TR = 560, TW = TR - TL;
    const COL_X = [35, 235, 335, 450];
    const COL_W = [200, 100, 115, 110];

    const TBL_TOP = 552;
    const HDR_H = 40;
    const ROW_H = 38;
    const BORDER = 0.8;

    const dataRows = (rows || []).filter(r => r.name || r.qty || r.price);
    const numRows = Math.max(dataRows.length, 5);  // pad to minimum 5 like sample
    const TBL_H = HDR_H + numRows * ROW_H + ROW_H; // +1 total row
    const TBL_BOT = TBL_TOP - TBL_H;

    /* Outer rect (white fill to cover template white area) */
    page.drawRectangle({
        x: TL, y: TBL_BOT,
        width: TW, height: TBL_H,
        color: WHITE, borderColor: GREEN, borderWidth: BORDER,
    });

    /* Header row */
    const HDR_BOT = TBL_TOP - HDR_H;
    page.drawRectangle({
        x: TL, y: HDR_BOT,
        width: TW, height: HDR_H,
        color: WHITE, borderColor: GREEN, borderWidth: BORDER,
    });

    /* Header 2-line text */
    const hY1 = HDR_BOT + 24; // upper line
    const hY2 = HDR_BOT + 10; // lower line
    cAlign("DESCRIPTION", COL_X[0], COL_W[0], hY1, { size: 10, bold: true });
    cAlign("QTY/KG", COL_X[1], COL_W[1], hY1, { size: 10, bold: true });
    cAlign("PRICE", COL_X[2], COL_W[2], hY1, { size: 10, bold: true });
    cAlign(`${currency}/KG`, COL_X[2], COL_W[2], hY2, { size: 10, bold: true });
    cAlign("SUBTOTAL", COL_X[3], COL_W[3], hY1, { size: 10, bold: true });
    cAlign(currency, COL_X[3], COL_W[3], hY2, { size: 10, bold: true });

    /* Vertical column dividers */
    [COL_X[1], COL_X[2], COL_X[3]].forEach(x => {
        page.drawLine({
            start: { x, y: TBL_BOT },
            end: { x, y: TBL_TOP },
            thickness: BORDER, color: GREEN,
        });
    });

    /* Data rows */
    let rowY = HDR_BOT - ROW_H;
    const padded = [...dataRows];
    while (padded.length < numRows) padded.push({ name: "", qty: "", price: "" });

    padded.forEach((r) => {
        page.drawLine({
            start: { x: TL, y: rowY + ROW_H }, end: { x: TR, y: rowY + ROW_H },
            thickness: 0.5, color: rgb(0.7, 0.7, 0.7),
        });

        const ty = rowY + 13; // text baseline inside row

        if (r.name) cAlign(r.name.toUpperCase(), COL_X[0], COL_W[0], ty, { size: 10 });
        if (r.qty) cAlign(String(parseFloat(r.qty)), COL_X[1], COL_W[1], ty, { size: 10 });
        if (r.price !== "" && r.price !== undefined && r.price !== null) {
            cAlign(parseFloat(r.price).toFixed(2), COL_X[2], COL_W[2], ty, { size: 10 });
        }
        const sub = calcSub(r);
        if (sub > 0) cAlign(sub.toFixed(2), COL_X[3], COL_W[3], ty, { size: 10 });

        rowY -= ROW_H;
    });

    /* TOTAL row */
    page.drawLine({
        start: { x: TL, y: rowY + ROW_H }, end: { x: TR, y: rowY + ROW_H },
        thickness: BORDER, color: GREEN,
    });
    const totalY = rowY + 13;
    cAlign("TOTAL", COL_X[2], COL_W[2], totalY, { size: 10, bold: true });
    cAlign(`${(grandTotal || 0).toFixed(2)} ${currency}`, COL_X[3], COL_W[3], totalY, { size: 10, bold: true });

    /* ══════════════════════════════════════════════════════
       FOOTER — Bank details (bottom-left) + Signature (right)
       Template has a footer separator line at ~y=175.
       Bank text: x=35, starting y=162
       Signature: x≈390, y≈140
    ══════════════════════════════════════════════════════ */
    const FY = 162;

    draw("Bank Account:", 35, FY, { size: 10, bold: true });
    draw("273200140055470", 35, FY - 15, { size: 10 });
    draw("R. M. C. M Rathnayaka", 35, FY - 29, { size: 10 });
    draw("People's Bank", 35, FY - 43, { size: 10 });
    draw("Kadawatha Branch", 35, FY - 57, { size: 10 });

    if (invoiceNote && invoiceNote.trim()) {
        draw("Note: " + invoiceNote.trim(), 35, FY - 74, {
            size: 8.5, color: GRAY, maxWidth: 220,
        });
    }

    /* Signature image */
    try {
        const sigBytes = await fetch("/signature.png").then(r => r.arrayBuffer());
        const sigImg = await pdfDoc.embedPng(sigBytes);
        const dim = sigImg.scaleToFit(110, 52);
        const sigX = 390;
        const sigImgY = FY - 5;
        page.drawImage(sigImg, { x: sigX, y: sigImgY, width: dim.width, height: dim.height });

        const mdText = "Managing Director";
        const mdW = fontB.widthOfTextAtSize(mdText, 10);
        draw(mdText, sigX + (dim.width - mdW) / 2, sigImgY - 14, { size: 10, bold: true });
    } catch {
        draw("Managing Director", 395, FY - 14, { size: 10, bold: true });
    }

    return pdfDoc.save();
}
