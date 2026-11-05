const {
  formatCatalogForAdmin,
  getEntitlementsCatalog,
  saveEntitlementsMatrix,
} = require('../utils/entitlements');

async function getAdminEntitlements(req, res) {
  try {
    const catalog = await getEntitlementsCatalog({ force: true });
    return res.json(formatCatalogForAdmin(catalog));
  } catch (error) {
    console.error('getAdminEntitlements error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load entitlements' });
  }
}

async function putAdminEntitlements(req, res) {
  try {
    const catalog = await saveEntitlementsMatrix(req.body || {});
    return res.json({
      ok: true,
      ...formatCatalogForAdmin(catalog),
    });
  } catch (error) {
    console.error('putAdminEntitlements error:', error);
    return res.status(500).json({ error: error.message || 'Failed to save entitlements' });
  }
}

module.exports = {
  getAdminEntitlements,
  putAdminEntitlements,
};
