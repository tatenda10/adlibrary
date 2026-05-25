const pool = require('../db/connection');
const { ensureUser } = require('./users');
const { toUserFacingError } = require('./userFacingError');

function createWorkspaceController(config) {
  const {
    folderTable,
    videoTable,
    urlColumn,
    urlBodyKeys = ['url'],
    maxFoldersEnv,
    maxVideosEnv,
    defaultMaxFolders = 50,
    defaultMaxVideos = 100,
    normalizeUrl,
    extractContentId,
    resolveLinkMeta,
    invalidUrlMessage,
    addErrorMessage,
  } = config;

  const MAX_FOLDERS_PER_USER = Math.min(
    Math.max(Number(process.env[maxFoldersEnv] || defaultMaxFolders), 1),
    200
  );
  const MAX_VIDEOS_PER_FOLDER = Math.min(
    Math.max(Number(process.env[maxVideosEnv] || defaultMaxVideos), 1),
    500
  );

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
    const item = {
      id: row.id,
      folder_id: row.folder_id,
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
    item[urlColumn] = row[urlColumn] || '';
    return item;
  }

  async function getOwnedFolder(folderId, userId) {
    const id = Number(folderId);
    if (!id) return null;
    const [rows] = await pool.query(
      `SELECT * FROM ${folderTable} WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, userId]
    );
    return rows[0] || null;
  }

  function readUrlFromBody(body = {}) {
    for (const key of urlBodyKeys) {
      const value = String(body?.[key] || '').trim();
      if (value) return value;
    }
    return '';
  }

  async function refreshVideoMetaIfNeeded(row) {
    if (!row || typeof resolveLinkMeta !== 'function') return row;

    const hasCaption = Boolean(String(row.caption || '').trim());
    const hasAuthor = Boolean(String(row.author_name || '').trim());
    const hasThumbnail = Boolean(String(row.thumbnail_url || '').trim());
    const hasPlayback = Boolean(String(row.source_video_stream_url || '').trim());

    if (hasCaption && hasAuthor && hasThumbnail && hasPlayback) {
      return row;
    }

    const contentUrl = String(row[urlColumn] || '').trim();
    if (!contentUrl) return row;

    const meta = await resolveLinkMeta(contentUrl);
    const nextCaption = hasCaption ? row.caption || '' : meta?.caption || '';
    const nextAuthorName = hasAuthor ? row.author_name || '' : meta?.author_name || '';
    const nextAuthorUsername = row.author_username || meta?.author_username || '';
    const nextThumbnail = hasThumbnail ? row.thumbnail_url || '' : meta?.thumbnail_url || '';
    const nextPlayback = hasPlayback
      ? row.source_video_stream_url || ''
      : meta?.source_video_stream_url || '';

    if (
      nextCaption === (row.caption || '') &&
      nextAuthorName === (row.author_name || '') &&
      nextAuthorUsername === (row.author_username || '') &&
      nextThumbnail === (row.thumbnail_url || '') &&
      nextPlayback === (row.source_video_stream_url || '')
    ) {
      return row;
    }

    const nextMeta = {
      ...parseJson(row.meta_json, {}),
      saved_as_link: true,
      oembed: Boolean(nextCaption || nextAuthorName || nextThumbnail || nextPlayback),
      source_video_stream_url: nextPlayback,
    };

    await pool.query(
      `UPDATE ${videoTable}
       SET caption = ?, author_name = ?, author_username = ?, thumbnail_url = ?, source_video_stream_url = ?, meta_json = ?
       WHERE id = ? AND user_id = ?`,
      [
        nextCaption,
        nextAuthorName,
        nextAuthorUsername,
        nextThumbnail,
        nextPlayback,
        JSON.stringify(nextMeta),
        row.id,
        row.user_id,
      ]
    );

    return {
      ...row,
      caption: nextCaption,
      author_name: nextAuthorName,
      author_username: nextAuthorUsername,
      thumbnail_url: nextThumbnail,
      source_video_stream_url: nextPlayback,
      meta_json: nextMeta,
    };
  }

  async function listFolders(req, res) {
    try {
      await ensureUser(req.user);
      const [rows] = await pool.query(
        `SELECT f.*, COUNT(v.id) AS video_count
         FROM ${folderTable} f
         LEFT JOIN ${videoTable} v ON v.folder_id = f.id
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
      console.error(`listWorkspaceFolders (${folderTable}) error:`, error);
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
        `INSERT INTO ${folderTable} (user_id, name) VALUES (?, ?)`,
        [req.user.id, name]
      );

      const [rows] = await pool.query(`SELECT * FROM ${folderTable} WHERE id = ? LIMIT 1`, [
        result.insertId,
      ]);

      return res.status(201).json({ folder: normalizeFolderRow(rows[0], 0) });
    } catch (error) {
      console.error(`createWorkspaceFolder (${folderTable}) error:`, error);
      return res.status(500).json({ error: 'Failed to create folder.' });
    }
  }

  async function getFolder(req, res) {
    try {
      await ensureUser(req.user);
      const folder = await getOwnedFolder(req.params.folderId, req.user.id);
      if (!folder) return res.status(404).json({ error: 'Folder not found.' });

      const [videoRows] = await pool.query(
        `SELECT * FROM ${videoTable}
         WHERE folder_id = ? AND user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [folder.id, req.user.id, MAX_VIDEOS_PER_FOLDER]
      );

      const hydratedRows = await Promise.all((videoRows || []).map(refreshVideoMetaIfNeeded));

      return res.json({
        folder: normalizeFolderRow(folder, hydratedRows.length),
        videos: hydratedRows.map(normalizeVideoRow),
      });
    } catch (error) {
      console.error(`getWorkspaceFolder (${folderTable}) error:`, error);
      return res.status(500).json({ error: 'Failed to load folder.' });
    }
  }

  async function deleteFolder(req, res) {
    try {
      await ensureUser(req.user);
      const folder = await getOwnedFolder(req.params.folderId, req.user.id);
      if (!folder) return res.status(404).json({ error: 'Folder not found.' });

      await pool.query(`DELETE FROM ${videoTable} WHERE folder_id = ? AND user_id = ?`, [
        folder.id,
        req.user.id,
      ]);
      await pool.query(`DELETE FROM ${folderTable} WHERE id = ? AND user_id = ?`, [
        folder.id,
        req.user.id,
      ]);

      return res.json({ ok: true });
    } catch (error) {
      console.error(`deleteWorkspaceFolder (${folderTable}) error:`, error);
      return res.status(500).json({ error: 'Failed to delete folder.' });
    }
  }

  async function addVideoToFolder(req, res) {
    try {
      await ensureUser(req.user);
      const folder = await getOwnedFolder(req.params.folderId, req.user.id);
      if (!folder) return res.status(404).json({ error: 'Folder not found.' });

    const rawUrl = readUrlFromBody(req.body);
    const contentUrl = await Promise.resolve(normalizeUrl(rawUrl));
    if (!contentUrl) {
        return res.status(400).json({ error: invalidUrlMessage });
      }

      const [existing] = await pool.query(
        `SELECT id FROM ${videoTable} WHERE folder_id = ? AND ${urlColumn} = ? LIMIT 1`,
        [folder.id, contentUrl]
      );
      if (existing.length) {
        return res.status(409).json({ error: 'This link is already in the folder.' });
      }

      const contentId = extractContentId(contentUrl) || null;
      const meta = await resolveLinkMeta(contentUrl);

      const [insertResult] = await pool.query(
        `INSERT INTO ${videoTable} (
          folder_id, user_id, ${urlColumn}, video_id, caption, author_name, author_username,
          thumbnail_url, source_video_stream_url, views, likes, comments, shares, meta_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)`,
        [
          folder.id,
          req.user.id,
          contentUrl,
          contentId,
          meta.caption || '',
          meta.author_name || '',
          meta.author_username || '',
          meta.thumbnail_url || '',
          meta.source_video_stream_url || '',
          JSON.stringify({
            saved_as_link: true,
            oembed: Boolean(
              meta.caption ||
                meta.author_name ||
                meta.thumbnail_url ||
                meta.source_video_stream_url
            ),
            source_video_stream_url: meta.source_video_stream_url || '',
          }),
        ]
      );

      await pool.query(`UPDATE ${folderTable} SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
        folder.id,
      ]);

      const [rows] = await pool.query(`SELECT * FROM ${videoTable} WHERE id = ? LIMIT 1`, [
        insertResult.insertId,
      ]);

      return res.status(201).json({ video: normalizeVideoRow(rows[0]) });
    } catch (error) {
      console.error(`addWorkspaceVideo (${videoTable}) error:`, error);
      return res.status(error.statusCode || 500).json({
        error: toUserFacingError(error.message, addErrorMessage),
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
        `DELETE FROM ${videoTable} WHERE id = ? AND folder_id = ? AND user_id = ?`,
        [videoId, folder.id, req.user.id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({ error: 'Video not found.' });
      }

      await pool.query(`UPDATE ${folderTable} SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
        folder.id,
      ]);

      return res.json({ ok: true });
    } catch (error) {
      console.error(`deleteWorkspaceVideo (${videoTable}) error:`, error);
      return res.status(500).json({ error: 'Failed to delete video.' });
    }
  }

  return {
    listFolders,
    createFolder,
    getFolder,
    deleteFolder,
    addVideoToFolder,
    deleteVideoFromFolder,
  };
}

module.exports = { createWorkspaceController };
