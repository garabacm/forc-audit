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

async function buildPDF({ firstName, tierNumber, tierName, tierDescription, exposure, illustrative, categoryScores, findingsBrief }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: true, size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const M = 50;
    const USABLE = PAGE_W - M * 2;
    const DARK = '#1a1a1a';
    const RULE = '#d2d2d2';

    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    let y = 50;

    function hRule(atY) {
      doc.moveTo(M, atY).lineTo(M + USABLE, atY).strokeColor(RULE).lineWidth(0.4).stroke();
      return atY + 14;
    }

    function checkPage(spaceNeeded) {
      if (y + spaceNeeded > PAGE_H - 80) {
        doc.addPage();
        y = 50;
      }
    }

    function textH(text, fontSize, width, lineGap) {
      doc.fontSize(fontSize);
      return doc.heightOfString(String(text), { width: width || USABLE, lineGap: lineGap || 2 });
    }

    function ragColor(pct) {
      if (pct >= 67) return '#4ade80';
      if (pct >= 34) return '#facc15';
      return '#f87171';
    }
    function ragLabel(pct) {
      if (pct >= 67) return 'Strong';
      if (pct >= 34) return 'Developing';
      return 'Needs attention';
    }

    // === Top rule ===
    y = hRule(y);

    // === Brand header ===
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#969696');
    doc.text('FORC ADVISORY', M, y, { width: USABLE });
    y += 13;

    doc.font('Helvetica-Bold').fontSize(19).fillColor(DARK);
    const titleH = textH('The Tech Cost Maturity Assessment', 19);
    doc.text('The Tech Cost Maturity Assessment', M, y, { width: USABLE });
    y += titleH + 6;

    const dateLine = date + (firstName ? '  \u00B7  ' + firstName : '');
    doc.font('Helvetica').fontSize(9).fillColor('#8c8c8c');
    doc.text(dateLine, M, y, { width: USABLE });
    y += 36;

    // === Tier name (large) ===
    checkPage(90);
    doc.font('Helvetica-Bold').fontSize(48).fillColor(DARK);
    const tierNameH = textH(tierName, 48);
    doc.text(tierName, M, y, { width: USABLE });
    y += tierNameH + 10;

    // === Tier description ===
    if (tierDescription) {
      checkPage(40);
      doc.font('Helvetica').fontSize(10).fillColor('#646464');
      const descH = textH(tierDescription, 10);
      doc.text(tierDescription, M, y, { width: USABLE, lineGap: 2 });
      y += descH + 18;
    }

    // === Category Scores ===
    checkPage(60);
    y = hRule(y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK);
    doc.text('Category Scores', M, y, { width: USABLE });
    y += 18;

    const CAT_MAX = 6;
    for (const [cat, score] of Object.entries(categoryScores || {})) {
      checkPage(34);
      const pct = Math.round((score / CAT_MAX) * 100);

      doc.font('Helvetica').fontSize(10).fillColor(DARK)
        .text(cat, M, y, { width: USABLE, lineBreak: false });
      doc.font('Helvetica').fontSize(10).fillColor('#646464')
        .text(`${score}/${CAT_MAX}  \u2014  ${ragLabel(pct)}`, M, y, { align: 'right', width: USABLE, lineBreak: false });
      y += 14;

      // Progress bar
      doc.fillColor('#e6e6e6').rect(M, y - 4, USABLE, 3).fill();
      if (pct > 0) doc.fillColor(ragColor(pct)).rect(M, y - 4, USABLE * (pct / 100), 3).fill();
      y += 12;
    }

    y += 8;

    // === Diagnostic Summary ===
    checkPage(50);
    y = hRule(y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK);
    doc.text('Diagnostic Summary', M, y, { width: USABLE });
    y += 18;

    const rawLines = (findingsBrief || '').split('\n');
    for (const line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed) { y += 5; continue; }

      if (trimmed.startsWith('- ')) {
        const bulletText = trimmed.slice(2);
        checkPage(30);
        doc.font('Helvetica').fontSize(9).fillColor('#646464')
          .text('\u2192', M, y, { lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor(DARK)
          .text(bulletText, M + 14, y, { width: USABLE - 14, lineGap: 2 });
        const bH = textH(bulletText, 9, USABLE - 14, 2);
        y += bH + 4;
      } else {
        checkPage(30);
        doc.font('Helvetica').fontSize(10).fillColor(DARK);
        const h = textH(trimmed, 10);
        doc.text(trimmed, M, y, { width: USABLE, lineGap: 3 });
        y += h + 4;
      }
    }

    y += 14;

    // === Footer ===
    doc.moveTo(M, y).lineTo(M + USABLE, y).strokeColor(RULE).lineWidth(0.4).stroke();
    y += 10;
    doc.font('Helvetica').fontSize(8).fillColor('#969696');
    doc.text('Forc Advisory  \u2014  forcadvisory.com', M, y, { width: USABLE / 2 });
    doc.text(date, M, y, { align: 'right', width: USABLE });

    doc.end();
  });
}
