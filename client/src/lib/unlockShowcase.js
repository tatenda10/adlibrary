const FALLBACK_SHOWCASE = [
  { id: 'u-1', platform: 'TikTok', brand: '@miamansonn', headline: 'Trending clip from TikTok showcase', viralScore: 97, tiktok_url: 'https://www.tiktok.com/@miamansonn/video/7503176132716432670' },
  { id: 'u-2', platform: 'TikTok', brand: '@wiggiediego2', headline: 'Trending clip from TikTok showcase', viralScore: 95, tiktok_url: 'https://www.tiktok.com/@wiggiediego2/video/7496322671089601834' },
  { id: 'u-3', platform: 'TikTok', brand: '@starwalkapp', headline: 'Trending clip from TikTok showcase', viralScore: 94, tiktok_url: 'https://www.tiktok.com/@starwalkapp/video/7585515709866855713' },
  { id: 'u-4', platform: 'TikTok', brand: '@thebellairs', headline: 'me + you + a lifetime', viralScore: 93, tiktok_url: 'https://www.tiktok.com/@thebellairs/video/7483907258045173022' },
  { id: 'u-5', platform: 'TikTok', brand: '@regivenchy', headline: 'When Your Parasailing Line Snaps', viralScore: 96, tiktok_url: 'https://www.tiktok.com/@regivenchy/video/7362227340598086958' },
  { id: 'u-6', platform: 'TikTok', brand: '@beautifscenery', headline: 'Blade Mountain in Guizhou Province', viralScore: 91, tiktok_url: 'https://www.tiktok.com/@beautifscenery/video/7218937151273061674' },
  { id: 'u-7', platform: 'TikTok', brand: '@espn', headline: 'Incredible Basketball Dunk', viralScore: 95, tiktok_url: 'https://www.tiktok.com/@espn/video/7495918458274729246' },
  { id: 'u-8', platform: 'TikTok', brand: '@bryguyferreira', headline: 'Me after the slightest inconvenience', viralScore: 92, tiktok_url: 'https://www.tiktok.com/@bryguyferreira/video/7511686549528907039' },
];

const HOST_ID = 'unlock-showcase-preload-host';
const SHOWCASE_COUNT = 8;
const READY_TIMEOUT_MS = 12000;

let cachedVideos = null;
let preloadStarted = false;
let readyPromise = null;
let readyResolve = null;
const iframeById = new Map();
const loadedIds = new Set();

function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getTikTokEmbedUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/\/video\/(\d+)/);
  if (!match?.[1]) return '';
  return `https://www.tiktok.com/player/v1/${match[1]}?autoplay=1&loop=1&controls=0&description=0&music_info=0`;
}

export function getUnlockShowcaseVideos() {
  if (!cachedVideos) {
    cachedVideos = pickRandom(FALLBACK_SHOWCASE, SHOWCASE_COUNT);
  }
  return cachedVideos;
}

function ensureReadyPromise() {
  if (!readyPromise) {
    readyPromise = new Promise((resolve) => {
      readyResolve = resolve;
    });
  }
  return readyPromise;
}

function markReady() {
  if (readyResolve) {
    readyResolve();
    readyResolve = null;
  }
}

function ensureHost() {
  if (typeof document === 'undefined') return null;
  let host = document.getElementById(HOST_ID);
  if (host) return host;
  host = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '360px',
    height: '640px',
    overflow: 'hidden',
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1',
  });
  document.body.appendChild(host);
  return host;
}

function ensurePreconnect() {
  if (typeof document === 'undefined') return;
  const origins = ['https://www.tiktok.com'];
  origins.forEach((href) => {
    const existing = document.querySelector(`link[data-unlock-preconnect="${href}"]`);
    if (existing) return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    link.crossOrigin = 'anonymous';
    link.setAttribute('data-unlock-preconnect', href);
    document.head.appendChild(link);
  });
  const dns = document.querySelector('link[data-unlock-dns="tiktok"]');
  if (!dns) {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = 'https://www.tiktok.com';
    link.setAttribute('data-unlock-dns', 'tiktok');
    document.head.appendChild(link);
  }
}

function maybeFinishReady(total) {
  if (loadedIds.size >= total) markReady();
}

/**
 * Warm TikTok embeds during onboarding so unlock can reuse already-loaded iframes.
 */
export function preloadUnlockShowcase() {
  if (typeof document === 'undefined') return ensureReadyPromise();
  ensureReadyPromise();
  if (preloadStarted) return readyPromise;
  preloadStarted = true;

  ensurePreconnect();
  const videos = getUnlockShowcaseVideos();
  const host = ensureHost();
  if (!host) {
    markReady();
    return readyPromise;
  }

  window.setTimeout(() => markReady(), READY_TIMEOUT_MS);

  videos.forEach((item) => {
    const embedUrl = getTikTokEmbedUrl(item.tiktok_url);
    if (!embedUrl) {
      loadedIds.add(item.id);
      maybeFinishReady(videos.length);
      return;
    }

    if (iframeById.has(item.id)) {
      loadedIds.add(item.id);
      maybeFinishReady(videos.length);
      return;
    }

    const frame = document.createElement('iframe');
    frame.src = embedUrl;
    frame.title = item.headline || 'TikTok preview';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.setAttribute('scrolling', 'no');
    frame.setAttribute('allowfullscreen', 'true');
    frame.dataset.unlockVideoId = item.id;
    Object.assign(frame.style, {
      width: '100%',
      height: '100%',
      border: '0',
      display: 'block',
    });

    const onLoad = () => {
      loadedIds.add(item.id);
      maybeFinishReady(videos.length);
    };
    frame.addEventListener('load', onLoad, { once: true });
    // If TikTok never fires load, still unlock after timeout at module level.
    iframeById.set(item.id, frame);
    host.appendChild(frame);
  });

  if (videos.length === 0) markReady();
  return readyPromise;
}

export function isUnlockShowcaseReady() {
  const videos = getUnlockShowcaseVideos();
  return videos.length > 0 && loadedIds.size >= videos.length;
}

export async function waitForUnlockShowcase(timeoutMs = 8000) {
  preloadUnlockShowcase();
  if (isUnlockShowcaseReady()) return true;
  await Promise.race([
    ensureReadyPromise(),
    new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
  return isUnlockShowcaseReady();
}

/**
 * Move a preloaded iframe into a visible card. Returns true if claimed.
 */
export function claimUnlockIframe(videoId, container) {
  if (!container || typeof document === 'undefined') return false;
  const frame = iframeById.get(videoId);
  if (!frame) return false;
  if (frame.parentElement === container) return true;
  Object.assign(frame.style, {
    width: '100%',
    height: '100%',
    border: '0',
    display: 'block',
    position: 'absolute',
    inset: '0',
  });
  container.appendChild(frame);
  return true;
}

export function releaseUnlockIframe(videoId) {
  if (typeof document === 'undefined') return;
  const frame = iframeById.get(videoId);
  if (!frame) return;
  const host = ensureHost();
  if (!host) return;
  if (frame.parentElement !== host) host.appendChild(frame);
}

export function releaseUnlockIframes() {
  if (typeof document === 'undefined') return;
  const host = ensureHost();
  if (!host) return;
  iframeById.forEach((frame) => {
    if (frame.parentElement !== host) host.appendChild(frame);
  });
}
