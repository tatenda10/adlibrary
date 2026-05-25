export const THEME_KEY = 'app_theme';
export const THEMES = {
  DARK: 'dark',
  LIGHT: 'light',
};

export function getTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === THEMES.DARK || stored === THEMES.LIGHT) return stored;
  return THEMES.DARK;
}

export function applyTheme(theme) {
  const resolved = theme === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
  document.documentElement.setAttribute('data-theme', resolved);
  localStorage.setItem(THEME_KEY, resolved);
  return resolved;
}

export function initTheme() {
  return applyTheme(getTheme());
}
