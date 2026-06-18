const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Shared PDF generation function for a professional invoice layout.
 * Used by both generateBillPDF and generateWhatsAppPDF to guarantee identical layout and details.
 */
async function generateInvoicePDF(bill, items) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [148 * 2.83465, 210 * 2.83465], // A5 in points (approx 419.5 x 595.3)
      margin: 20,
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
    const H = doc.page.height;
    const burgundy = '#780116';
    const gold = '#C9A84C';
    let pageNumber = 1;

    function drawPageTemplate(pageNum) {
      // ── Border around page ──
      doc.rect(12, 12, W - 24, H - 24).strokeColor(burgundy).lineWidth(1.2).stroke();

      // ── Header background ──
      doc.rect(12, 12, W - 24, 75).fill(burgundy);
      doc.rect(12, 86, W - 24, 1.5).fill(gold);

      // Logo image (if exists)
      const logoPath = path.join(__dirname, '..', 'frontend', 'logo.jpg');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 25, 20, { width: 45, height: 45 });
      }

      // Shop Name & Tagline
      doc.fillColor('#F0CC6A').fontSize(18).font('Helvetica-Bold')
         .text('GRB POOJA ITEMS', 80, 26);
      doc.fillColor(gold).fontSize(7.5).font('Helvetica-Bold')
         .text('SACRED SUPPLIES · TRUSTED QUALITY', 80, 48);

      const now = new Date(bill.created_at || Date.now());
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

      if (pageNum > 1) {
        doc.fillColor('white').fontSize(8.5).font('Helvetica-Bold')
           .text(`Bill No: #${bill.id} (Cont.)`, 80, 63, { align: 'right', width: W - 110 });
      } else {
        doc.fillColor('white').fontSize(8.5).font('Times-Roman')
           .text(`${dateStr}  ${timeStr}`, 80, 63);
        doc.text(`Bill No: #${bill.id}`, 80, 63, { align: 'right', width: W - 110 });
      }
    }

    // Initialize first page
    drawPageTemplate(pageNumber);

    // ── Customer Block ──
    const phone = bill.customer_phone || bill.phone;
    const addr = bill.customer_address || bill.address;
    const custBoxH = addr ? 42 : 30;
    
    doc.rect(20, 96, W - 40, custBoxH).fill('#FFFDF9').strokeColor(burgundy).lineWidth(0.5).stroke();
    doc.rect(20, 96, 3, custBoxH).fill(burgundy);
    
    doc.fillColor(burgundy).fontSize(7).font('Helvetica-Bold').text('BILL TO', 28, 101);
    doc.fillColor('#1A0005').fontSize(10).font('Helvetica-Bold').text(bill.customer_name || 'Walk-in Customer', 28, 110);
    
    let custContact = '';
    if (phone) custContact += `Ph: ${phone}`;
    if (addr) {
      if (custContact) custContact += '  |  ';
      custContact += addr;
    }
    if (custContact) {
      doc.fillColor('#555').fontSize(8).font('Times-Roman').text(custContact, 28, 121);
    }

    // ── Items Table Header ──
    const tableHeaderY = 96 + custBoxH + 10;
    doc.rect(20, tableHeaderY, W - 40, 18).fill(burgundy);
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
    doc.text('#', 25, tableHeaderY + 5);
    doc.text('ITEM NAME', 45, tableHeaderY + 5);
    doc.text('QTY', 280, tableHeaderY + 5, { width: 35, align: 'center' });
    doc.text('RATE (₹)', 320, tableHeaderY + 5, { width: 45, align: 'right' });
    doc.text('TOTAL (₹)', 365, tableHeaderY + 5, { width: 30, align: 'right' });

    let y = tableHeaderY + 18;
    const itemHeight = 18;
    const pageLimit = H - 55;

    items.forEach((item, idx) => {
      // Check for page break
      if (y + itemHeight > pageLimit) {
        doc.moveTo(20, y).lineTo(W - 20, y).strokeColor(burgundy).lineWidth(0.5).stroke();
        
        doc.addPage();
        pageNumber++;
        drawPageTemplate(pageNumber);
        
        // Re-draw table header on new page
        y = 96;
        doc.rect(20, y, W - 40, 18).fill(burgundy);
        doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
        doc.text('#', 25, y + 5);
        doc.text('ITEM NAME', 45, y + 5);
        doc.text('QTY', 280, y + 5, { width: 35, align: 'center' });
        doc.text('RATE (₹)', 320, y + 5, { width: 45, align: 'right' });
        doc.text('TOTAL (₹)', 365, y + 5, { width: 30, align: 'right' });
        
        y += 18;
      }
      
      // Alternating row background
      if (idx % 2 === 0) {
        doc.rect(20, y, W - 40, itemHeight).fill('#FFFDF9');
      }
      
      doc.fillColor('#1A0005').fontSize(8.5).font('Times-Roman');
      doc.text(String(idx + 1), 25, y + 5);
      
      let nameStr = item.product_name || item.name || '';
      if (item.type) {
        nameStr += ` (${item.type})`;
      }
      doc.text(nameStr, 45, y + 5, { width: 225, ellipsis: true });
      doc.text(String(item.quantity || item.qty || 0), 280, y + 5, { width: 35, align: 'center' });
      doc.text(parseFloat(item.price || 0).toFixed(2), 320, y + 5, { width: 45, align: 'right' });
      doc.text(parseFloat(item.total || 0).toFixed(2), 365, y + 5, { width: 30, align: 'right' });
      
      // Bottom border line for the row
      doc.moveTo(20, y + itemHeight).lineTo(W - 20, y + itemHeight).strokeColor('#F2E2D2').lineWidth(0.5).stroke();
      
      y += itemHeight;
    });

    // Draw final table bottom line
    doc.moveTo(20, y).lineTo(W - 20, y).strokeColor(burgundy).lineWidth(0.5).stroke();

    // ── Totals & Summary Section ──
    const gstAmt = parseFloat(bill.gst_amount || bill.gst || 0);
    const gstPct = parseFloat(bill.gst_percent || 0);
    const prevBalance = parseFloat(bill.previous_balance) || 0;
    const showBalance = bill.show_balance !== false;
    const amtPaid = parseFloat(bill.amount_paid) || 0;
    const balAmt = parseFloat(bill.balance_amount) || 0;

    let totalsCount = 2; // Always has Subtotal & Grand Total
    if (gstAmt > 0) totalsCount++;
    if (showBalance && prevBalance > 0) totalsCount += 2; // Items total & Prev balance lines
    if (showBalance && amtPaid > 0) totalsCount += 2; // Amount received & Remaining balance lines

    const totalsNeededHeight = totalsCount * 15 + 60; // totals + grand total box + status + footer

    if (y + totalsNeededHeight > pageLimit) {
      doc.addPage();
      pageNumber++;
      drawPageTemplate(pageNumber);
      y = 96;
    }

    y += 10;

    // Subtotal
    doc.fillColor('#555').fontSize(9).font('Times-Roman')
       .text('Subtotal:', 20, y, { width: W - 40 })
       .text('Rs.' + parseFloat(bill.subtotal).toFixed(2), 20, y, { align: 'right', width: W - 40 });
    y += 15;

    // GST
    if (gstAmt > 0) {
      doc.text(`GST (${gstPct}%):`, 20, y, { width: W - 40 })
         .text('Rs.' + gstAmt.toFixed(2), 20, y, { align: 'right', width: W - 40 });
      y += 15;
    }

    // Previous Balance
    const itemsTotal = parseFloat(bill.subtotal) + gstAmt;
    if (showBalance && prevBalance > 0) {
      doc.text('Current Bill:', 20, y, { width: W - 40 })
         .text('Rs.' + itemsTotal.toFixed(2), 20, y, { align: 'right', width: W - 40 });
      y += 15;
      doc.fillColor('#cc2222')
         .text('Previous Balance:', 20, y, { width: W - 40 })
         .text('Rs.' + prevBalance.toFixed(2), 20, y, { align: 'right', width: W - 40 });
      y += 15;
    }

    // Separator line
    doc.moveTo(20, y).lineTo(W - 20, y).strokeColor(burgundy).lineWidth(1).stroke();
    y += 6;

    // Grand total box
    const displayTotal = showBalance ? (itemsTotal + prevBalance) : itemsTotal;
    doc.rect(20, y, W - 40, 24).fill(burgundy);
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
       .text('TOTAL AMOUNT DUE', 28, y + 8);
    doc.text('Rs.' + displayTotal.toFixed(2), 20, y + 8, { align: 'right', width: W - 48 });
    y += 30;

    // Amount Received & Remaining Balance
    if (showBalance && amtPaid > 0) {
      doc.fillColor('#555').fontSize(9).font('Times-Roman')
         .text('Amount Received:', 20, y, { width: W - 40 })
         .text('Rs.' + amtPaid.toFixed(2), 20, y, { align: 'right', width: W - 40 });
      y += 15;
      doc.fillColor('#cc2222').font('Times-Bold')
         .text('Remaining Balance:', 20, y, { width: W - 40 })
         .text('Rs.' + balAmt.toFixed(2), 20, y, { align: 'right', width: W - 40 });
      y += 18;
    }

    // Payment Status Badge
    const payStatus = bill.payment_status || 'unpaid';
    const statusText = payStatus.toUpperCase();
    const badgeColor = payStatus === 'paid' ? '#1a6b1a' : payStatus === 'partial' ? '#b26a00' : '#cc2222';
    const badgeBg = payStatus === 'paid' ? '#e6f9ed' : payStatus === 'partial' ? '#fff7e6' : '#ffebe6';

    doc.roundedRect(20, y, 65, 16, 4).fill(badgeBg);
    doc.fillColor(badgeColor).fontSize(7.5).font('Helvetica-Bold')
       .text(statusText, 20, y + 5, { align: 'center', width: 65 });
    y += 24;

    // Decorative separator and footer
    doc.moveTo(20, y).lineTo(W - 20, y).strokeColor(gold).lineWidth(0.8).stroke();
    y += 10;
    doc.fillColor(burgundy).fontSize(9).font('Helvetica-Bold')
       .text('Thank You – Visit Again', 0, y, { align: 'center', width: W });
    y += 12;
    doc.fillColor('#888').fontSize(7.5).font('Helvetica')
       .text('Sacred Supplies • Trusted Quality', 0, y, { align: 'center', width: W });

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
 * @param {string} billId - The ID of the bill
 * @param {Buffer} pdfBuffer - The generated PDF buffer
 */
function savePDFLocally(billId, pdfBuffer) {
  try {
    const storageDir = path.join(__dirname, 'storage', 'bills');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const filePath = path.join(storageDir, `GRB-Bill-${billId}.pdf`);
    fs.writeFileSync(filePath, pdfBuffer);
    console.log(`💾 Saved PDF locally to ${filePath}`);
  } catch (err) {
    console.error(`⚠️ Failed to save PDF locally for Bill #${billId}:`, err.message);
  }
}

module.exports = { generateBillPDF, savePDFLocally, generateWhatsAppPDF };
