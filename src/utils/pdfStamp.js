/**
 * Shared PDF Stamping logic — stamps data onto template.pdf
 * Handles dynamic row heights, automatic pagination, and layout alignment.
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { templatePdf } from "../assets/templatePdf";
import { signaturePng } from "../assets/signaturePng";

const b64toUint8 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const calcSub = (r) => (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0);

function fmtDate(dateStr) {
    if (dateStr) return dateStr;
    const now = new Date();
    const day = now.getDate();
    const s = ["th", "st", "nd", "rd"][(day % 10 > 3 || Math.floor(day / 10) === 1) ? 0 : day % 10];
    return `${day}${s} ${now.toLocaleDateString("en-GB", { month: "long" })} ${now.getFullYear()}`;
}

export async function stampPDF({ issuedTo, date, currency, rows, grandTotal, invoiceNote }) {
    /* ── Load template and preserve a pristine copy for pagination ── */
    const tplBytes = b64toUint8(templatePdf);
    const pristineDoc = await PDFDocument.load(tplBytes);
    const pdfDoc = await PDFDocument.load(tplBytes);
    let page = pdfDoc.getPages()[0];

    const addNewPage = async () => {
        const [newPage] = await pdfDoc.copyPages(pristineDoc, [0]);
        pdfDoc.addPage(newPage);
        return newPage;
    };

    /* ── Fonts and Colors ── */
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontB = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const GREEN = rgb(0.10, 0.28, 0.10);
    const BLACK = rgb(0, 0, 0);
    const WHITE = rgb(1, 1, 1);
    const GRAY = rgb(0.35, 0.35, 0.35);

    /* ── Drawing Helpers ── */
    const draw = (p, text, x, y, { size = 10, bold = false, color = BLACK, maxWidth } = {}) => {
        if (!text && text !== 0) return;
        p.drawText(String(text), {
            x, y, size,
            font: bold ? fontB : font,
            color,
            ...(maxWidth ? { maxWidth, lineHeight: size * 1.4 } : {}),
        });
    };

    const cAlign = (p, text, lx, cw, y, opts = {}) => {
        const f = opts.bold ? fontB : font;
        const w = f.widthOfTextAtSize(String(text), opts.size || 10);
        draw(p, text, lx + (cw - w) / 2, y, opts);
    };

    /* ══════════════════════════════════════════════════════
       MARGINS AND ALIGNMENT
    ══════════════════════════════════════════════════════ */
    // 0.5-inch margin = exactly 36 points in PDF coordinate space
    const LEFT_MARGIN = 36;

    // Overall table width (from 36 up to 560 for a 524pt wide table)
    const TL = LEFT_MARGIN, TR = 560, TW = TR - TL;
    const W_DESC = 210, W_QTY = 90, W_PRICE = 112, W_SUB = 112;
    const COL_X = [TL, TL + W_DESC, TL + W_DESC + W_QTY, TL + W_DESC + W_QTY + W_PRICE];
    const COL_WIDTHS = [W_DESC, W_QTY, W_PRICE, W_SUB];

    /* ══════════════════════════════════════════════════════
       HEADER FORMATTING (Page 1)
    ══════════════════════════════════════════════════════ */
    let customerName = issuedTo || "";
    let customerAddress = "";
    if (customerName.includes("-")) {
        const parts = customerName.split("-");
        customerName = parts[0].trim();
        customerAddress = parts.slice(1).join("-").trim();
    } else {
        customerAddress = ""; // Empty if no dash present
    }

    // Move the entire header block further up to provide more space
    const HDR_Y = 710;

    // Line 1: "INVOICE" (Bold, Font Size: 18)
    draw(page, "INVOICE", LEFT_MARGIN, HDR_Y, { size: 18, bold: true });

    // Line 2: "Issued to: [Customer Name]"
    draw(page, `Issued to: ${customerName}`, LEFT_MARGIN, HDR_Y - 25, { size: 10, maxWidth: 240 });

    // Line 3 & 4
    let dateY = HDR_Y - 40;
    if (customerAddress) {
        // Line 3 exists, print Address
        draw(page, customerAddress, LEFT_MARGIN, HDR_Y - 40, { size: 10, maxWidth: 240 });
        dateY = HDR_Y - 55; // Push date to Line 4
    }

    // Line 4 (or 3 if no address): "Issued date: [Date]"
    draw(page, `Issued date: ${fmtDate(date)}`, LEFT_MARGIN, dateY, { size: 10 });

    /* ══════════════════════════════════════════════════════
       TABLE MEASUREMENTS & DYNAMIC GRID
    ══════════════════════════════════════════════════════ */
    const HDR_H = 35;
    const ROW_H = 25; // Consistent 25 unit row height
    const BORDER = 2.0; // Exactly 2.0 thickness for all grid lines

    let dataRows = (rows || []).filter(r => r.name || r.qty || r.price);
    if (dataRows.length === 0) dataRows.push({ name: "", qty: "", price: "" });

    let currentY = dateY - 30; // Start table dynamically below header

    const fillRowBackground = (p, topY, height) => {
        p.drawRectangle({ x: TL, y: topY - height, width: TW, height: height, color: WHITE });
    };

    const drawVerticalGridLines = (p, topY, botY) => {
        // Outer vertical edges
        p.drawLine({ start: { x: TL, y: topY }, end: { x: TL, y: botY }, thickness: BORDER, color: GREEN });
        p.drawLine({ start: { x: TR, y: topY }, end: { x: TR, y: botY }, thickness: BORDER, color: GREEN });
        // Inner vertical dividers
        p.drawLine({ start: { x: COL_X[1], y: topY }, end: { x: COL_X[1], y: botY }, thickness: BORDER, color: GREEN });
        p.drawLine({ start: { x: COL_X[2], y: topY }, end: { x: COL_X[2], y: botY }, thickness: BORDER, color: GREEN });
        p.drawLine({ start: { x: COL_X[3], y: topY }, end: { x: COL_X[3], y: botY }, thickness: BORDER, color: GREEN });
    };

    const drawTableHeader = (p, topY) => {
        fillRowBackground(p, topY, HDR_H);

        const hY1 = topY - 14;
        const hY2 = topY - 26;
        cAlign(p, "DESCRIPTION", COL_X[0], COL_WIDTHS[0], hY1, { size: 10, bold: true });
        cAlign(p, "QTY/KG", COL_X[1], COL_WIDTHS[1], hY1, { size: 10, bold: true });
        cAlign(p, "PRICE", COL_X[2], COL_WIDTHS[2], hY1, { size: 10, bold: true });
        cAlign(p, `${currency}/KG`, COL_X[2], COL_WIDTHS[2], hY2, { size: 10, bold: true });
        cAlign(p, "SUBTOTAL", COL_X[3], COL_WIDTHS[3], hY1, { size: 10, bold: true });
        cAlign(p, currency, COL_X[3], COL_WIDTHS[3], hY2, { size: 10, bold: true });

        // Solid horizontal line BEFORE header
        p.drawLine({ start: { x: TL, y: topY }, end: { x: TR, y: topY }, thickness: BORDER, color: GREEN });
        // Solid horizontal line AFTER header, clearly separating it from data
        p.drawLine({ start: { x: TL, y: topY - HDR_H }, end: { x: TR, y: topY - HDR_H }, thickness: BORDER, color: GREEN });

        drawVerticalGridLines(p, topY, topY - HDR_H);
    };

    drawTableHeader(page, currentY);
    currentY -= HDR_H;

    for (let i = 0; i < dataRows.length; i++) {
        const r = dataRows[i];

        // Ensure we don't bleed into the bottom logic 
        // 90 padding handles row + spacing to prevent footer clipping
        if (currentY - ROW_H < 90) {
            page = await addNewPage();
            currentY = 740; // Top of proper content area on new page
            drawTableHeader(page, currentY);
            currentY -= HDR_H;
        }

        fillRowBackground(page, currentY, ROW_H);

        const textY = currentY - 17; // Align correctly in the 25 unit space
        if (r.name) cAlign(page, r.name.toUpperCase(), COL_X[0], COL_WIDTHS[0], textY, { size: 10 });
        if (r.qty) cAlign(page, String(parseFloat(r.qty)), COL_X[1], COL_WIDTHS[1], textY, { size: 10 });
        if (r.price !== "" && r.price !== undefined && r.price !== null) {
            cAlign(page, parseFloat(r.price).toFixed(2), COL_X[2], COL_WIDTHS[2], textY, { size: 10 });
        }
        const sub = calcSub(r);
        if (sub > 0) cAlign(page, sub.toFixed(2), COL_X[3], COL_WIDTHS[3], textY, { size: 10 });

        // Make vertical columns
        drawVerticalGridLines(page, currentY, currentY - ROW_H);

        currentY -= ROW_H;
        // Solid horizontal line after every single item row to separate them clearly
        page.drawLine({ start: { x: TL, y: currentY }, end: { x: TR, y: currentY }, thickness: BORDER, color: GREEN });
    }

    // Checking space for the Total row + Footer (~280pt needed minimum for lower signature)
    if (currentY - ROW_H < 280) {
        page = await addNewPage();
        currentY = 740;
    }

    /* ══════════════════════════════════════════════════════
       TOTAL ROW
    ══════════════════════════════════════════════════════ */
    fillRowBackground(page, currentY, ROW_H);
    const totalY = currentY - 17;
    cAlign(page, "TOTAL", COL_X[2], COL_WIDTHS[2], totalY, { size: 10, bold: true });
    cAlign(page, `${(grandTotal || 0).toFixed(2)} ${currency}`, COL_X[3], COL_WIDTHS[3], totalY, { size: 10, bold: true });

    // Vertical columns for Total block
    page.drawLine({ start: { x: TL, y: currentY }, end: { x: TL, y: currentY - ROW_H }, thickness: BORDER, color: GREEN });
    page.drawLine({ start: { x: TR, y: currentY }, end: { x: TR, y: currentY - ROW_H }, thickness: BORDER, color: GREEN });
    page.drawLine({ start: { x: COL_X[2], y: currentY }, end: { x: COL_X[2], y: currentY - ROW_H }, thickness: BORDER, color: GREEN });
    page.drawLine({ start: { x: COL_X[3], y: currentY }, end: { x: COL_X[3], y: currentY - ROW_H }, thickness: BORDER, color: GREEN });

    currentY -= ROW_H;
    page.drawLine({ start: { x: TL, y: currentY }, end: { x: TR, y: currentY }, thickness: BORDER, color: GREEN });

    /* ══════════════════════════════════════════════════════
       DYNAMIC FOOTER POSITIONING & SIGNATURE
    ══════════════════════════════════════════════════════ */
    currentY -= 36; // Exact 36pt (0.5 inch) gap below the table's final line

    // Wipe background artifacts if footer falls on a busy background zone
    page.drawRectangle({ x: LEFT_MARGIN, y: currentY - 100, width: 250, height: 115, color: WHITE });

    draw(page, "Bank Account:", LEFT_MARGIN, currentY, { size: 10, bold: true });
    draw(page, "Company Name: CEYLON MULTI AGRO HUB (PVT) LTD", LEFT_MARGIN, currentY - 15, { size: 10 });
    draw(page, "Bank: BOC Bank", LEFT_MARGIN, currentY - 29, { size: 10 });
    draw(page, "Branch: Kadawatha", LEFT_MARGIN, currentY - 43, { size: 10 });
    draw(page, "Account Type: Current Account", LEFT_MARGIN, currentY - 57, { size: 10 });
    draw(page, "Account Number: 96015470", LEFT_MARGIN, currentY - 71, { size: 10 });

    let finalBankY = currentY - 71;
    if (invoiceNote && invoiceNote.trim()) {
        draw(page, "Note: " + invoiceNote.trim(), LEFT_MARGIN, currentY - 92, { size: 8.5, color: GRAY, maxWidth: 220 });
        finalBankY = currentY - 92;
    }

    /* Signature Image */
    try {
        const sigBytes = b64toUint8(signaturePng);
        const sigImg = await pdfDoc.embedPng(sigBytes);
        const dim = sigImg.scaleToFit(110, 52);

        // Aligning explicitly on the right (TR coordinate)
        const sigX = TR - dim.width - 20;
        // Raised signature by another 0.5 inches (total 108 points from base)
        const sigImgY = finalBankY - 36 - dim.height + 108;

        page.drawRectangle({ x: sigX - 10, y: sigImgY - 20, width: dim.width + 20, height: dim.height + 40, color: WHITE }); // hide template artifacts
        page.drawImage(sigImg, { x: sigX, y: sigImgY, width: dim.width, height: dim.height });

        const mdText = "Managing Director";
        const mdW = fontB.widthOfTextAtSize(mdText, 10);

        // Centered directly below the signature image
        draw(page, mdText, sigX + (dim.width - mdW) / 2, sigImgY - 14, { size: 10, bold: true });
    } catch {
        const mdText = "Managing Director";
        const mdW = fontB.widthOfTextAtSize(mdText, 10);
        const backupX = TR - mdW - 40;

        draw(page, mdText, backupX, finalBankY - 36 - 10 + 108, { size: 10, bold: true });
    }

    /* Return generated raw bytes */
    return pdfDoc.save();
}
