export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    firstName, email, score,
    visibilityScore, controlScore, readinessScore,
    weakestCategory, findingsText, answersData
  } = req.body;

  if (!email) return res.status(400).json({ error: 'Missing email' });

  const submittedAt = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short'
  });

  // --- Build findings HTML block ---
  let findingsHtml = '';
  if (findingsText) {
    let inner = '';
    for (const line of findingsText.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith('- ')) {
        inner += `<p style="margin:0 0 9px;padding-left:16px;font-size:13px;color:#222;position:relative"><span style="position:absolute;left:0;color:#aaa">→</span>${t.slice(2)}</p>`;
      } else {
        inner += `<p style="margin:0 0 10px;font-size:13px;color:#222">${t}</p>`;
      }
    }
    findingsHtml = `
<div style="border-top:1px solid #e5e5e5;margin-top:4px;padding-top:20px">
  <p style="font-size:11px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 14px">Diagnostic Summary</p>
  ${inner}
</div>`;
  }

  // --- Build answers HTML block ---
  let answersHtml = '';
  if (Array.isArray(answersData) && answersData.length) {
    // Group by category preserving order
    const groups = [];
    const groupMap = {};
    for (const item of answersData) {
      if (!groupMap[item.category]) {
        groupMap[item.category] = [];
        groups.push({ category: item.category, items: groupMap[item.category] });
      }
      groupMap[item.category].push(item);
    }
    let groupsHtml = '';
    for (const { category, items } of groups) {
      let rows = '';
      for (const item of items) {
        const dotColor = item.score >= 3 ? '#4ade80' : item.score >= 2 ? '#facc15' : item.score >= 1 ? '#fb923c' : '#f87171';
        rows += `
<tr>
  <td style="padding:8px 0 8px 0;vertical-align:top;font-size:12px;color:#555;width:55%;border-bottom:1px solid #f0f0f0">${item.question}</td>
  <td style="padding:8px 0 8px 12px;vertical-align:top;font-size:12px;color:#222;border-bottom:1px solid #f0f0f0">
    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};margin-right:6px;vertical-align:middle"></span>${item.answer}
  </td>
</tr>`;
      }
      groupsHtml += `
<p style="font-size:10px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;margin:16px 0 4px">${category}</p>
<table style="width:100%;border-collapse:collapse">${rows}</table>`;
    }
    answersHtml = `
<div style="border-top:1px solid #e5e5e5;margin-top:20px;padding-top:20px">
  <p style="font-size:11px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px">Full Answer Breakdown</p>
  ${groupsHtml}
</div>`;
  }

  // --- Email via Resend ---
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const scoreLabel = score >= 75 ? 'Strong foundations' : score >= 50 ? 'Reasonable controls' : score >= 25 ? 'Governance gaps' : 'Critical gaps';

    const html = `
<div style="font-family:system-ui,sans-serif;max-width:560px;color:#1a1a1a">
  <p style="font-size:12px;color:#aaa;margin:0 0 20px">Forc Advisory — Technology Governance Diagnostic</p>

  <h2 style="font-size:19px;margin:0 0 3px">${firstName || 'Anonymous'}</h2>
  <p style="font-size:13px;color:#666;margin:0 0 20px">${email}</p>

  <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;margin-bottom:20px">
    <p style="margin:0;font-size:30px;font-weight:700">${score}%</p>
    <p style="margin:4px 0 0;font-size:12px;color:#999">${scoreLabel}&nbsp;&nbsp;·&nbsp;&nbsp;Weakest: ${weakestCategory || 'n/a'}</p>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:9px 0;color:#555">Visibility</td>
      <td style="padding:9px 0;text-align:right;font-weight:500">${visibilityScore}/12</td>
    </tr>
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:9px 0;color:#555">Control</td>
      <td style="padding:9px 0;text-align:right;font-weight:500">${controlScore}/15</td>
    </tr>
    <tr>
      <td style="padding:9px 0;color:#555">Readiness</td>
      <td style="padding:9px 0;text-align:right;font-weight:500">${readinessScore}/9</td>
    </tr>
  </table>

  ${findingsHtml}

  ${answersHtml}

  <p style="font-size:11px;color:#ccc;margin:24px 0 0">${submittedAt}</p>
</div>`;

    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Forc Audit <onboarding@resend.dev>',
          to: ['chenge@forcadvisory.com'],
          subject: `Audit: ${firstName || email} — ${score}%`,
          html
        })
      });
      if (!emailRes.ok) {
        const detail = await emailRes.text();
        console.error('Resend error:', detail);
      }
    } catch (err) {
      console.error('Email send failed:', err.message);
    }
  } else {
    console.warn('RESEND_API_KEY not set — email skipped');
  }

  // --- Airtable (optional, silent failure) ---
  const atKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_TABLE_ID;

  if (atKey && baseId && tableId) {
    try {
      const atRes = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${atKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            'First Name': firstName || '',
            'Email': email,
            'Score': score,
            'Visibility': visibilityScore,
            'Control': controlScore,
            'Readiness': readinessScore,
            'Weakest Category': weakestCategory || '',
            'Submitted At': new Date().toISOString(),
            'Status': 'New'
          }
        })
      });
      if (!atRes.ok) console.error('Airtable error:', await atRes.text());
    } catch (err) {
      console.error('Airtable save failed:', err.message);
    }
  }

  return res.status(200).json({ success: true });
}
