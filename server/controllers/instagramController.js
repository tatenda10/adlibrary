const { ApifyClient } = require('apify-client');

function pickFirst(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, min), max);
}

function resolveInstagramUrl(query) {
  const value = String(query || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const normalizedHandle = value.replace(/^@/, '').replace(/\/+$/, '');
  if (!/^[A-Za-z0-9._-]+$/.test(normalizedHandle)) return '';
  return `https://www.instagram.com/${normalizedHandle}/`;
}

function extractInstagramUsername(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const handle = parsed.pathname.split('/').filter(Boolean)[0] || '';
      return /^[A-Za-z0-9._-]+$/.test(handle) ? handle : '';
    } catch {
      return '';
    }
  }
  const normalizedHandle = raw.replace(/^@/, '').replace(/\/+$/, '');
  return /^[A-Za-z0-9._-]+$/.test(normalizedHandle) ? normalizedHandle : '';
}

function normalizeInstagramPost(item, index) {
  const imageCandidates = [
    item.displayUrl,
    ...(Array.isArray(item.images) ? item.images : []),
    item.imageUrl,
    item.thumbnail,
  ];

  return {
    id: item.id || item.shortCode || item.code || `instagram-${index}`,
    url: pickFirst(item.url, item.inputUrl, item.postUrl, item.reelUrl),
    instagram_url: pickFirst(item.url, item.inputUrl, item.postUrl, item.reelUrl),
    thumbnail: pickFirst(...imageCandidates),
    video_stream_url: pickFirst(item.videoUrl, item.videoPlayUrl),
    caption: pickFirst(item.caption, item.text, item.description),
    author: pickFirst(item.ownerUsername, item.ownerFullName, item.username),
    likes: Number(item.likesCount || item.likes || 0),
    comments: Number(item.commentsCount || item.comments || 0),
    views: Number(item.videoViewCount || item.videoPlayCount || item.viewsCount || 0),
    timestamp: pickFirst(item.timestamp),
    type: pickFirst(item.type, item.productType),
    source_profile: pickFirst(item.ownerUsername, item.username),
  };
}

function extractInstagramItems(items) {
  const normalized = [];

  items.forEach((item, index) => {
    if (item?.error === 'no_items') {
      return;
    }

    const nestedPosts = [
      ...toArray(item.latestPosts),
      ...toArray(item.topPosts),
      ...toArray(item.posts),
      ...toArray(item.latestIgtvVideos),
      ...toArray(item.reels),
    ];

    if (nestedPosts.length) {
      nestedPosts.forEach((post, nestedIndex) => {
        normalized.push(
          normalizeInstagramPost(
            {
              ...post,
              ownerUsername: pickFirst(post.ownerUsername, item.username),
              ownerFullName: pickFirst(post.ownerFullName, item.fullName),
            },
            `${index}-${nestedIndex}`
          )
        );
      });
      return;
    }

    if (item.url || item.shortCode || item.displayUrl || item.videoUrl) {
      normalized.push(normalizeInstagramPost(item, index));
    }
  });

  return normalized.filter((item) => {
    if (!item.url) return false;
    if (item.video_stream_url) return true;
    if (item.thumbnail) return true;
    if (item.caption && item.author) return true;
    return false;
  });
}

function extractJsonObject(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function planInstagramSearch({ prompt, fallbackQuery, businessProfile }) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return {
      query: fallbackQuery,
      related_queries: [fallbackQuery].filter(Boolean),
      rationale: 'CLAUDE_API_KEY not configured; using direct Instagram search.',
    };
  }

  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

  const instruction = `You optimize discovery inputs for Instagram ad research.
Return STRICT JSON only:
{
  "query": "single best Instagram username, brand handle, or profile URL seed",
  "related_queries": ["q1", "q2", "q3"],
  "rationale": "one short sentence"
}

Business context:\n${JSON.stringify(businessProfile || {}, null, 2)}
User request:\n${prompt || fallbackQuery}

Rules:
- Query should be concise and usable as an Instagram profile seed
- Prefer brand handles, competitor names, or creator accounts relevant to ad research
- related_queries should contain alternate relevant profile seeds, not hashtags
- Do not include markdown`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      temperature: 0.2,
      messages: [{ role: 'user', content: instruction }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data?.content?.map((part) => part.text).join('\n') || '';
  const parsed = extractJsonObject(text);

  if (!parsed || !parsed.query) {
    return {
      query: fallbackQuery,
      related_queries: [fallbackQuery].filter(Boolean),
      rationale: 'Claude response was not valid JSON; using direct Instagram search.',
    };
  }

  return {
    query: String(parsed.query).trim(),
    related_queries: Array.isArray(parsed.related_queries)
      ? parsed.related_queries.filter(Boolean).slice(0, 5)
      : [String(parsed.query).trim()],
    rationale: String(parsed.rationale || 'Optimized by Claude').trim(),
  };
}

async function runInstagramActor(actorId, runInput, limit) {
  if (!process.env.APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN is not configured');
  }

  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const run = await client.actor(actorId).call(runInput);
  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    limit: Math.max(clamp(limit, 1, 48, 48) * 3, 48),
  });
  return Array.isArray(items) ? items : [];
}

