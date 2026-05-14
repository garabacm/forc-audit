import PDFDocument from 'pdfkit';
import { Resend } from 'resend';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    firstName,
    email,
    tierNumber,
    tierName,
    tierDescription,
    exposure,
    illustrative,
    categoryScores,
    findingsBrief
  } = req.body;

  if (!email) return res.status(400).json({ error: 'Missing email' });

  const calendlyUrl = process.env.CALENDLY_URL || 'https://calendly.com/chenge-forcadvisory/new-meeting';
  const name = firstName || 'there';

  // --- Build PDF ---
  let pdfBuffer;
  try {
    pdfBuffer = await buildPDF({ firstName: name, tierNumber, tierName, tierDescription, exposure, illustrative, categoryScores, findingsBrief, calendlyUrl });
  } catch (err) {
    console.error('PDF build failed:', err.message);
  }

  // --- Build HTML email ---
  const html = buildEmailHTML({ firstName: name, tierNumber, tierName, tierDescription, exposure, illustrative, categoryScores, findingsBrief, calendlyUrl });

  // --- Send via Resend ---
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn('RESEND_API_KEY not set — email skipped');
    return res.status(200).json({ success: true });
  }

  const resend = new Resend(resendKey);

  const safeFirstName = (firstName || 'Assessment').replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  const pdfFilename = `Forc-Advisory-Tech-Cost-Audit-${safeFirstName}.pdf`;

  const emailPayload = {
    from: 'Forc Advisory <chenge@forcadvisory.com>',
    reply_to: 'chenge@forcadvisory.com',
    to: [email],
    bcc: ['chenge@forcadvisory.com'],
    subject: 'Your Tech Cost Maturity Assessment, Forc Advisory',
    html
  };

  if (pdfBuffer) {
    emailPayload.attachments = [{
      filename: pdfFilename,
      content: pdfBuffer.toString('base64'),
      content_type: 'application/pdf'
    }];
  }

  try {
    const result = await resend.emails.send(emailPayload);
    if (result.error) {
      console.error('Resend error:', result.error);
    }
  } catch (err) {
    console.error('Email send failed:', err.message);
  }

  return res.status(200).json({ success: true });
}

