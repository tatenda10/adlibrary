const pool = require('../db/connection');

async function createSupportMessage(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const message = String(req.body?.message || '').trim();

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    await pool.query(
      `CREATE TABLE IF NOT EXISTS support_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        source VARCHAR(64) DEFAULT 'landing_chat',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await pool.query(
      `INSERT INTO support_messages (name, email, message, source)
       VALUES (?, ?, ?, ?)`,
      [name, email, message, 'landing_chat']
    );

    const supportInbox = process.env.SUPPORT_EMAIL_TO || 'support@viraladlbrary.site';
    const resendApiKey = process.env.RESEND_API_KEY || '';
    let emailed = false;

    if (resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.SUPPORT_FROM_EMAIL || 'ViralAdLibrary <support@viraladlbrary.site>',
            to: [supportInbox],
            subject: `New support chat message from ${name}`,
            html: `
              <p><strong>Name:</strong> ${escapeHtml(name)}</p>
              <p><strong>Email:</strong> ${escapeHtml(email)}</p>
              <p><strong>Message:</strong></p>
              <p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
            `,
          }),
        });
        emailed = response.ok;
      } catch {
        emailed = false;
      }
    }

    return res.status(201).json({
      ok: true,
      emailed,
      message: emailed
        ? 'Thanks, your message was emailed to support.'
        : 'Thanks, your message was received by support.',
    });
  } catch (error) {
    console.error('createSupportMessage error:', error);
    return res.status(500).json({ error: 'Failed to submit support message.' });
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  createSupportMessage,
};
