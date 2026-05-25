const path = require('path');
const fs = require('fs/promises');
const { createReadStream } = require('fs');
const { normalizeCacheKey, upsertTopAdsCache } = require('./tiktokTopAdsStore');

const MEDIA_ROOT = path.join(__dirname, '..', 'data', 'top-ads-media');
const PERSIST_MEDIA = String(process.env.TIKTOK_TOP_ADS_PERSIST_MEDIA || '1').trim() !== '0';
const BACKFILL_ON_READ = String(process.env.TIKTOK_TOP_ADS_BACKFILL_ON_READ || '1').trim() !== '0';
const MAX_VIDEO_BYTES = Math.min(
  Math.max(Number(process.env.TIKTOK_TOP_ADS_MAX_VIDEO_MB || 80), 5),
  200
) * 1024 * 1024;

function safeAdFileId(adId) {
  return String(adId || 'ad')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
}

function filterDirName(filters = {}) {
  const key = normalizeCacheKey(filters);
  return [key.country, key.industry, key.objective, key.period, key.adFormat, key.orderBy]
    .map((part) => String(part || 'x').replace(/[^a-zA-Z0-9_-]/g, '-'))
    .join('__');
}

function mediaDirForFilters(filters = {}) {
  return path.join(MEDIA_ROOT, filterDirName(filters));
}

function videoFilePath(filters, adId) {
  return path.join(mediaDirForFilters(filters), `${safeAdFileId(adId)}.mp4`);
}

function thumbFilePath(filters, adId) {
  return path.join(mediaDirForFilters(filters), `${safeAdFileId(adId)}.jpg`);
}

function buildPlaybackUrl(filters, adId) {
  const key = normalizeCacheKey(filters);
  const params = new URLSearchParams({
    country: key.country,
    industry: key.industry,
    objective: key.objective,
    period: key.period,
    adFormat: key.adFormat,
    orderBy: key.orderBy,
  });
  return `/api/tiktok/top-ads/media/${encodeURIComponent(safeAdFileId(adId))}?${params.toString()}`;
}

function buildThumbnailUrl(filters, adId) {
  const key = normalizeCacheKey(filters);
  const params = new URLSearchParams({
    country: key.country,
    industry: key.industry,
    objective: key.objective,
    period: key.period,
    adFormat: key.adFormat,
    orderBy: key.orderBy,
  });
  return `/api/tiktok/top-ads/thumbnail/${encodeURIComponent(safeAdFileId(adId))}?${params.toString()}`;
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 500;
  } catch {
    return false;
  }
}

