const PDFDocument = require('pdfkit');

/**
 * Generates a PDF buffer for a bill invoice
 * @param {Object} bill - The bill database row
 * @param {Array} items - The items associated with the bill
 * @returns {Promise<Buffer>} - Resolves to the PDF buffer
 */
async function generateBillPDF(bill, items) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [148 * 2.83465, 210 * 2.83465], // A5 in points
      margin: 30,
      info: {
        Title: `Bill #${bill.id} - GRB Pooja Items`,
        Author: 'GRB Pooja Items'
      }
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const burgundy = '#780116';
    const gold = '#C9A84C';

    // ── Header background ──
    doc.rect(0, 0, W, 110).fill(burgundy);

    // ── Gold line ──
    doc.rect(0, 108, W, 2).fill(gold);

    // ── Shop name ──
    doc.fillColor('#F0CC6A').fontSize(22).font('Helvetica-Bold')
      .text('GRB POOJA ITEMS', 0, 25, { align: 'center', width: W });

    doc.fillColor(gold).fontSize(9).font('Helvetica')
      .text('SACRED SUPPLIES · TRUSTED QUALITY', 0, 52, { align: 'center', width: W });

    // ── Bill info ──
    const now = new Date(bill.created_at || Date.now());
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

    doc.fillColor('white').fontSize(9).font('Helvetica')
      .text(`${dateStr}  ${timeStr}`, 30, 70)
      .text(`Bill No: #${bill.id}`, 30, 70, { align: 'right', width: W - 60 });

    // ── Customer block ──
    doc.rect(0, 118, W, 38).fill('#FFF8F3');
    doc.rect(0, 118, 4, 38).fill(burgundy);
    doc.fillColor('#888').fontSize(8).font('Helvetica')
      .text('BILL TO', 18, 124);
    doc.fillColor('#1A0005').fontSize(13).font('Helvetica-Bold')
      .text(bill.customer_name, 18, 135);

    // ── Items table header ──
    doc.rect(0, 164, W, 22).fill(burgundy);
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
    doc.text('#', 10, 171);
    doc.text('ITEM', 30, 171);
    doc.text('TYPE', W * 0.52, 171);
    doc.text('QTY', W * 0.65, 171, { width: 40, align: 'center' });
    doc.text('RATE', W * 0.76, 171, { width: 45, align: 'right' });
    doc.text('TOTAL', W * 0.87, 171, { width: W * 0.13 - 10, align: 'right' });

    // ── Items ──
    let y = 195;
    items.forEach((item, i) => {
      if (i % 2 === 0) doc.rect(0, y - 6, W, 20).fill('#FFF8F3');
      doc.fillColor('#1A0005').fontSize(9).font('Helvetica');
      doc.text(String(i + 1), 10, y);
      doc.text(item.product_name || item.name || '', 30, y, { width: W * 0.48, ellipsis: true });
      doc.text(item.type || '', W * 0.52, y, { width: W * 0.12 });
      doc.text(String(item.quantity || item.qty || 0), W * 0.65, y, { width: 40, align: 'center' });
      doc.text('Rs.' + parseFloat(item.price || 0).toFixed(2), W * 0.76, y, { width: 45, align: 'right' });
      doc.fillColor(burgundy).font('Helvetica-Bold')
        .text('Rs.' + parseFloat(item.total || 0).toFixed(2), W * 0.87, y, { width: W * 0.13 - 10, align: 'right' });
      y += 20;
    });

    // ── Divider ──
    doc.moveTo(0, y + 4).lineTo(W, y + 4).strokeColor(gold).lineWidth(1).stroke();
    y += 14;

    // ── Totals ──
    doc.fillColor('#555').fontSize(10).font('Helvetica')
      .text('Subtotal:', 30, y, { width: W - 60 })
      .text('Rs.' + parseFloat(bill.subtotal).toFixed(2), 30, y, { align: 'right', width: W - 60 });
    y += 18;

    if (parseFloat(bill.gst_amount) > 0) {
      doc.text(`GST (${bill.gst_percent}%):`, 30, y, { width: W - 60 })
        .text('Rs.' + parseFloat(bill.gst_amount).toFixed(2), 30, y, { align: 'right', width: W - 60 });
      y += 18;
    }

    // ── Grand total ──
    doc.moveTo(30, y).lineTo(W - 30, y).strokeColor(burgundy).lineWidth(1.5).stroke();
    y += 8;
    doc.fillColor(burgundy).fontSize(14).font('Helvetica-Bold')
      .text('TOTAL AMOUNT', 30, y, { width: W - 60 })
      .text('Rs.' + parseFloat(bill.total).toFixed(2), 30, y, { align: 'right', width: W - 60 });
    y += 30;

    // ── Footer ──
    doc.moveTo(0, y).lineTo(W, y).strokeColor(gold).lineWidth(0.8).stroke();
    doc.fillColor(burgundy).fontSize(10).font('Helvetica-Bold')
      .text('Thank you for your purchase!', 0, y + 10, { align: 'center', width: W });
    doc.fillColor('#888').fontSize(8).font('Helvetica')
      .text('Visit us again — GRB Pooja Items', 0, y + 24, { align: 'center', width: W });

    doc.end();
  });
}

module.exports = { generateBillPDF };
