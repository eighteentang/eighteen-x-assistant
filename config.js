(function initConfig(global) {
  const DEFAULTS = {
    enabled: true,
    showVelocity: true,
    keywordFilterEnabled: true,
    keywords: [],
    velocityFilterEnabled: false,
    minVelocity: 0,
    leaderboardOpacity: 0.1,
    maxEntitlement: false,
    entitlement: {
      product: 'growth',
      tier: 'free',
      status: 'inactive',
      entitlements: []
    }
  };

  const MAX_ENTITLEMENTS = Object.freeze([
    'velocity_badge',
    'velocity_filter',
    'reply_assist',
    'advanced_filters'
  ]);

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
      ...source,
      keywords: Array.isArray(source.keywords) ? source.keywords : DEFAULTS.keywords.slice(),
      leaderboardOpacity: Number.isFinite(leaderboardOpacity)
        ? Math.min(1, Math.max(0, leaderboardOpacity))
        : DEFAULTS.leaderboardOpacity,
      entitlement: {
        ...DEFAULTS.entitlement,
        ...(source.entitlement && typeof source.entitlement === 'object' ? source.entitlement : {})
      }
    };
  }

  function normalizeKeywords(value) {
    const input = Array.isArray(value) ? value : String(value || '').split(/[,\n]/);
    return [...new Set(input.map((item) => String(item).trim()).filter(Boolean))];
  }

  function hasEntitlement(settings, name) {
    return Boolean(
      settings &&
      settings.maxEntitlement &&
      settings.entitlement &&
      settings.entitlement.status === 'active' &&
      Array.isArray(settings.entitlement.entitlements) &&
      settings.entitlement.entitlements.includes(name)
    );
  }

  const api = Object.freeze({
    DEFAULTS,
    MAX_ENTITLEMENTS,
    ICON,
    mergeSettings,
    normalizeKeywords,
    hasEntitlement
  });

  global.XA_CONFIG = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