async function downloadToFile(sourceUrl, destPath, referer = 'https://www.tiktok.com/') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        referer,
        origin: 'https://www.tiktok.com',
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_VIDEO_BYTES) {
      return { ok: false, reason: 'too_large' };
    }
    if (buffer.length < 500) {
      return { ok: false, reason: 'too_small' };
    }
    if (destPath.endsWith('.mp4') && contentType && !contentType.includes('video') && !contentType.includes('octet')) {
      return { ok: false, reason: `not_video:${contentType}` };
    }

    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, buffer);
    return { ok: true, bytes: buffer.length };
  } catch (error) {
    return { ok: false, reason: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function persistItemMedia(item, filters) {
  if (!PERSIST_MEDIA) return item;

  const adId = item.id;
  const videoCandidates = [item.videoUrlHd, item.videoUrl]
    .map((u) => String(u || '').trim())
    .filter(Boolean)
    .filter((url, index, arr) => arr.indexOf(url) === index);
  const thumbSource = String(item.thumbnail || '').trim();

  let playbackUrl = item.playbackUrl || '';
  let thumbnailCachedUrl = item.thumbnailCachedUrl || '';

  const videoPath = videoFilePath(filters, adId);
  if (videoCandidates.length) {
    let hasFile = await fileExists(videoPath);
    if (!hasFile) {
      for (const sourceUrl of videoCandidates) {
        const result = await downloadToFile(sourceUrl, videoPath);
        if (result.ok) {
          hasFile = true;
          break;
        }
        console.warn('[top ads media] video download failed', {
          adId,
          status: result.status,
          reason: result.reason,
          urlPreview: sourceUrl.slice(0, 120),
        });
      }
    }
    if (hasFile || (await fileExists(videoPath))) {
      playbackUrl = buildPlaybackUrl(filters, adId);
    }
  }

  const thumbPath = thumbFilePath(filters, adId);
  if (thumbSource) {
    const hasThumb = await fileExists(thumbPath);
    if (!hasThumb) {
      await downloadToFile(thumbSource, thumbPath);
    }
    if (await fileExists(thumbPath)) {
      thumbnailCachedUrl = buildThumbnailUrl(filters, adId);
    }
  }

  return {
    ...item,
    playbackUrl,
    thumbnailCachedUrl,
    videoUrl: String(item.videoUrl || videoCandidates[videoCandidates.length - 1] || '').trim(),
    videoUrlHd: String(item.videoUrlHd || item.videoUrl || '').trim(),
    thumbnail: thumbSource || item.thumbnail || '',
  };
}

async function persistTopAdsMedia(items, filters) {
  if (!PERSIST_MEDIA || !Array.isArray(items) || !items.length) {
    return items;
  }

  const results = [];
  const batchSize = 4;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const persisted = await Promise.all(batch.map((item) => persistItemMedia(item, filters)));
    results.push(...persisted);
  }

  const withPlayback = results.filter((i) => i.playbackUrl).length;
  console.log('[top ads media] persisted files', {
    filter: filterDirName(filters),
    total: results.length,
    withLocalPlayback: withPlayback,
  });

  return results;
}

async function ensureCachedItemsPlayback(items, filters) {
  let list = await attachPlaybackFromDisk(items, filters);
  if (!PERSIST_MEDIA || !BACKFILL_ON_READ) return list;

  const needsDownload = list.filter(
    (i) => !String(i.playbackUrl || '').trim() && String(i.videoUrlHd || i.videoUrl || '').trim()
  );
  if (!needsDownload.length) return list;

  console.log('[top ads media] backfilling cache on read', {
    filter: filterDirName(filters),
    count: needsDownload.length,
  });

  list = await persistTopAdsMedia(list, filters);

  const withLocal = list.filter((i) => String(i.playbackUrl || '').trim()).length;
  if (withLocal > 0) {
    await upsertTopAdsCache(filters, list, 'media_backfill').catch((err) => {
      console.warn('[top ads media] failed to save backfill to db', err?.message || err);
    });
  }

  return list;
}

async function attachPlaybackFromDisk(items, filters) {
  if (!Array.isArray(items)) return [];

  return Promise.all(
    items.map(async (item) => {
      const adId = item.id;
      let playbackUrl = item.playbackUrl || '';
      let thumbnailCachedUrl = item.thumbnailCachedUrl || '';

      if (!playbackUrl && (await fileExists(videoFilePath(filters, adId)))) {
        playbackUrl = buildPlaybackUrl(filters, adId);
      }
      if (!thumbnailCachedUrl && (await fileExists(thumbFilePath(filters, adId)))) {
        thumbnailCachedUrl = buildThumbnailUrl(filters, adId);
      }

      return {
        ...item,
        playbackUrl,
        thumbnailCachedUrl,
        videoUrl: String(item.videoUrl || '').trim(),
        videoUrlHd: String(item.videoUrlHd || item.videoUrl || '').trim(),
        thumbnail: String(item.thumbnail || '').trim(),
      };
    })
  );
}

function resolveMediaFilePath(filters, adId, kind = 'video') {
  const filePath = kind === 'thumb' ? thumbFilePath(filters, adId) : videoFilePath(filters, adId);
  const resolved = path.resolve(filePath);
  const rootResolved = path.resolve(MEDIA_ROOT);
  if (!resolved.startsWith(rootResolved)) return null;
  return resolved;
}

function streamMediaFile(req, res, kind = 'video') {
  const filters = {
    country: req.query?.country,
    industry: req.query?.industry,
    objective: req.query?.objective,
    period: req.query?.period,
    adFormat: req.query?.adFormat || req.query?.ad_format,
    orderBy: req.query?.orderBy || req.query?.order_by,
  };

  const adId = decodeURIComponent(String(req.params.adId || ''));
  const filePath = resolveMediaFilePath(filters, adId, kind);

  if (!filePath) {
    return res.status(400).json({ error: 'Invalid media path.' });
  }

  return fs
    .access(filePath)
    .then(() => {
      const contentType = kind === 'thumb' ? 'image/jpeg' : 'video/mp4';
      res.setHeader('content-type', contentType);
      res.setHeader('cache-control', 'public, max-age=86400');
      return createReadStream(filePath).pipe(res);
    })
    .catch(() => res.status(404).json({ error: 'Cached media file not found.' }));
}

module.exports = {
  PERSIST_MEDIA,
  BACKFILL_ON_READ,
  persistTopAdsMedia,
  ensureCachedItemsPlayback,
  attachPlaybackFromDisk,
  streamTopAdVideo: (req, res) => streamMediaFile(req, res, 'video'),
  streamTopAdThumbnail: (req, res) => streamMediaFile(req, res, 'thumb'),
  buildPlaybackUrl,
};
