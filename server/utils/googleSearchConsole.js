const crypto = require('crypto');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function readServiceAccount() {
  const inline = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const b64 = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || '').trim();

  let parsed = null;
  if (inline) {
    parsed = JSON.parse(inline);
  } else if (b64) {
    parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    parsed = {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: String(process.env.GOOGLE_PRIVATE_KEY).replace(/\\n/g, '\n'),
    };
  }

  if (!parsed?.client_email || !parsed?.private_key) {
    return null;
  }

  return {
    clientEmail: parsed.client_email,
    privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
  };
}

function createSignedJwt({ clientEmail, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(privateKey);

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function getAccessToken() {
  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    return { ok: false, reason: 'Search Console credentials are not configured.' };
  }

  const assertion = createSignedJwt(serviceAccount);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    return {
      ok: false,
      reason: data?.error_description || data?.error || `Token request failed (${response.status})`,
    };
  }

  return { ok: true, accessToken: data.access_token };
}

function normalizeSiteUrl(raw) {
  const value = String(raw || '').trim();
  return value || '';
}

async function getSearchConsoleSnapshot() {
  const siteUrl = normalizeSiteUrl(process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL);
  if (!siteUrl) {
    return {
      connected: false,
      message: 'Add GOOGLE_SEARCH_CONSOLE_SITE_URL to enable site-performance graphs.',
      points: [],
      totals: null,
      site_url: '',
    };
  }

  const tokenResult = await getAccessToken();
  if (!tokenResult.ok) {
    return {
      connected: false,
      message: tokenResult.reason,
      points: [],
      totals: null,
      site_url: siteUrl,
    };
  }

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 13);

  const response = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${tokenResult.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        dimensions: ['date'],
        rowLimit: 14,
      }),
    }
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      connected: false,
      message:
        data?.error?.message ||
        `Search Console query failed (${response.status}). Make sure the service account can access the property.`,
      points: [],
      totals: null,
      site_url: siteUrl,
    };
  }

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const points = rows.map((row) => ({
    date: row.keys?.[0] || '',
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(((row.ctr || 0) * 100).toFixed(2)),
    position: Number((row.position || 0).toFixed(2)),
  }));

  const totals = points.reduce(
    (acc, point) => {
      acc.clicks += point.clicks;
      acc.impressions += point.impressions;
      acc.ctrSum += point.ctr;
      acc.positionSum += point.position;
      return acc;
    },
    { clicks: 0, impressions: 0, ctrSum: 0, positionSum: 0 }
  );

  return {
    connected: true,
    message: '',
    points,
    site_url: siteUrl,
    totals: points.length
      ? {
          clicks: totals.clicks,
          impressions: totals.impressions,
          avg_ctr: Number((totals.ctrSum / points.length).toFixed(2)),
          avg_position: Number((totals.positionSum / points.length).toFixed(2)),
        }
      : {
          clicks: 0,
          impressions: 0,
          avg_ctr: 0,
          avg_position: 0,
        },
  };
}

module.exports = {
  getSearchConsoleSnapshot,
};