function buildEmailHTML({ firstName, tierNumber, tierName, tierDescription, exposure, illustrative, categoryScores, findingsBrief, calendlyUrl }) {
  const catRows = Object.entries(categoryScores || {}).map(([cat, score]) => {
    return `<tr>
      <td style="padding:10px 0;font-size:13px;color:#444444;border-bottom:1px solid #eeeeee">${cat}</td>
      <td style="padding:10px 0;font-size:13px;color:#2d3238;font-weight:600;text-align:right;border-bottom:1px solid #eeeeee">${score} / 6</td>
    </tr>`;
  }).join('');

  const findingsFormatted = (findingsBrief || '').split('\n').filter(l => l.trim()).map(line => {
    return `<p style="margin:0 0 14px;font-size:14px;line-height:1.75;color:#444444">${line.trim()}</p>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#ffffff">

  <!-- Header -->
  <div style="background:#2d3238;padding:20px 32px">
    <p style="margin:0;font-size:13px;font-weight:600;color:#ffffff;letter-spacing:0.08em;text-transform:uppercase">Forc Advisory</p>
    <div style="border-top:1px solid rgba(255,255,255,0.15);margin-top:12px"></div>
  </div>

  <!-- Body -->
  <div style="padding:32px 32px 0">
    <p style="margin:0 0 24px;font-size:15px;color:#2d3238">Hi ${firstName},</p>
    <p style="margin:0 0 32px;font-size:14px;line-height:1.75;color:#444444">Thank you for completing The Tech Cost Maturity Assessment. Your results are below, and a copy of this report is attached as a PDF.</p>

    <!-- Maturity block -->
    <div style="background:#2d3238;border-radius:6px;padding:24px 28px;margin-bottom:32px">
      <p style="margin:0 0 4px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.5);letter-spacing:0.1em;text-transform:uppercase">Assessment Summary</p>
      <p style="margin:0 0 16px;font-size:19px;font-weight:700;color:#ffffff">Your Technology Cost Maturity: ${tierName}</p>
      <p style="margin:0 0 10px;font-size:13px;color:rgba(255,255,255,0.55)">Indicative exposure: <span style="color:#ffffff;font-weight:600">${exposure} of total technology spend</span></p>
      ${illustrative ? `<p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6">${illustrative}</p>` : ''}
    </div>

    <!-- Category scores -->
    <div style="margin-bottom:32px">
      <p style="margin:0 0 4px;font-size:10px;font-weight:600;color:#999999;letter-spacing:0.1em;text-transform:uppercase">Category Scores</p>
      <div style="border-top:1px solid #eeeeee;margin-top:8px"></div>
      <table style="width:100%;border-collapse:collapse">
        ${catRows}
      </table>
    </div>

    <!-- Review Results CTA -->
    <div style="margin-bottom:32px">
      <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#2d3238">Review Results</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.75;color:#444444">Book a free 30-minute review with Chenge at Forc Advisory. We will walk through your assessment, identify your key exposure areas, and talk through what good looks like at your stage of growth.</p>
      <p style="margin:0"><a href="${calendlyUrl}" style="color:#2d3238;font-size:14px;font-weight:600;text-decoration:underline">${calendlyUrl}</a></p>
    </div>

    <!-- Findings brief -->
    <div style="margin-bottom:32px">
      <p style="margin:0 0 4px;font-size:10px;font-weight:600;color:#999999;letter-spacing:0.1em;text-transform:uppercase">Findings Brief</p>
      <div style="border-top:1px solid #eeeeee;margin-top:8px;margin-bottom:16px"></div>
      ${findingsFormatted}
    </div>

    <!-- Sign off -->
    <div style="margin-bottom:32px">
      <p style="margin:0 0 2px;font-size:14px;color:#444444">Chenge</p>
      <p style="margin:0;font-size:14px;color:#444444">Forc Advisory</p>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f9f9f9;padding:20px 32px;text-align:center">
    <p style="margin:0;font-size:11px;color:#999999">Forc Advisory &nbsp;|&nbsp; Confidential &nbsp;|&nbsp; forcadvisory.com</p>
  </div>

</div>
</body>
</html>`;
}

async function buildPDF({ firstName, tierNumber, tierName, tierDescription, exposure, illustrative, categoryScores, findingsBrief, calendlyUrl }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: true, size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const M = 60;
    const USABLE = PAGE_W - M * 2;
    const CONTENT_TOP = M + 36;
    const CONTENT_BOTTOM = PAGE_H - 70;
    const DARK = '#2d3238';
    const MID = '#444444';
    const LIGHT = '#999999';
    const RULE = '#e0e0e0';

    function drawHeader() {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK)
        .text('FORC ADVISORY', M, M, { align: 'left', continued: false, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#888888')
        .text('The Tech Cost Maturity Assessment', M, M, { align: 'right', width: USABLE, lineBreak: false });
      doc.moveTo(M, M + 18).lineTo(M + USABLE, M + 18).strokeColor(RULE).lineWidth(0.5).stroke();
    }

    function drawFooter() {
      const fy = PAGE_H - 50;
      doc.moveTo(M, fy).lineTo(M + USABLE, fy).strokeColor(RULE).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(9).fillColor('#aaaaaa')
        .text('Forc Advisory  |  Confidential  |  forcadvisory.com', M, fy + 10, { align: 'center', width: USABLE });
    }

    drawHeader();
    drawFooter();
    let y = CONTENT_TOP;

    function needsPage(spaceNeeded) {
      if (y + spaceNeeded > CONTENT_BOTTOM) {
        doc.addPage();
        drawHeader();
        drawFooter();
        y = CONTENT_TOP;
        return true;
      }
      return false;
    }

    function measureH(text, fontSize, opts = {}) {
      return doc.heightOfString(text, { width: USABLE, lineGap: 3, ...opts, fontSize });
    }

    // Title block
    needsPage(80);
    doc.font('Helvetica-Bold').fontSize(22).fillColor(DARK);
    const titleH = measureH('The Tech Cost Maturity Assessment', 22);
    doc.text('The Tech Cost Maturity Assessment', M, y, { width: USABLE });
    y += titleH + 12;

    doc.font('Helvetica').fontSize(14).fillColor('#666666');
    doc.text(firstName, M, y, { width: USABLE });
    y += 22;

    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.font('Helvetica').fontSize(11).fillColor(LIGHT);
    doc.text(dateStr, M, y, { width: USABLE });
    y += 40;

    function sectionHeading(label) {
      needsPage(34);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(LIGHT)
        .text(label.toUpperCase(), M, y, { characterSpacing: 0.8, width: USABLE });
      y += 14;
      doc.moveTo(M, y).lineTo(M + USABLE, y).strokeColor(RULE).lineWidth(0.5).stroke();
      y += 16;
    }

    // Assessment Summary
    sectionHeading('Assessment Summary');
    needsPage(36);
    doc.font('Helvetica-Bold').fontSize(16).fillColor(DARK)
      .text(`Your Technology Cost Maturity: ${tierName}`, M, y, { width: USABLE });
    y += 28;

    needsPage(28);
    doc.font('Helvetica').fontSize(11).fillColor(DARK);
    doc.text('Indicative exposure: ', M, y, { continued: true, width: USABLE });
    doc.font('Helvetica-Bold').fontSize(11).text(`${exposure} of total technology spend`, { continued: false });
    y += 22;

    if (illustrative) {
      doc.font('Helvetica').fontSize(10).fillColor('#888888');
      const illusH = measureH(illustrative, 10, { lineGap: 2 });
      needsPage(illusH + 12);
      doc.text(illustrative, M, y, { width: USABLE, lineGap: 2 });
      y += illusH + 28;
    } else {
      y += 16;
    }

    // Category Scores
    sectionHeading('Category Scores');
    const catEntries = Object.entries(categoryScores || {});
    for (const [cat, score] of catEntries) {
      needsPage(32);
      doc.font('Helvetica').fontSize(11).fillColor(MID)
        .text(cat, M, y, { width: USABLE * 0.7, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
        .text(`${score} / 6`, M, y, { align: 'right', width: USABLE, lineBreak: false });
      y += 22;
      doc.moveTo(M, y - 4).lineTo(M + USABLE, y - 4).strokeColor('#eeeeee').lineWidth(0.4).stroke();
    }
    y += 20;

    // Review Results CTA
    const ctaBody = 'Book a free 30-minute review with Chenge at Forc Advisory. We will walk through your assessment, identify your key exposure areas, and talk through what good looks like at your stage of growth.';
    doc.font('Helvetica').fontSize(11).fillColor(MID);
    const ctaH = measureH(ctaBody, 11);
    needsPage(ctaH + 56);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(DARK)
      .text('Review Results', M, y, { width: USABLE });
    y += 20;
    doc.font('Helvetica').fontSize(11).fillColor(MID)
      .text(ctaBody, M, y, { width: USABLE, lineGap: 3 });
    y += ctaH + 12;
    doc.font('Helvetica').fontSize(10).fillColor(DARK)
      .text(calendlyUrl, M, y, { width: USABLE, underline: true });
    y += 32;

    // Findings Brief
    sectionHeading('Findings Brief');
    const paragraphs = (findingsBrief || '').split('\n').filter(l => l.trim());
    for (const para of paragraphs) {
      doc.font('Helvetica').fontSize(11).fillColor(MID);
      const h = measureH(para, 11);
      needsPage(h + 18);
      doc.text(para, M, y, { width: USABLE, lineGap: 3 });
      y += h + 18;
    }

    doc.end();
  });
}