async function fetchInstagramResultsForQueries(queries, limit = 48, source = 'profile_posts') {
  const resolvedUrls = Array.from(
    new Set(
      (Array.isArray(queries) ? queries : [queries])
        .map(resolveInstagramUrl)
        .filter(Boolean)
    )
  );

  if (!resolvedUrls.length) {
    throw new Error('query is required');
  }

  const maxItems = clamp(limit, 1, 48, 48);
  const profileCount = Math.min(resolvedUrls.length, 6);
  const perProfileLimit = Math.max(3, Math.ceil(maxItems / profileCount));

  let actorId = process.env.APIFY_INSTAGRAM_ACTOR || 'apify/instagram-scraper';
  let runInput = {
    directUrls: resolvedUrls.slice(0, profileCount),
    resultsLimit: perProfileLimit,
    resultsType: 'posts',
    searchLimit: profileCount,
    searchType: 'user',
    addParentData: false,
  };

  if (source === 'reels') {
    actorId = process.env.APIFY_INSTAGRAM_REELS_ACTOR || 'apify/instagram-reel-scraper';
    const usernames = resolvedUrls
      .map(extractInstagramUsername)
      .filter(Boolean)
      .slice(0, profileCount);

    if (!usernames.length) {
      throw new Error('A valid Instagram username is required for reels search.');
    }

    runInput = {
      username: usernames,
      resultsLimit: perProfileLimit,
      searchLimit: profileCount,
      addParentData: false,
    };
  }

  const items = await runInstagramActor(actorId, runInput, maxItems);
  console.log('instagram scraper raw sample:', JSON.stringify({
    actorId,
    source,
    queryCount: resolvedUrls.length,
    sourceUrls: resolvedUrls.slice(0, profileCount),
    sample: Array.isArray(items) ? items.slice(0, 3) : [],
  }, null, 2));

  const deduped = [];
  const seen = new Set();
  const extractedItems = extractInstagramItems(items);
  console.log('instagram scraper normalized sample:', JSON.stringify({
    actorId,
    source,
    extractedCount: extractedItems.length,
    sample: extractedItems.slice(0, 6),
  }, null, 2));

  extractedItems.forEach((item) => {
    const key = pickFirst(item.url, item.instagram_url, item.id);
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });

  return {
    source,
    actorId,
    results: deduped.slice(0, maxItems),
    sourceUrls: resolvedUrls.slice(0, profileCount),
  };
}

async function fetchInstagramResults(query, limit = 48, source = 'profile_posts') {
  return fetchInstagramResultsForQueries([query], limit, source);
}

async function searchInstagram(req, res) {
  try {
    const { query = '', limit = 48, source = 'profile_posts' } = req.body || {};
    if (!String(query).trim()) {
      return res.status(400).json({ error: 'query is required' });
    }
    if (!resolveInstagramUrl(query)) {
      return res.status(400).json({
        error: 'Enter a valid Instagram username or profile URL for standard search. Use Intelligent Search for niche phrases or broad topics.',
      });
    }
    const data = await fetchInstagramResults(query, limit, source);
    return res.json(data);
  } catch (error) {
    console.error('searchInstagram error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch Instagram results' });
  }
}

async function intelligentSearchInstagram(req, res) {
  try {
    const {
      prompt = '',
      query = '',
      limit = 48,
      businessProfile = {},
      source = 'profile_posts',
    } = req.body || {};
    const seed = String(query || prompt).trim();

    if (!seed) {
      return res.status(400).json({ error: 'prompt or query is required' });
    }

    const plan = await planInstagramSearch({
      prompt: String(prompt).trim(),
      fallbackQuery: seed,
      businessProfile,
    });

    const profileSeeds = Array.from(
      new Set([plan.query, ...(Array.isArray(plan.related_queries) ? plan.related_queries : [])].filter(Boolean))
    ).slice(0, 6);

    const data = await fetchInstagramResultsForQueries(profileSeeds, limit, source);
    return res.json({
      plan,
      profileSeeds,
      ...data,
    });
  } catch (error) {
    console.error('intelligentSearchInstagram error:', error);
    return res.status(500).json({ error: error.message || 'Failed to run intelligent Instagram search' });
  }
}

async function proxyInstagramMedia(req, res) {
  try {
    const target = String(req.query?.url || '').trim();
    if (!target) {
      return res.status(400).send('url is required');
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return res.status(400).send('Invalid media URL');
    }

    const hostname = parsed.hostname.toLowerCase();
    const allowed = [
      'cdninstagram.com',
      'fbcdn.net',
      'instagram.com',
    ].some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));

    if (!allowed) {
      return res.status(403).send('Unsupported media host');
    }

    const upstream = await fetch(parsed.toString(), {
      headers: {
        'user-agent': 'Mozilla/5.0',
        referer: 'https://www.instagram.com/',
      },
    });

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '');
      return res.status(upstream.status).send(body || 'Failed to fetch media');
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=3600';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', cacheControl);
    return res.send(buffer);
  } catch (error) {
    console.error('proxyInstagramMedia error:', error);
    return res.status(502).send('Failed to proxy Instagram media');
  }
}

module.exports = { searchInstagram, intelligentSearchInstagram, proxyInstagramMedia };
