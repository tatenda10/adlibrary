const pool = require('../db/connection');
const { createAdminToken, validateAdminCredentials } = require('../utils/adminAuth');

function normalizeArticleRow(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt || '',
    content: row.content || '',
    author: row.author || 'ViralAdLibrary Team',
    status: row.status || 'draft',
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function slugify(input = '') {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

async function adminLogin(req, res) {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const valid = await validateAdminCredentials(username, password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    const token = createAdminToken(username);
    return res.json({
      token,
      admin: { username },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to login as admin' });
  }
}

async function getPublicArticles(req, res) {
  try {
    const status = String(req.query?.status || 'published').toLowerCase();
    const [rows] = await pool.query(
      `SELECT id, title, slug, excerpt, content, author, status, published_at, created_at, updated_at
       FROM articles
       WHERE status = ?
       ORDER BY COALESCE(published_at, created_at) DESC`,
      [status]
    );
    return res.json(rows.map(normalizeArticleRow));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load articles' });
  }
}

async function getPublicArticleBySlug(req, res) {
  try {
    const slug = String(req.params?.slug || '').trim();
    const [rows] = await pool.query(
      `SELECT id, title, slug, excerpt, content, author, status, published_at, created_at, updated_at
       FROM articles
       WHERE slug = ? AND status = 'published'
       LIMIT 1`,
      [slug]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Article not found' });
    }
    return res.json(normalizeArticleRow(rows[0]));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load article' });
  }
}

async function getAdminArticles(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, slug, excerpt, content, author, status, published_at, created_at, updated_at
       FROM articles
       ORDER BY updated_at DESC`
    );
    return res.json(rows.map(normalizeArticleRow));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load admin articles' });
  }
}

async function createAdminArticle(req, res) {
  try {
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    const excerpt = String(req.body?.excerpt || '').trim();
    const author = String(req.body?.author || 'ViralAdLibrary Team').trim();
    const status = String(req.body?.status || 'draft').toLowerCase() === 'published' ? 'published' : 'draft';
    const slug = slugify(req.body?.slug || title);

    if (!title || !content || !slug) {
      return res.status(400).json({ error: 'Title, content, and slug are required' });
    }

    await pool.query(
      `INSERT INTO articles (title, slug, excerpt, content, author, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, excerpt, content, author, status, status === 'published' ? new Date() : null]
    );

    const [rows] = await pool.query(
      `SELECT id, title, slug, excerpt, content, author, status, published_at, created_at, updated_at
       FROM articles
       WHERE slug = ?
       LIMIT 1`,
      [slug]
    );
    return res.status(201).json(normalizeArticleRow(rows[0]));
  } catch (error) {
    if (String(error?.message || '').includes('Duplicate entry')) {
      return res.status(409).json({ error: 'An article with this slug already exists' });
    }
    return res.status(500).json({ error: 'Failed to create article' });
  }
}

async function updateAdminArticle(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid article id' });
    }
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    const excerpt = String(req.body?.excerpt || '').trim();
    const author = String(req.body?.author || 'ViralAdLibrary Team').trim();
    const status = String(req.body?.status || 'draft').toLowerCase() === 'published' ? 'published' : 'draft';
    const slug = slugify(req.body?.slug || title);
    if (!title || !content || !slug) {
      return res.status(400).json({ error: 'Title, content, and slug are required' });
    }

    await pool.query(
      `UPDATE articles
       SET title = ?, slug = ?, excerpt = ?, content = ?, author = ?, status = ?,
           published_at = CASE
             WHEN ? = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP
             WHEN ? = 'draft' THEN NULL
             ELSE published_at
           END
       WHERE id = ?`,
      [title, slug, excerpt, content, author, status, status, status, id]
    );

    const [rows] = await pool.query(
      `SELECT id, title, slug, excerpt, content, author, status, published_at, created_at, updated_at
       FROM articles
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Article not found' });
    }
    return res.json(normalizeArticleRow(rows[0]));
  } catch (error) {
    if (String(error?.message || '').includes('Duplicate entry')) {
      return res.status(409).json({ error: 'An article with this slug already exists' });
    }
    return res.status(500).json({ error: 'Failed to update article' });
  }
}

async function deleteAdminArticle(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid article id' });
    }
    await pool.query('DELETE FROM articles WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete article' });
  }
}

module.exports = {
  adminLogin,
  createAdminArticle,
  deleteAdminArticle,
  getAdminArticles,
  getPublicArticleBySlug,
  getPublicArticles,
  updateAdminArticle,
};
