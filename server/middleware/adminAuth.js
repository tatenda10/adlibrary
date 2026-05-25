const { parseBearerToken } = require('../utils/auth');
const { verifyAdminToken } = require('../utils/adminAuth');

function adminAuth(req, res, next) {
  try {
    const token = parseBearerToken(req.headers.authorization || '');
    if (!token) {
      return res.status(401).json({ error: 'Missing admin token' });
    }
    const payload = verifyAdminToken(token);
    req.admin = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
}

module.exports = adminAuth;
