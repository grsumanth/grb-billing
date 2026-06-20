const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ── Design Tokens ────────────────────────────────────────────────
const burgundy  = '#780116';
const gold      = '#C9A84C';
const cream     = '#FFF9F2';
const lightCream= '#FFFAF6';
const muted     = '#888888';
const dark      = '#1A0005';

/**
 * Shared PDF generation that exactly replicates the frontend HTML bill design.
 * Used by generateBillPDF, generateWhatsAppPDF, and Google Drive backup.
 */
async function generateInvoicePDF(bill, items) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [148 * 2.83465, 210 * 2.83465], // A5: ~419.5 x 595.3 pt
      margin: 0,
      info: {
        Title: `GRB Bill #${bill.id}`,
        Author: 'GRB Pooja Items',
        Subject: 'Invoice'
      }
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W  = doc.page.width;   // ~419.5 pt
    const H  = doc.page.height;  // ~595.3 pt
    const bm = 14;               // border margin
    const cW = W - 2 * bm;      // content width ~391.5 pt

    // ── Column definitions ──────────────────────────────────────
    const col = {
      sl:    { x: bm + 4,   w: 22,  align: 'center' },
      name:  { x: bm + 30,  w: 190, align: 'left'   },
      qty:   { x: bm + 224, w: 46,  align: 'center' },
      price: { x: bm + 274, w: 54,  align: 'right'  },
      total: { x: bm + 332, w: 50,  align: 'right'  }
    };

    function drawDashedLine(y, color) {
      doc.moveTo(bm, y).lineTo(W - bm, y).dash(3, { space: 3 }).strokeColor(color || gold).lineWidth(0.8).stroke();
      doc.undash();
    }

    function drawColSeps(y, h, color) {
      [col.name.x - 4, col.qty.x - 4, col.price.x - 4, col.total.x - 4].forEach(cx => {
        doc.moveTo(cx, y).lineTo(cx, y + h).strokeColor(color || '#c8a0a0').lineWidth(0.5).stroke();
      });
    }

    function drawTableHeader(y) {
      const hH = 20;
      doc.rect(bm, y, cW, hH).fill(cream);
      doc.rect(bm, y, cW, hH).strokeColor(burgundy).lineWidth(0.8).stroke();
      drawColSeps(y, hH, burgundy);

      doc.fillColor(burgundy).fontSize(8).font('Helvetica-Bold');
      doc.text('SL.',        col.sl.x,    y + 6, { width: col.sl.w,    align: 'center' });
      doc.text('ITEM NAME',  col.name.x,  y + 6, { width: col.name.w,  align: 'left'   });
      doc.text('QTY',        col.qty.x,   y + 6, { width: col.qty.w,   align: 'center' });
      doc.text('PRICE (Rs.)',col.price.x, y + 6, { width: col.price.w, align: 'right'  });
      doc.text('TOTAL (Rs.)',col.total.x, y + 6, { width: col.total.w, align: 'right'  });
      return y + hH;
    }

    // ── Page 1: White background + border ──────────────────────
    doc.rect(0, 0, W, H).fill('#ffffff');
    doc.rect(bm, bm, cW, H - 2 * bm).strokeColor(burgundy).lineWidth(1.5).stroke();

    let y = bm + 10;

    // ── Header: Logo + Shop Name ────────────────────────────────
    const logoPath = path.join(__dirname, '..', 'frontend', 'logo.jpg');
    const logoSz = 52;
    const logoX  = bm + 30;
    const titleX = logoX + logoSz + 14;

    if (fs.existsSync(logoPath)) {
      doc.save();
      doc.circle(logoX + logoSz / 2, y + logoSz / 2, logoSz / 2).clip();
      doc.image(logoPath, logoX, y, { width: logoSz, height: logoSz });
      doc.restore();
      doc.circle(logoX + logoSz / 2, y + logoSz / 2, logoSz / 2)
         .strokeColor(burgundy).lineWidth(1.5).stroke();
    }

    doc.fillColor(burgundy).fontSize(20).font('Helvetica-Bold')
       .text('GRB POOJA ITEMS', titleX, y + 9, { width: W - titleX - bm });
    doc.fillColor(dark).fontSize(7.5).font('Helvetica-Bold')
       .text('SACRED SUPPLIES \u00B7 TRUSTED QUALITY', titleX, y + 34, {
         width: W - titleX - bm,
         characterSpacing: 1.2
       });

    y += logoSz + 8;

    // ── Horizontal burgundy line ────────────────────────────────
    doc.moveTo(bm, y).lineTo(W - bm, y).strokeColor(burgundy).lineWidth(1.5).stroke();
    y += 8;

    // ── Badge: ESTIMATE / TAX INVOICE ──────────────────────────
    const gstAmt  = parseFloat(bill.gst_amount || bill.gst || 0);
    const gstPct  = parseFloat(bill.gst_percent || 0);
    const typeLabel = gstAmt > 0 ? 'TAX INVOICE' : 'ESTIMATE';
    const bdgW = 80, bdgH = 16;
    const bdgX = (W - bdgW) / 2;

    doc.rect(bdgX, y, bdgW, bdgH).fill(burgundy);
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
       .text(typeLabel, bdgX, y + 4, { width: bdgW, align: 'center', characterSpacing: 1.5 });
    y += bdgH + 6;

    // ── Bill No | Date row ──────────────────────────────────────
    const infoH = 22;
    doc.rect(bm, y, cW, infoH).fill(cream);
    doc.rect(bm, y, cW, infoH).strokeColor(burgundy).lineWidth(0.8).stroke();
    // Centre divider
    doc.moveTo(W / 2, y + 4).lineTo(W / 2, y + infoH - 4)
       .strokeColor(burgundy).lineWidth(0.5).stroke();

    const now     = new Date(bill.created_at || Date.now());
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

    doc.fillColor(dark).fontSize(9.5).font('Helvetica-Bold')
       .text(`Bill No: ${bill.id}`, bm + 8, y + 6, { width: cW / 2 - 12 });
    doc.fillColor(dark).fontSize(9.5).font('Helvetica')
       .text(`${dateStr}  ${timeStr}`, bm + cW / 2 + 4, y + 6, { width: cW / 2 - 12, align: 'right' });
    y += infoH + 8;

    // ── Customer Info ───────────────────────────────────────────
    const phone = bill.customer_phone || bill.phone || '';
    const addr  = bill.customer_address || bill.address || '';

    doc.fillColor(burgundy).fontSize(7.5).font('Helvetica-Bold')
       .text('BILL TO', bm + 2, y, { characterSpacing: 0.8 });
    y += 11;
    doc.fillColor(dark).fontSize(11.5).font('Helvetica-Bold')
       .text(bill.customer_name || 'Walk-in Customer', bm + 2, y);
    y += 14;
    if (phone) {
      doc.fillColor('#555').fontSize(8.5).font('Helvetica')
         .text(`Ph: ${phone}`, bm + 2, y);
      y += 11;
    }
    if (addr) {
      doc.fillColor('#555').fontSize(8.5).font('Helvetica')
         .text(addr, bm + 2, y, { width: cW - 4 });
      y += 11;
    }
    y += 5;

    // ── Gold dashed separator ───────────────────────────────────
    drawDashedLine(y);
    y += 8;

    // ── Table header ────────────────────────────────────────────
    y = drawTableHeader(y);

    // ── Table rows ──────────────────────────────────────────────
    const rowH     = 22;
    const pageLimit = H - bm - 110; // reserve space for totals+footer
    let   pageNum  = 1;

    items.forEach((item, idx) => {
      // Page break
      if (y + rowH > pageLimit) {
        doc.addPage();
        pageNum++;
        doc.rect(0, 0, W, H).fill('#ffffff');
        doc.rect(bm, bm, cW, H - 2 * bm).strokeColor(burgundy).lineWidth(1.5).stroke();
        y = bm + 10;
        y = drawTableHeader(y);
      }

      const hasSub = !!(item.type || '').trim();

      // Alternating row fill
      if (idx % 2 !== 0) doc.rect(bm, y, cW, rowH).fill(lightCream);

      // Row outer border
      doc.rect(bm, y, cW, rowH).strokeColor('#c8a0a0').lineWidth(0.5).stroke();
      drawColSeps(y, rowH);

      const nameStr = item.product_name || item.name || '';
      const typeStr = item.type || '';
      const textY   = hasSub ? y + 3 : y + 6;

      // SL
      doc.fillColor(muted).fontSize(8.5).font('Times-Roman')
         .text(String(idx + 1), col.sl.x, textY + (hasSub ? 2 : 0), { width: col.sl.w, align: 'center' });

      // Name (bold dark) + Type (small grey)
      doc.fillColor(dark).fontSize(9).font('Helvetica-Bold')
         .text(nameStr, col.name.x, textY, { width: col.name.w, ellipsis: true });
      if (hasSub) {
        doc.fillColor(muted).fontSize(7).font('Helvetica')
           .text(typeStr, col.name.x, textY + 11, { width: col.name.w });
      }

      // QTY
      doc.fillColor(dark).fontSize(8.5).font('Times-Roman')
         .text(String(item.quantity || item.qty || 0), col.qty.x, textY + (hasSub ? 2 : 0), { width: col.qty.w, align: 'center' });

      // Price
      doc.fillColor(dark).fontSize(8.5).font('Times-Roman')
         .text(parseFloat(item.price || 0).toFixed(2), col.price.x, textY + (hasSub ? 2 : 0), { width: col.price.w, align: 'right' });

      // Total (burgundy bold)
      doc.fillColor(burgundy).fontSize(8.5).font('Times-Bold')
         .text(parseFloat(item.total || 0).toFixed(2), col.total.x, textY + (hasSub ? 2 : 0), { width: col.total.w, align: 'right' });

      y += rowH;
    });

    y += 10;

    // ── Gold dashed separator ───────────────────────────────────
    drawDashedLine(y);
    y += 10;

    // ── Totals (right-aligned) ──────────────────────────────────
    const prevBalance = parseFloat(bill.previous_balance) || 0;
    const showBalance = bill.show_balance !== false;
    const amtPaid    = parseFloat(bill.amount_paid) || 0;
    const balAmt     = parseFloat(bill.balance_amount) || 0;
    const subtotal   = parseFloat(bill.subtotal || 0);
    const itemsTotal = subtotal + gstAmt;
    const displayTotal = showBalance ? (itemsTotal + prevBalance) : itemsTotal;

    const lblW = 120, valW = 75;
    const totX  = W - bm - valW;
    const lblX  = totX - lblW;

    function totalRow(label, value, color) {
      doc.fillColor(color || '#555').fontSize(9).font('Helvetica')
         .text(label, lblX, y, { width: lblW, align: 'right' });
      doc.fillColor(color || dark).fontSize(9).font('Times-Roman')
         .text(value, totX, y, { width: valW, align: 'right' });
      y += 15;
    }

    totalRow('Subtotal:', 'Rs.' + subtotal.toFixed(2));
    if (gstAmt > 0) totalRow(`GST (${gstPct}%):`, 'Rs.' + gstAmt.toFixed(2));
    if (showBalance && prevBalance > 0) {
      totalRow('Current Bill:', 'Rs.' + itemsTotal.toFixed(2));
      totalRow('Previous Balance:', 'Rs.' + prevBalance.toFixed(2), '#cc2222');
    }

    y += 4;

    // ── Grand Total box ─────────────────────────────────────────
    const gtH = 28;
    doc.rect(bm, y, cW, gtH).fill(burgundy);
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
       .text('TOTAL AMOUNT DUE', bm + 10, y + 9);
    doc.fillColor('white').fontSize(13).font('Times-Bold')
       .text('Rs.' + displayTotal.toFixed(2), bm, y + 8, { width: cW - 8, align: 'right' });
    y += gtH + 10;

    // Amount received / remaining
    if (showBalance && amtPaid > 0) {
      totalRow('Amount Received:', 'Rs.' + amtPaid.toFixed(2));
      doc.fillColor('#cc2222').fontSize(9).font('Helvetica-Bold')
         .text('Remaining Balance:', lblX, y, { width: lblW, align: 'right' });
      doc.fillColor('#cc2222').fontSize(9).font('Times-Roman')
         .text('Rs.' + balAmt.toFixed(2), totX, y, { width: valW, align: 'right' });
      y += 15;
    }

    // Payment status badge
    const payStatus  = bill.payment_status || 'unpaid';
    const statusText = payStatus.toUpperCase();
    const bClr = payStatus === 'paid' ? '#1a6b1a' : payStatus === 'partial' ? '#b26a00' : '#cc2222';
    const bBg  = payStatus === 'paid' ? '#e6f9ed' : payStatus === 'partial' ? '#fff7e6' : '#ffebe6';
    const pbW  = 58;

    doc.roundedRect(bm + 2, y, pbW, 16, 3).fill(bBg);
    doc.fillColor(bClr).fontSize(7.5).font('Helvetica-Bold')
       .text(statusText, bm + 2, y + 5, { width: pbW, align: 'center' });
    y += 24;

    // ── Gold dashed separator ───────────────────────────────────
    drawDashedLine(y);
    y += 10;

    // ── Footer ─────────────────────────────────────────────────
    doc.fillColor(burgundy).fontSize(11).font('Helvetica-Bold')
       .text('\uD83D\uDE4F Thank You \u2013 Visit Again', 0, y, { align: 'center', width: W });
    y += 14;
    doc.fillColor(muted).fontSize(7.5).font('Helvetica')
       .text('GRB Pooja Items \u2022 Sacred Supplies \u2022 Trusted Quality', 0, y, { align: 'center', width: W });
    y += 14;

    // Gold decorative: ─○─◆─○─
    const cx = W / 2;
    const dy = y + 4;
    // Diamond
    doc.moveTo(cx, dy - 4).lineTo(cx + 4, dy).lineTo(cx, dy + 4).lineTo(cx - 4, dy)
       .closePath().fill(gold);
    // Side circles
    doc.circle(cx - 14, dy, 2.5).fill(gold);
    doc.circle(cx + 14, dy, 2.5).fill(gold);
    // Lines
    doc.moveTo(cx - 30, dy).lineTo(cx - 20, dy).strokeColor(gold).lineWidth(1).stroke();
    doc.moveTo(cx + 20, dy).lineTo(cx + 30, dy).strokeColor(gold).lineWidth(1).stroke();
    doc.circle(cx - 36, dy, 1.5).fill(gold);
    doc.circle(cx + 36, dy, 1.5).fill(gold);

    doc.end();
  });
}

async function generateBillPDF(bill, items) {
  return generateInvoicePDF(bill, items);
}

async function generateWhatsAppPDF(bill, items) {
  return generateInvoicePDF(bill, items);
}

/**
 * Saves a bill PDF buffer to local filesystem storage
 */
function savePDFLocally(billId, pdfBuffer) {
  try {
    const storageDir = path.join(__dirname, 'storage', 'bills');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const filePath = path.join(storageDir, `GRB-Bill-${billId}.pdf`);
    fs.writeFileSync(filePath, pdfBuffer);
    console.log(`\uD83D\uDCBE Saved PDF locally to ${filePath}`);
  } catch (err) {
    console.error(`\u26A0\uFE0F Failed to save PDF locally for Bill #${billId}:`, err.message);
  }
}

module.exports = { generateBillPDF, savePDFLocally, generateWhatsAppPDF };
