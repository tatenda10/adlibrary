function parseBearerToken(authHeader = '') {
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
}

module.exports = { parseBearerToken };
