(function initFilters(global) {
  function keywordMatch(settings, text) {
    if (!settings.keywordFilterEnabled) return '';
    const value = String(text || '').toLowerCase();
    return settings.keywords.find((keyword) => value.includes(keyword.toLowerCase())) || '';
  }

  function reasons(settings, details) {
    if (!settings.enabled || settings.filteringEnabled === false) return [];
    const author = String(details.author || '').toLowerCase();
    if (author && settings.whitelist.includes(author)) return [];
    const result = [];
    if (author && (settings.blockedAccounts || []).includes(author)) result.push(`屏蔽账号：@${author}`);
    const domain = (details.domains || []).find((host) => (settings.blockedDomains || []).some((blocked) => host === blocked || host.endsWith(`.${blocked}`)));
    if (domain) result.push(`屏蔽域名：${domain}`);
    const keyword = keywordMatch(settings, details.text);
    if (keyword) result.push(`关键词：${keyword}`);
    const language = String(details.language || '').toLowerCase().split('-')[0];
    const knownLanguage = /^[a-z]{2,3}$/.test(language) && !['und', 'mul', 'zxx'].includes(language);
    if (settings.languageFilterEnabled && settings.allowedLanguages.length && knownLanguage &&
        !settings.allowedLanguages.includes(language)) result.push(`语言：${language}（未在允许列表中）`);
    if (settings.velocityFilterEnabled && Number.isFinite(details.velocity) &&
        details.velocity < Number(settings.minVelocity || 0)) result.push(`流速低于 ${settings.minVelocity}/h`);
    return result;
  }

  function pageType(pathname) {
    const path = String(pathname || '').replace(/\/+$/, '') || '/';
    if (/^\/(?:[^/]+|i\/web)\/status\/\d+(?:\/|$)/.test(path)) return 'detail';
    if (/^\/(?:i|[^/]+)\/lists\/\d+(?:\/|$)/.test(path)) return 'lists';
    if (path === '/home') return 'home';
    const reserved = ['home', 'explore', 'search', 'notifications', 'messages', 'settings', 'compose', 'i', 'login', 'logout', 'tos', 'privacy', 'jobs', 'communities', 'premium'];
    const profile = path.match(/^\/([a-z0-9_]{1,15})(?:\/(?:with_replies|media|likes|highlights|articles))?$/i);
    return profile && !reserved.includes(profile[1].toLowerCase()) ? 'profile' : 'other';
  }

  const api = Object.freeze({ keywordMatch, reasons, pageType });
  global.XA_FILTERS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
