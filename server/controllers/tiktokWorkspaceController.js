const pool = require('../db/connection');
const { ensureUser } = require('../utils/users');
const { toUserFacingError } = require('../utils/userFacingError');
const { extractTikTokVideoId, isPublicTikTokUrl } = require('./searchController');
const { extractUsernameFromUrl, resolveWorkspaceLinkMeta } = require('../utils/tiktokLinkMeta');

function normalizeWorkspaceTikTokUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!isPublicTikTokUrl(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname || '';

    if (host.includes('tiktok.com') && /\/video\/\d+/i.test(path)) {
      return `https://www.tiktok.com${path.replace(/\/+$/, '')}`;
    }

    return `${parsed.protocol}//${parsed.host}${path}`.replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
}

const MAX_VIDEOS_PER_FOLDER = Math.min(Math.max(Number(process.env.TIKTOK_WORKSPACE_MAX_VIDEOS || 100), 1), 500);

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeFolderRow(row, videoCount = 0) {
  return {
    id: row.id,
    name: row.name,
    video_count: Number(videoCount) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeVideoRow(row) {
  return {
    id: row.id,
    folder_id: row.folder_id,
    tiktok_url: row.tiktok_url,
    video_id: row.video_id || '',
    caption: row.caption || '',
    author_name: row.author_name || '',
    author_username: row.author_username || '',
    thumbnail: row.thumbnail_url || '',
    source_video_stream_url: row.source_video_stream_url || '',
    views: Number(row.views) || 0,
    likes: Number(row.likes) || 0,
    comments: Number(row.comments) || 0,
    shares: Number(row.shares) || 0,
    meta: parseJson(row.meta_json, {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getOwnedFolder(folderId, userId) {
  const id = Number(folderId);
  if (!id) return null;
  const [rows] = await pool.query(
    `SELECT * FROM tiktok_workspace_folders WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  return rows[0] || null;
}

async function listFolders(req, res) {
  try {
    await ensureUser(req.user);
    const [rows] = await pool.query(
      `SELECT f.*, COUNT(v.id) AS video_count
       FROM tiktok_workspace_folders f
       LEFT JOIN tiktok_workspace_videos v ON v.folder_id = f.id
       WHERE f.user_id = ?
       GROUP BY f.id
       ORDER BY f.updated_at DESC
       LIMIT 200`,
      [req.user.id]
    );

    return res.json({
      folders: (rows || []).map((row) => normalizeFolderRow(row, row.video_count)),
    });
  } catch (error) {
    console.error('listWorkspaceFolders error:', error);
    return res.status(500).json({ error: 'Failed to load workspace folders.' });
  }
}

async function createFolder(req, res) {
  try {
    await ensureUser(req.user);
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Folder name is required.' });
    if (name.length > 255) return res.status(400).json({ error: 'Folder name is too long.' });

    const [result] = await pool.query(
      `INSERT INTO tiktok_workspace_folders (user_id, name) VALUES (?, ?)`,
      [req.user.id, name]
    );

    const [rows] = await pool.query(`SELECT * FROM tiktok_workspace_folders WHERE id = ? LIMIT 1`, [
      result.insertId,
    ]);

    return res.status(201).json({ folder: normalizeFolderRow(rows[0], 0) });
  } catch (error) {
    console.error('createWorkspaceFolder error:', error);
    return res.status(500).json({ error: 'Failed to create folder.' });
  }
}

async function getFolder(req, res) {
  try {
    await ensureUser(req.user);
    const folder = await getOwnedFolder(req.params.folderId, req.user.id);
    if (!folder) return res.status(404).json({ error: 'Folder not found.' });

    const [videoRows] = await pool.query(
      `SELECT * FROM tiktok_workspace_videos
       WHERE folder_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [folder.id, req.user.id, MAX_VIDEOS_PER_FOLDER]
    );

    return res.json({
      folder: normalizeFolderRow(folder, videoRows.length),
      videos: (videoRows || []).map(normalizeVideoRow),
    });
  } catch (error) {
    console.error('getWorkspaceFolder error:', error);
    return res.status(500).json({ error: 'Failed to load folder.' });
  }
}

async function deleteFolder(req, res) {
  try {
    await ensureUser(req.user);
    const folder = await getOwnedFolder(req.params.folderId, req.user.id);
    if (!folder) return res.status(404).json({ error: 'Folder not found.' });

    await pool.query(`DELETE FROM tiktok_workspace_videos WHERE folder_id = ? AND user_id = ?`, [
      folder.id,
      req.user.id,
    ]);
    await pool.query(`DELETE FROM tiktok_workspace_folders WHERE id = ? AND user_id = ?`, [
      folder.id,
      req.user.id,
    ]);

    return res.json({ ok: true });
  } catch (error) {
    console.error('deleteWorkspaceFolder error:', error);
    return res.status(500).json({ error: 'Failed to delete folder.' });
  }
}

async function addVideoToFolder(req, res) {
  try {
    await ensureUser(req.user);
    const folder = await getOwnedFolder(req.params.folderId, req.user.id);
    if (!folder) return res.status(404).json({ error: 'Folder not found.' });

    const rawUrl = String(req.body?.url || req.body?.tiktok_url || '').trim();
    const tiktokUrl = normalizeWorkspaceTikTokUrl(rawUrl);
    if (!tiktokUrl) {
      return res.status(400).json({ error: 'Enter a valid public TikTok video link.' });
    }

    const [existing] = await pool.query(
      `SELECT id FROM tiktok_workspace_videos WHERE folder_id = ? AND tiktok_url = ? LIMIT 1`,
      [folder.id, tiktokUrl]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'This video is already in the folder.' });
    }

    const videoId = extractTikTokVideoId(tiktokUrl) || null;
    const meta = await resolveWorkspaceLinkMeta(tiktokUrl);
    const username = meta.author_username || extractUsernameFromUrl(tiktokUrl) || '';

    const [insertResult] = await pool.query(
      `INSERT INTO tiktok_workspace_videos (
        folder_id, user_id, tiktok_url, video_id, caption, author_name, author_username,
        thumbnail_url, source_video_stream_url, views, likes, comments, shares, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 0, 0, 0, 0, ?)`,
      [
        folder.id,
        req.user.id,
        tiktokUrl,
        videoId,
        meta.caption || '',
        meta.author_name || '',
        username,
        meta.thumbnail_url || '',
        JSON.stringify({ saved_as_link: true, oembed: Boolean(meta.caption || meta.author_name) }),
      ]
    );

    await pool.query(`UPDATE tiktok_workspace_folders SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      folder.id,
    ]);

    const [rows] = await pool.query(`SELECT * FROM tiktok_workspace_videos WHERE id = ? LIMIT 1`, [
      insertResult.insertId,
    ]);

    return res.status(201).json({ video: normalizeVideoRow(rows[0]) });
  } catch (error) {
    console.error('addWorkspaceVideo error:', error);
    return res.status(error.statusCode || 500).json({
      error: toUserFacingError(
        error.message,
        'Could not add that TikTok link. Check the URL and try again.'
      ),
    });
  }
}

async function deleteVideoFromFolder(req, res) {
  try {
    await ensureUser(req.user);
    const folder = await getOwnedFolder(req.params.folderId, req.user.id);
    if (!folder) return res.status(404).json({ error: 'Folder not found.' });

    const videoId = Number(req.params.videoId);
    if (!videoId) return res.status(400).json({ error: 'Invalid video id.' });

    const [result] = await pool.query(
      `DELETE FROM tiktok_workspace_videos WHERE id = ? AND folder_id = ? AND user_id = ?`,
      [videoId, folder.id, req.user.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    await pool.query(`UPDATE tiktok_workspace_folders SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      folder.id,
    ]);

    return res.json({ ok: true });
  } catch (error) {
    console.error('deleteWorkspaceVideo error:', error);
    return res.status(500).json({ error: 'Failed to delete video.' });
  }
}

module.exports = {
  listFolders,
  createFolder,
  getFolder,
  deleteFolder,
  addVideoToFolder,
  deleteVideoFromFolder,
};
