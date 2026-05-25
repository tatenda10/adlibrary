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

function normalizeBookmarkRow(row) {
  return {
    ...row,
    ai_analysis: parseJsonField(row.ai_analysis),
    tags: parseJsonField(row.tags),
  };
}

function pickFirstUrl(videoData = {}) {
  const candidates = [
    videoData.url,
    videoData.tiktok_url,
    videoData.webVideoUrl,
    videoData.shareUrl,
    videoData.permalink,
    videoData.video_stream_url,
    videoData.videoStreamUrl,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return '';
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

async function getBookmarks(req, res) {
  try {
    await ensureUser(req.user);

    const [rows] = await pool.query(
      `SELECT id, user_id, tiktok_url, thumbnail, caption, author, views, likes, shares, comments, ai_analysis, tags, created_at
       FROM bookmarks
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return res.json(rows.map(normalizeBookmarkRow));
  } catch (error) {
    console.error('getBookmarks error:', error);
    return res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
}

async function createBookmark(req, res) {
  try {
    await ensureUser(req.user);

    const { videoData, aiAnalysis } = req.body;
    const videoUrl = pickFirstUrl(videoData || {});

    if (!videoData || !videoUrl) {
      const keys = videoData ? Object.keys(videoData) : [];
      return res.status(400).json({
        error: `videoData url is required (url, tiktok_url, webVideoUrl, video_stream_url). Received keys: ${keys.join(', ') || 'none'}`,
      });
    }

    const [result] = await pool.query(
      `INSERT INTO bookmarks (
        user_id, tiktok_url, thumbnail, caption, author, views, likes, shares, comments, ai_analysis, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        videoUrl,
        videoData.thumbnail || null,
        videoData.caption || null,
        videoData.author || null,
        Number(videoData.views || 0),
        Number(videoData.likes || 0),
        Number(videoData.shares || 0),
        Number(videoData.comments || 0),
        aiAnalysis ? JSON.stringify(aiAnalysis) : null,
        videoData.tags ? JSON.stringify(videoData.tags) : null,
      ]
    );

    const [rows] = await pool.query(
      `SELECT id, user_id, tiktok_url, thumbnail, caption, author, views, likes, shares, comments, ai_analysis, tags, created_at
       FROM bookmarks WHERE id = ?`,
      [result.insertId]
    );

    return res.status(201).json(normalizeBookmarkRow(rows[0]));
  } catch (error) {
    console.error('createBookmark error:', error);
    return res.status(500).json({ error: 'Failed to save bookmark' });
  }
}

async function deleteBookmark(req, res) {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `DELETE FROM bookmarks WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('deleteBookmark error:', error);
    return res.status(500).json({ error: 'Failed to delete bookmark' });
  }
}

module.exports = {
  getBookmarks,
  createBookmark,
  deleteBookmark,
};
