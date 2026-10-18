(function initConfig(global) {
  const DEFAULTS = {
    enabled: true,
    showVelocity: true,
    keywordFilterEnabled: true,
    keywords: [],
    velocityFilterEnabled: false,
    minVelocity: 0,
    leaderboardOpacity: 0.1
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
      keywords: Array.isArray(source.keywords) ? source.keywords : DEFAULTS.keywords.slice(),
      leaderboardOpacity: Number.isFinite(leaderboardOpacity)
        ? Math.min(1, Math.max(0, leaderboardOpacity))
        : DEFAULTS.leaderboardOpacity
    };
  }

  function normalizeKeywords(value) {
    const input = Array.isArray(value) ? value : String(value || '').split(/[,\n]/);
    return [...new Set(input.map((item) => String(item).trim()).filter(Boolean))];
  }

  const api = Object.freeze({
    DEFAULTS,
    ICON,
    mergeSettings,
    normalizeKeywords
  });

  global.XA_CONFIG = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
