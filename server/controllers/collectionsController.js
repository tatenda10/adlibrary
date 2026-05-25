const pool = require('../db/connection');
const { ensureUser } = require('../utils/users');

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeCollectionRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    platform: row.platform,
    source: row.source,
    name: row.name,
    keyword: row.query_text || '',
    query: row.query_text || '',
    limit: row.limit_count || 20,
    sortBy: row.sort_by || 'relevance',
    intelligent: Boolean(row.intelligent),
    prompt: row.prompt_text || '',
    results: parseJson(row.results_json, []),
    plan: parseJson(row.plan_json, null),
    meta: parseJson(row.meta_json, {}),
    is_archived: Boolean(row.is_archived),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listCollections(req, res) {
  try {
    await ensureUser(req.user);
    const platform = String(req.query?.platform || '').trim().toLowerCase();
    const includeArchived = String(req.query?.includeArchived || '').trim() === '1';
    const params = [req.user.id];
    let sql = `SELECT *
       FROM saved_collections
       WHERE user_id = ?`;
    if (platform) {
      sql += ' AND platform = ?';
      params.push(platform);
    }
    if (!includeArchived) {
      sql += ' AND is_archived = 0';
    }
    sql += ' ORDER BY updated_at DESC LIMIT 200';
    const [rows] = await pool.query(sql, params);
    return res.json({ collections: (rows || []).map(normalizeCollectionRow) });
  } catch (error) {
    console.error('listCollections error:', error);
    return res.status(500).json({ error: 'Failed to fetch collections.' });
  }
}

async function getCollection(req, res) {
  try {
    await ensureUser(req.user);
    const id = Number(req.params?.id || 0);
    if (!id) return res.status(400).json({ error: 'Invalid collection id.' });
    const [rows] = await pool.query(
      `SELECT * FROM saved_collections WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Collection not found.' });
    return res.json({ collection: normalizeCollectionRow(rows[0]) });
  } catch (error) {
    console.error('getCollection error:', error);
    return res.status(500).json({ error: 'Failed to load collection.' });
  }
}

async function createCollection(req, res) {
  try {
    await ensureUser(req.user);
    const platform = String(req.body?.platform || 'tiktok').trim().toLowerCase();
    const name = String(req.body?.name || req.body?.keyword || 'Untitled collection').trim();
    if (!name) return res.status(400).json({ error: 'Collection name is required.' });

    const [result] = await pool.query(
      `INSERT INTO saved_collections (
        user_id, platform, source, name, query_text, limit_count, sort_by,
        intelligent, prompt_text, results_json, plan_json, meta_json, is_archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        req.user.id,
        platform,
        String(req.body?.source || 'manual_search').trim().toLowerCase(),
        name,
        String(req.body?.keyword || req.body?.query || '').trim(),
        Number(req.body?.limit || 20),
        String(req.body?.sortBy || 'relevance').trim(),
        req.body?.intelligent ? 1 : 0,
        String(req.body?.prompt || '').trim(),
        JSON.stringify(Array.isArray(req.body?.results) ? req.body.results : []),
        JSON.stringify(req.body?.plan || null),
        JSON.stringify(req.body?.meta || {}),
      ]
    );

    const [rows] = await pool.query(`SELECT * FROM saved_collections WHERE id = ? LIMIT 1`, [result.insertId]);
    return res.status(201).json({ collection: normalizeCollectionRow(rows[0]) });
  } catch (error) {
    console.error('createCollection error:', error);
    return res.status(500).json({ error: 'Failed to save collection.' });
  }
}

async function updateCollection(req, res) {
  try {
    await ensureUser(req.user);
    const id = Number(req.params?.id || 0);
    if (!id) return res.status(400).json({ error: 'Invalid collection id.' });
    const [rows] = await pool.query(
      `SELECT * FROM saved_collections WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Collection not found.' });
    const existing = rows[0];

    const nextArchived = typeof req.body?.is_archived === 'boolean' ? Number(req.body.is_archived) : existing.is_archived;
    await pool.query(
      `UPDATE saved_collections
       SET name = ?,
           query_text = ?,
           limit_count = ?,
           sort_by = ?,
           intelligent = ?,
           prompt_text = ?,
           results_json = ?,
           plan_json = ?,
           meta_json = ?,
           is_archived = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        String(req.body?.name || existing.name).trim() || existing.name,
        String(req.body?.keyword || req.body?.query || existing.query_text || '').trim(),
        Number(req.body?.limit ?? existing.limit_count ?? 20),
        String(req.body?.sortBy || existing.sort_by || 'relevance').trim(),
        Object.prototype.hasOwnProperty.call(req.body || {}, 'intelligent')
          ? (req.body.intelligent ? 1 : 0)
          : existing.intelligent,
        String(req.body?.prompt ?? existing.prompt_text ?? '').trim(),
        JSON.stringify(
          Object.prototype.hasOwnProperty.call(req.body || {}, 'results')
            ? (Array.isArray(req.body?.results) ? req.body.results : [])
            : parseJson(existing.results_json, [])
        ),
        JSON.stringify(
          Object.prototype.hasOwnProperty.call(req.body || {}, 'plan')
            ? (req.body?.plan || null)
            : parseJson(existing.plan_json, null)
        ),
        JSON.stringify(
          Object.prototype.hasOwnProperty.call(req.body || {}, 'meta')
            ? (req.body?.meta || {})
            : parseJson(existing.meta_json, {})
        ),
        nextArchived,
        id,
        req.user.id,
      ]
    );

    const [updatedRows] = await pool.query(`SELECT * FROM saved_collections WHERE id = ? LIMIT 1`, [id]);
    return res.json({ collection: normalizeCollectionRow(updatedRows[0]) });
  } catch (error) {
    console.error('updateCollection error:', error);
    return res.status(500).json({ error: 'Failed to update collection.' });
  }
}

async function duplicateCollection(req, res) {
  try {
    await ensureUser(req.user);
    const id = Number(req.params?.id || 0);
    if (!id) return res.status(400).json({ error: 'Invalid collection id.' });
    const [rows] = await pool.query(
      `SELECT * FROM saved_collections WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Collection not found.' });

    const row = rows[0];
    const [result] = await pool.query(
      `INSERT INTO saved_collections (
        user_id, platform, source, name, query_text, limit_count, sort_by,
        intelligent, prompt_text, results_json, plan_json, meta_json, is_archived
      )
      SELECT user_id, platform, source, CONCAT(name, ' copy'), query_text, limit_count, sort_by,
             intelligent, prompt_text, results_json, plan_json, meta_json, 0
      FROM saved_collections WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    const [createdRows] = await pool.query(`SELECT * FROM saved_collections WHERE id = ? LIMIT 1`, [result.insertId]);
    return res.status(201).json({ collection: normalizeCollectionRow(createdRows[0]) });
  } catch (error) {
    console.error('duplicateCollection error:', error);
    return res.status(500).json({ error: 'Failed to duplicate collection.' });
  }
}

async function deleteCollection(req, res) {
  try {
    await ensureUser(req.user);
    const id = Number(req.params?.id || 0);
    if (!id) return res.status(400).json({ error: 'Invalid collection id.' });
    const [result] = await pool.query(
      `DELETE FROM saved_collections WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Collection not found.' });
    return res.json({ ok: true });
  } catch (error) {
    console.error('deleteCollection error:', error);
    return res.status(500).json({ error: 'Failed to delete collection.' });
  }
}

module.exports = {
  createCollection,
  deleteCollection,
  duplicateCollection,
  getCollection,
  listCollections,
  updateCollection,
};
