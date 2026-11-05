export function RequirePaidAccess({ children }) {
  return children;
}

export function RequireFeature({ feature, children, title, description }) {
  return children;
}

/** @deprecated Prefer RequireFeature with a specific feature key. */
export function RequireProAccess({ children }) {
  return children;
}
