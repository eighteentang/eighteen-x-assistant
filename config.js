(function initConfig(global) {
  const DEFAULTS = {
    enabled: true,
    showVelocity: true,
    keywordFilterEnabled: true,
    keywords: [],
    whitelist: [],
    languageFilterEnabled: false,
    allowedLanguages: ['zh', 'en'],
    velocityFilterEnabled: false,
    minVelocity: 0,
    leaderboardOpacity: 0.1,
    leaderboardEnabled: true,
    leaderboardCollapsed: false,
    leaderboardSort: 'velocity',
    leaderboardHours: 0,
    leaderboardLimit: 10
  };

  const ICON = Object.freeze({
    viewBox: '0 0 64 64',
    red: '#ef233c',
    dark: '#111827',
    white: '#ffffff'
  });

  function mergeSettings(value) {
    const source = value && typeof value === 'object' ? value : {};
    const leaderboardOpacity = Number(source.leaderboardOpacity);
    return {
      ...DEFAULTS,
      ...Object.fromEntries(Object.keys(DEFAULTS)
        .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
        .map((key) => [key, source[key]])),
      keywords: normalizeKeywords(source.keywords || []),
      whitelist: normalizeHandles(source.whitelist || []),
      allowedLanguages: normalizeLanguages(source.allowedLanguages ?? DEFAULTS.allowedLanguages),
      leaderboardSort: ['velocity', 'views', 'likes', 'bookmarks'].includes(source.leaderboardSort) ? source.leaderboardSort : 'velocity',
      leaderboardHours: [0, 1, 24, 168].includes(Number(source.leaderboardHours)) ? Number(source.leaderboardHours) : 0,
      leaderboardLimit: [10, 20, 50].includes(Number(source.leaderboardLimit)) ? Number(source.leaderboardLimit) : 10,
      leaderboardOpacity: Number.isFinite(leaderboardOpacity)
        ? Math.min(1, Math.max(0, leaderboardOpacity))
        : DEFAULTS.leaderboardOpacity
    };
  }

  function normalizeKeywords(value) {
    const input = Array.isArray(value) ? value : String(value || '').split(/[,\n]/);
    return [...new Set(input.map((item) => String(item).trim()).filter(Boolean))];
  }

  function normalizeHandles(value) {
    return [...new Set(normalizeKeywords(value).map((item) => item.replace(/^@/, '').toLowerCase())
      .filter((item) => /^[a-z0-9_]{1,15}$/.test(item)))];
  }

  function normalizeLanguages(value) {
    return [...new Set(normalizeKeywords(value).map((item) => item.toLowerCase().replace(/_/g, '-'))
      .filter((item) => /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(item))
      .map((item) => item.split('-')[0]).filter((item) => !['und', 'mul', 'zxx'].includes(item)))];
  }

  const api = Object.freeze({
    DEFAULTS,
    ICON,
    mergeSettings,
    normalizeKeywords,
    normalizeHandles,
    normalizeLanguages
  });

  global.XA_CONFIG = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
