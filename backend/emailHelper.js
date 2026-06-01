const nodemailer = require('nodemailer');
const { generateBillPDF } = require('./pdfHelper');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS  // App password (not Gmail login password)
  }
});

// ── Send OTP for forgot password ──────────────────
async function sendOTP(toEmail, otp, name) {
  await transporter.sendMail({
    from: `"GRB Pooja Items" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Password Reset OTP — GRB Billing',
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"/></head>
      <body style="font-family:Helvetica,Arial,sans-serif;background:#FBF3E8;margin:0;padding:20px;">
        <div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(120,1,22,0.1);">
          <div style="background:linear-gradient(135deg,#3D000B,#780116);padding:28px 32px;text-align:center;">
            <div style="font-size:2rem;margin-bottom:8px;">ॐ</div>
            <div style="font-size:20px;font-weight:900;color:#F0CC6A;letter-spacing:1px;">GRB POOJA ITEMS</div>
            <div style="font-size:11px;color:rgba(201,168,76,0.6);margin-top:4px;letter-spacing:2px;text-transform:uppercase;">Password Reset</div>
          </div>
          <div style="padding:32px;">
            <p style="color:#2A0008;font-size:15px;margin-bottom:8px;">Hello <strong>${name}</strong>,</p>
            <p style="color:#7A4050;font-size:14px;margin-bottom:24px;">We received a request to reset your password. Use the OTP below:</p>
            <div style="background:#FBF3E8;border:2px dashed #C9A84C;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
              <div style="font-size:36px;font-weight:900;color:#780116;letter-spacing:8px;">${otp}</div>
              <div style="font-size:12px;color:#7A4050;margin-top:8px;">Valid for <strong>10 minutes</strong></div>
            </div>
            <p style="color:#7A4050;font-size:13px;">If you didn't request this, ignore this email. Your password won't change.</p>
          </div>
          <div style="background:#FBF3E8;padding:16px;text-align:center;font-size:11px;color:#7A4050;border-top:1px solid #EDD8B0;">
            GRB Pooja Items Billing System
          </div>
        </div>
      </body>
      </html>
    `
  });
}

// ── Send Bill to customer ─────────────────────────
async function sendBill(toEmail, customerName, bill) {
  const rows = bill.items.map((it, i) => `
    <tr style="background:${i%2===0?'#fff8f3':'#fff'}">
      <td style="padding:8px 12px">${i+1}</td>
      <td style="padding:8px 12px">${it.product_name}</td>
      <td style="padding:8px 12px">${it.type||''}</td>
      <td style="padding:8px 12px;text-align:center">${it.quantity}</td>
      <td style="padding:8px 12px;text-align:right">₹${parseFloat(it.price).toFixed(2)}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:700">₹${parseFloat(it.total).toFixed(2)}</td>
    </tr>
  `).join('');

  const now = new Date(bill.created_at);
  const dateStr = now.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric', timeZone:'Asia/Kolkata'});
  const timeStr = now.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'Asia/Kolkata'});

  await transporter.sendMail({
    from: `"GRB Pooja Items" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `Bill #${bill.id} — GRB Pooja Items`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"/></head>
      <body style="font-family:Helvetica,Arial,sans-serif;background:#FBF3E8;margin:0;padding:20px;">
        <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(120,1,22,0.1);">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#3D000B,#780116);padding:28px 32px;text-align:center;">
            <div style="font-size:2rem;margin-bottom:8px;">ॐ</div>
            <div style="font-size:22px;font-weight:900;color:#F0CC6A;letter-spacing:2px;">GRB POOJA ITEMS</div>
            <div style="font-size:11px;color:rgba(201,168,76,0.6);margin-top:4px;letter-spacing:2px;text-transform:uppercase;">Sacred Supplies · Trusted Quality</div>
            <div style="margin-top:12px;font-size:12px;color:rgba(255,255,255,0.7);">
              <span>${dateStr} &nbsp;${timeStr}</span> &nbsp;&nbsp; Bill No: <strong style="color:#F0CC6A">#${bill.id}</strong>
            </div>
          </div>
          <!-- Customer -->
          <div style="padding:20px 32px;border-left:4px solid #780116;background:#fff8f3;margin:20px 20px 0;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#C9A84C;margin-bottom:4px;">Bill To</div>
            <div style="font-size:16px;font-weight:700;color:#1A0005;">${customerName}</div>
          </div>
          <!-- Items -->
          <div style="padding:20px 20px 0;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:#780116;">
                  <th style="color:white;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;">#</th>
                  <th style="color:white;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;">Item</th>
                  <th style="color:white;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;">Type</th>
                  <th style="color:white;padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;">Qty</th>
                  <th style="color:white;padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;">Rate</th>
                  <th style="color:white;padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;">Total</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <!-- Totals -->
          <div style="margin:16px 20px;padding:16px;background:#fff8f3;border-radius:10px;border:1px solid #EDD8B0;">
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#7A4050;">
              <span>Subtotal</span><span>₹${parseFloat(bill.subtotal).toFixed(2)}</span>
            </div>
            ${parseFloat(bill.gst_amount)>0?`
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#7A4050;">
              <span>GST (${bill.gst_percent}%)</span><span>₹${parseFloat(bill.gst_amount).toFixed(2)}</span>
            </div>`:''}
            <div style="display:flex;justify-content:space-between;padding:10px 0 0;margin-top:8px;border-top:2px solid #780116;font-size:16px;font-weight:900;color:#780116;">
              <span>TOTAL AMOUNT</span><span>₹${parseFloat(bill.total).toFixed(2)}</span>
            </div>
          </div>
          <!-- Footer -->
          <div style="background:#FBF3E8;padding:20px;text-align:center;font-size:12px;color:#7A4050;border-top:1px solid #EDD8B0;">
            <strong style="color:#780116;">✦ Thank you for your purchase ✦</strong><br/>
            Visit us again — GRB Pooja Items
          </div>
        </div>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: `GRB-Bill-${bill.id}.pdf`,
        content: await generateBillPDF(bill, bill.items),
        contentType: 'application/pdf'
      }
    ]
  });
}

module.exports = { sendOTP, sendBill };