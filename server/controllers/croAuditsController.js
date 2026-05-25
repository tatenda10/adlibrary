const pool = require('../db/connection');

function parseJsonField(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeUrl(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  return /^https?:\/\//i.test(input) ? input : `https://${input}`;
}

function normalizeAuditRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    website_url: row.website_url,
    overall_score: row.overall_score == null ? null : Number(row.overall_score),
    grade: row.grade || null,
    audit: parseJsonField(row.audit_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function ensureUser(user) {
  const email = user.email || `${user.id}@clerk.local`;
  const username = user.username || null;

  await pool.query(
    `INSERT INTO users (id, email, username)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), username = VALUES(username)`,
    [user.id, email, username]
  );
}

async function ensureCroAuditsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cro_audits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      website_url VARCHAR(2048) NOT NULL,
      overall_score INT DEFAULT NULL,
      grade VARCHAR(8) DEFAULT NULL,
      audit_json JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_website (user_id, website_url(255)),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

async function listCroAudits(req, res) {
  try {
    await ensureUser(req.user);
    await ensureCroAuditsTable();

    const [rows] = await pool.query(
      `SELECT id, user_id, website_url, overall_score, grade, audit_json, created_at, updated_at
       FROM cro_audits
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [req.user.id]
    );

    return res.json(rows.map(normalizeAuditRow));
  } catch (error) {
    console.error('listCroAudits error:', error);
    return res.status(500).json({ error: 'Failed to fetch CRO audits' });
  }
}

async function saveCroAudit(req, res) {
  try {
    await ensureUser(req.user);
    await ensureCroAuditsTable();

    const websiteUrl = normalizeUrl(req.body?.websiteUrl);
    const audit = req.body?.audit || null;

    if (!websiteUrl) {
      return res.status(400).json({ error: 'websiteUrl is required' });
    }

    if (!audit || typeof audit !== 'object') {
      return res.status(400).json({ error: 'audit is required' });
    }

    const overallScore = audit?.summary?.overall_score == null ? null : Number(audit.summary.overall_score);
    const grade = audit?.summary?.grade ? String(audit.summary.grade).trim() : null;

    await pool.query(
      `INSERT INTO cro_audits (user_id, website_url, overall_score, grade, audit_json)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         overall_score = VALUES(overall_score),
         grade = VALUES(grade),
         audit_json = VALUES(audit_json),
         updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, websiteUrl, Number.isFinite(overallScore) ? overallScore : null, grade, JSON.stringify(audit)]
    );

    const [rows] = await pool.query(
      `SELECT id, user_id, website_url, overall_score, grade, audit_json, created_at, updated_at
       FROM cro_audits
       WHERE user_id = ? AND website_url = ?
       LIMIT 1`,
      [req.user.id, websiteUrl]
    );

    return res.status(201).json(normalizeAuditRow(rows[0]));
  } catch (error) {
    console.error('saveCroAudit error:', error);
    return res.status(500).json({ error: 'Failed to save CRO audit' });
  }
}

async function deleteCroAudit(req, res) {
  try {
    await ensureCroAuditsTable();

    const { id } = req.params;
    const [result] = await pool.query(
      `DELETE FROM cro_audits WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'CRO audit not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('deleteCroAudit error:', error);
    return res.status(500).json({ error: 'Failed to delete CRO audit' });
  }
}

module.exports = {
  listCroAudits,
  saveCroAudit,
  deleteCroAudit,
};
