const { verifyToken } = require('@clerk/backend');
const { parseBearerToken } = require('../utils/auth');

async function clerkAuth(req, res, next) {
  try {
    const token = parseBearerToken(req.headers.authorization || '');

    if (!token) {
      console.warn('[auth] missing bearer token', {
        path: req.path,
        method: req.method,
      });
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    req.user = {
      id: payload.sub,
      email: payload.email || null,
      username: payload.username || null,
    };

    console.log('[auth] verified user', {
      id: req.user.id,
      path: req.path,
      method: req.method,
    });

    return next();
  } catch (error) {
    console.warn('[auth] verification failed', {
      path: req.path,
      method: req.method,
      message: error?.message,
    });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = clerkAuth;
