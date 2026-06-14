const { verifyToken } = require('@clerk/backend');
const { parseBearerToken } = require('../utils/auth');

async function optionalClerkAuth(req, res, next) {
  try {
    const token = parseBearerToken(req.headers.authorization || '');
    if (!token) return next();

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    req.user = {
      id: payload.sub,
      email: payload.email || null,
      username: payload.username || null,
    };
  } catch {
    // Ignore invalid tokens for optional analytics ingest.
  }
  return next();
}

module.exports = optionalClerkAuth;
