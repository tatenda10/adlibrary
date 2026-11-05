const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../db/connection');
const { ensureUser } = require('../utils/users');

const KAROLA_URL = 'https://karolakarlson.com/best-facebook-ad-examples/';
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'content-library');
const SHARED_LIBRARY_USER_ID = 'shared_content_library';
const STATIC_AD_EXAMPLES_PATH = path.join(__dirname, '..', 'data', 'static-ad-examples.json');

let staticAdExamplesCache = null;

async function getStaticAdExamplesData() {
  if (staticAdExamplesCache) return staticAdExamplesCache;
  const raw = await fs.readFile(STATIC_AD_EXAMPLES_PATH, 'utf8');
  const items = JSON.parse(raw);
  const categories = [
    'all',
    ...Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
  ];
  staticAdExamplesCache = { items, categories };
  return staticAdExamplesCache;
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function decodeHtml(value = '') {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value = '') {
  return decodeHtml(String(value || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function getAttribute(tag, attr) {
  const match = String(tag || '').match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

function toAbsoluteUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return '';
  }
}

function cleanTitle(value = '') {
  return stripHtml(value)
    .replace(/^#+\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^#\d+[-–]?\d*\s*/i, '')
    .trim();
}

function inferFormat(title = '', alt = '') {
  const text = `${title} ${alt}`.toLowerCase();
  if (text.includes('video')) return 'Video';
  if (text.includes('carousel')) return 'Carousel';
  if (text.includes('story')) return 'Story';
  if (text.includes('ugc')) return 'UGC';
  return 'Static';
}

function inferCategory(context = '') {
  const text = context.toLowerCase();
  if (text.includes('2026')) return '2026 Facebook ads';
  if (text.includes('2025')) return '2025 Facebook ads';
  if (text.includes('2024')) return '2024 Meta ads';
  if (text.includes('2023')) return '2023 Meta ads';
  if (text.includes('b2b')) return 'B2B';
  if (text.includes('b2c')) return 'B2C';
  if (text.includes('ecommerce') || text.includes('e-commerce')) return 'E-commerce';
  return 'Facebook ad examples';
}

function inferTags(title = '', alt = '', notes = '') {
  const source = `${title} ${alt} ${notes}`.toLowerCase();
  const tags = ['facebook'];
  const pairs = [
    ['instagram', 'instagram'],
    ['saas', 'saas'],
    ['b2b', 'b2b'],
    ['b2c', 'b2c'],
    ['ecommerce', 'e-commerce'],
    ['e-commerce', 'e-commerce'],
    ['ugc', 'ugc'],
    ['video', 'video'],
    ['carousel', 'carousel'],
    ['testimonial', 'testimonial'],
    ['offer', 'offer'],
    ['discount', 'discount'],
    ['proof', 'proof'],
    ['social proof', 'social proof'],
  ];
  for (const [needle, tag] of pairs) {
    if (source.includes(needle) && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

function extractKarolaExamples(html) {
  const articleStart = html.indexOf('<article');
  const articleEnd = html.indexOf('</article>', articleStart);
  const article = articleStart >= 0 && articleEnd > articleStart ? html.slice(articleStart, articleEnd) : html;
  const headings = [];
  for (const match of article.matchAll(/<h([2-3])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    headings.push({ index: match.index, text: cleanTitle(match[2]) });
  }

  const examples = [];
  for (const match of article.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = toAbsoluteUrl(getAttribute(tag, 'src'), KAROLA_URL);
    const alt = getAttribute(tag, 'alt');
    if (!src || !src.includes('/wp-content/uploads/')) continue;
    if (/logo|avatar|gravatar|best-facebook-ad-examples-2029/i.test(src) || /marketing fix logo/i.test(alt)) continue;

    const previousHeadings = headings.filter((heading) => heading.index < match.index);
    const heading = previousHeadings[previousHeadings.length - 1]?.text || alt || 'Facebook ad example';
    const previousSection = previousHeadings.length > 1 ? previousHeadings[previousHeadings.length - 2]?.text : '';
    const lastHeadingIndex = previousHeadings[previousHeadings.length - 1]?.index || Math.max(0, match.index - 700);
    const notes = stripHtml(article.slice(lastHeadingIndex, match.index)).slice(0, 700);
    const title = cleanTitle(heading || alt || 'Facebook ad example') || 'Facebook ad example';
    const brand = title.replace(/^#?\d+[-–]?\d*\s*/i, '').slice(0, 255);

    examples.push({
      title,
      brand_name: brand,
      platform: 'facebook',
      category: inferCategory(`${previousSection} ${heading} ${notes}`),
      format: inferFormat(title, alt),
      angle: '',
      notes,
      source_url: KAROLA_URL,
      source_asset_url: src,
      tags: inferTags(title, alt, notes),
      meta: {
        alt,
        imported_from: 'karola_karlson_best_facebook_ad_examples',
        source_heading: heading,
      },
    });
  }

  const seen = new Set();
  return examples.filter((item) => {
    if (seen.has(item.source_asset_url)) return false;
    seen.add(item.source_asset_url);
    return true;
  });
}

function extensionFromContentType(contentType = '', fallbackUrl = '') {
  const type = String(contentType || '').toLowerCase();
  if (type.includes('mp4')) return '.mp4';
  if (type.includes('webm')) return '.webm';
  if (type.includes('quicktime')) return '.mov';
  if (type.includes('png')) return '.png';
  if (type.includes('webp')) return '.webp';
  if (type.includes('gif')) return '.gif';
  if (type.includes('jpeg') || type.includes('jpg')) return '.jpg';
  try {
    const ext = path.extname(new URL(fallbackUrl).pathname).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.mov'].includes(ext) ? ext : '.jpg';
  } catch {
    return '.jpg';
  }
}

function safeUserPath(userId) {
  return String(userId || 'user').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80);
}

async function downloadImage(assetUrl, userId) {
  const response = await fetch(assetUrl, {
    headers: {
      'User-Agent': 'ViralAdLibrary content importer',
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const buffer = Buffer.from(await response.arrayBuffer());
  const hash = crypto.createHash('sha256').update(assetUrl).digest('hex').slice(0, 24);
  const ext = extensionFromContentType(contentType, assetUrl);
  const userFolder = safeUserPath(userId);
  const dir = path.join(UPLOAD_ROOT, userFolder);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${hash}${ext}`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);
  return `/uploads/content-library/${userFolder}/${fileName}`;
}

function normalizeItemRow(row) {
  return {
    id: row.id,
    source: row.source,
    platform: row.platform,
    brand_name: row.brand_name || '',
    title: row.title || '',
    category: row.category || '',
    format: row.format || '',
    angle: row.angle || '',
    notes: row.notes || '',
    image_url: row.image_url || '',
    source_url: row.source_url || '',
    source_asset_url: row.source_asset_url || '',
    tags: parseJson(row.tags_json, []),
    meta: parseJson(row.meta_json, {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listContentLibraryItems(req, res) {
  try {
    await ensureUser(req.user);
    const platform = String(req.query?.platform || '').trim().toLowerCase();
    const source = String(req.query?.source || '').trim().toLowerCase();
    const format = String(req.query?.format || '').trim().toLowerCase();
    const search = String(req.query?.search || '').trim();
    const page = Math.max(Number(req.query?.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query?.limit || 24), 1), 60);
    const offset = (page - 1) * limit;
    const params = [req.user.id, SHARED_LIBRARY_USER_ID];
    let where = `WHERE user_id IN (?, ?)`;
    if (platform) {
      where += ' AND platform = ?';
      params.push(platform);
    }
    if (source) {
      where += ' AND source = ?';
      params.push(source);
    }
    if (format && format !== 'all') {
      where += ' AND LOWER(format) = ?';
      params.push(format);
    }
    if (search) {
      where += ' AND (title LIKE ? OR brand_name LIKE ? OR category LIKE ? OR notes LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM content_library_items ${where}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM content_library_items ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const total = Number(countRows?.[0]?.total || 0);
    return res.json({
      items: (rows || []).map(normalizeItemRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    console.error('listContentLibraryItems error:', error);
    return res.status(500).json({ error: 'Failed to load content library.' });
  }
}

async function listStaticAdExamples(req, res) {
  try {
    const { items, categories } = await getStaticAdExamplesData();
    const category = String(req.query?.category || 'all').trim();
    const search = String(req.query?.search || '').trim().toLowerCase();
    const page = Math.max(Number(req.query?.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query?.limit || 24), 1), 60);

    const filtered = items.filter((item) => {
      if (category && category !== 'all' && item.category !== category) return false;
      if (!search) return true;
      const haystack = [
        item.title,
        item.category,
        item.copy,
        item.notes,
        item.deck,
        item.pack,
        ...(item.tags || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });

    const total = filtered.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;

    return res.json({
      items: filtered.slice(offset, offset + limit),
      categories,
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('listStaticAdExamples error:', error);
    return res.status(500).json({ error: 'Failed to load static ad examples.' });
  }
}

async function upsertLibraryItem(userId, item) {
  const [result] = await pool.query(
    `INSERT INTO content_library_items (
      user_id, source, platform, brand_name, title, category, format, angle, notes,
      image_url, source_url, source_asset_url, tags_json, meta_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      brand_name = VALUES(brand_name),
      title = VALUES(title),
      category = VALUES(category),
      format = VALUES(format),
      angle = VALUES(angle),
      notes = VALUES(notes),
      image_url = VALUES(image_url),
      tags_json = VALUES(tags_json),
      meta_json = VALUES(meta_json),
      updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      item.source || 'karola_import',
      item.platform || 'facebook',
      item.brand_name || '',
      item.title || 'Facebook ad example',
      item.category || '',
      item.format || '',
      item.angle || '',
      item.notes || '',
      item.image_url || '',
      item.source_url || '',
      item.source_asset_url || '',
      JSON.stringify(item.tags || []),
      JSON.stringify(item.meta || {}),
    ]
  );
  return result;
}

async function findExistingLibraryImage(userId, sourceAssetUrl) {
  const [rows] = await pool.query(
    `SELECT image_url FROM content_library_items WHERE user_id = ? AND source_asset_url = ? LIMIT 1`,
    [userId, sourceAssetUrl]
  );
  return rows[0]?.image_url || '';
}

async function importKarolaExamples(req, res) {
  try {
    await ensureUser(req.user);
    const libraryUserId = SHARED_LIBRARY_USER_ID;
    const limit = Math.min(Math.max(Number(req.body?.limit || 260), 1), 260);
    const pageUrl = String(req.body?.url || KAROLA_URL).trim();
    if (pageUrl !== KAROLA_URL) {
      return res.status(400).json({ error: 'Only the approved Karola Karlson source URL is supported for this importer.' });
    }

    const pageResponse = await fetch(KAROLA_URL, {
      headers: { 'User-Agent': 'ViralAdLibrary content importer' },
    });
    if (!pageResponse.ok) {
      return res.status(pageResponse.status).json({ error: 'Failed to fetch source page.' });
    }

    const html = await pageResponse.text();
    const examples = extractKarolaExamples(html).slice(0, limit);
    let imported = 0;
    const failed = [];

    for (const example of examples) {
      try {
        const imageUrl = await findExistingLibraryImage(libraryUserId, example.source_asset_url)
          || await downloadImage(example.source_asset_url, libraryUserId);
        await upsertLibraryItem(libraryUserId, {
          ...example,
          source: 'karola_import',
          image_url: imageUrl,
        });
        imported += 1;
      } catch (error) {
        failed.push({
          title: example.title,
          source_asset_url: example.source_asset_url,
          error: error.message,
        });
      }
    }

    return res.json({
      imported,
      found: examples.length,
      failed,
      source_url: KAROLA_URL,
    });
  } catch (error) {
    console.error('importKarolaExamples error:', error);
    return res.status(500).json({ error: error.message || 'Failed to import content library.' });
  }
}

module.exports = {
  importKarolaExamples,
  listContentLibraryItems,
  listStaticAdExamples,
};
